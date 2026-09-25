'use strict';
const express = require('express');
const { q } = require('../db');
const { ah, ok, badRequest, notFound, pagination } = require('../lib/http');
const { requireAuth, requirePerm } = require('../lib/auth');
const { audit } = require('../lib/audit');
const { nextNumber } = require('../lib/numbering');
const { notify } = require('../lib/notify');
const { applySla, overdueExpr } = require('../lib/corrSla');
const { assertCode } = require('../lib/codes');

const router = express.Router();
router.use(requireAuth);

function corrDetail(id) {
  const c = q.get(
    `SELECT c.*, ${overdueExpr()} AS computed_overdue,
            so.name AS sender_org_name, ro.name AS recipient_org_name, u.full_name AS assigned_user_name,
            fp.full_name AS focal_point_name
     FROM correspondence c
     LEFT JOIN organizations so ON so.id=c.sender_org_id
     LEFT JOIN organizations ro ON ro.id=c.recipient_org_id
     LEFT JOIN users u ON u.id=c.assigned_user_id
     LEFT JOIN users fp ON fp.id=c.focal_point_user_id
     WHERE c.id=?`, id);
  if (!c) return null;
  if (c.computed_overdue != null && c.computed_overdue !== c.days_overdue) {
    q.run(`UPDATE correspondence SET days_overdue=? WHERE id=?`, c.computed_overdue, id);
    c.days_overdue = c.computed_overdue;
  }
  delete c.computed_overdue;
  c.links = q.all(
    `SELECT cl.entity_type, cl.entity_id,
            CASE cl.entity_type WHEN 'DOCUMENT' THEN (SELECT doc_number FROM documents WHERE id=cl.entity_id)
                                WHEN 'TRANSMITTAL' THEN (SELECT trn_number FROM transmittals WHERE id=cl.entity_id)
                                ELSE NULL END AS reference
     FROM correspondence_links cl WHERE cl.correspondence_id=?`, id);
  return c;
}

router.get('/', ah(async (req, res) => {
  const { page, pageSize, limit, offset } = pagination(req.query);
  const where = ['1=1'], params = [];
  if (req.query.direction) { where.push('c.direction=?'); params.push(req.query.direction); }
  if (req.query.status) { where.push('c.status=?'); params.push(req.query.status); }
  if (req.query.search) { where.push('(c.corr_number LIKE ? OR c.subject LIKE ?)'); params.push(`%${req.query.search}%`, `%${req.query.search}%`); }
  const rows = q.all(
    `SELECT c.id, c.corr_number, c.entry_number, c.subject, c.direction, c.corr_type, c.status, c.corr_date,
            c.received_date, c.response_required, c.response_due_date, c.urgency,
            c.counterparty_code, c.counterparty_ref, c.letter_date, c.language_code,
            c.responsible_dept_code, c.focal_point_user_id, c.reply_days_allowed, c.reply_due_date,
            c.reply_reference, c.days_overdue, c.contractual_notice, c.clause, c.archive_box,
            so.name AS sender_org_name, ro.name AS recipient_org_name, u.full_name AS assigned_user_name,
            ${overdueExpr()} AS computed_overdue
     FROM correspondence c
     LEFT JOIN organizations so ON so.id=c.sender_org_id
     LEFT JOIN organizations ro ON ro.id=c.recipient_org_id
     LEFT JOIN users u ON u.id=c.assigned_user_id
     WHERE ${where.join(' AND ')} ORDER BY c.id DESC LIMIT ? OFFSET ?`, ...params, limit, offset);
  for (const row of rows) {
    if (row.computed_overdue != null && row.computed_overdue !== row.days_overdue) {
      q.run(`UPDATE correspondence SET days_overdue=? WHERE id=? AND days_overdue<>?`, row.computed_overdue, row.id, row.computed_overdue);
      row.days_overdue = row.computed_overdue;
    }
    delete row.computed_overdue;
  }
  const total = q.get(`SELECT COUNT(*) c FROM correspondence c WHERE ${where.join(' AND ')}`, ...params).c;
  ok(res, rows, { page, pageSize, total });
}));

router.post('/', requirePerm('correspondence.create'), ah(async (req, res) => {
  const b = req.body || {};
  if (!b.subject) throw badRequest('Subject required');
  if (!b.direction) throw badRequest('Direction required');
  assertCode('ORIGINATOR', b.counterparty_code);
  assertCode('DEPARTMENT', b.responsible_dept_code);
  assertCode('LANGUAGE', b.language_code);
  if (b.urgency && !['normal', 'urgent'].includes(b.urgency)) throw badRequest('urgency must be normal or urgent');
  for (const df of ['corr_date', 'received_date', 'response_due_date', 'letter_date']) {
    if (b[df] !== undefined && b[df] !== null && (typeof b[df] !== 'string' || isNaN(Date.parse(b[df])))) {
      throw badRequest(`${df} must be a valid date string (YYYY-MM-DD)`);
    }
  }
  if (typeof b.subject !== 'string' || !b.subject.trim()) throw badRequest('subject must be a non-empty string');
  if (b.subject.length > 500) throw badRequest('subject exceeds 500 characters');

  const number = nextNumber(b.direction === 'incoming' ? 'CORR-IN' : 'CORR-OUT', {}, req.user.id, 'CORRESPONDENCE');
  // SLA engine: configurable reply periods (BOC/MOO/UEG=7, Contractors=10, Urgent=3)
  const sla = applySla({
    counterparty_code: b.counterparty_code, urgency: b.urgency,
    received_date: b.received_date, corr_date: b.corr_date
  });

  const cid = q.tx(() => {
    const entryNumber = (q.get(`SELECT COALESCE(MAX(entry_number),0)+1 AS n FROM correspondence`).n);
    const r = q.run(
      `INSERT INTO correspondence (corr_number, direction, subject, corr_type, sender_org_id, sender_name,
         recipient_org_id, recipient_name, corr_date, received_date, response_required, response_due_date,
         assigned_user_id, body, created_by, entry_number, counterparty_code, counterparty_ref, letter_date,
         language_code, responsible_dept_code, focal_point_user_id, reply_days_allowed, reply_due_date,
         contractual_notice, clause, archive_box, urgency)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      number, b.direction, String(b.subject).trim(), b.corr_type || 'Letter',
      b.sender_org_id || null, b.sender_name || null, b.recipient_org_id || null, b.recipient_name || null,
      b.corr_date || new Date().toISOString().slice(0, 10), b.received_date || null,
      b.response_required ? 1 : 0, b.response_due_date || null, b.assigned_user_id || null, b.body || null, req.user.id,
      entryNumber, b.counterparty_code || null, b.counterparty_ref || null, b.letter_date || null,
      b.language_code || 'EN', b.responsible_dept_code || null, b.focal_point_user_id || null,
      sla.reply_days_allowed, sla.reply_due_date,
      b.contractual_notice ? 1 : 0, b.clause || null, b.archive_box || null, b.urgency || 'normal');
    return Number(r.lastInsertRowid);
  });
  for (const l of (b.links || [])) {
    q.run(`INSERT OR IGNORE INTO correspondence_links (correspondence_id, entity_type, entity_id) VALUES (?,?,?)`,
      cid, l.entity_type, l.entity_id);
  }
  if (b.assigned_user_id) {
    notify('CORRESPONDENCE_NEW', {
      assigneeIds: [b.assigned_user_id], entityType: 'CORRESPONDENCE', entityId: cid,
      title: 'Correspondence assigned', body: `${number}: ${b.subject}`,
      vars: { corrNumber: number, subject: b.subject }
    });
  }
  audit({ user: req.user, action: 'CREATE', entityType: 'CORRESPONDENCE', entityId: cid, next: { number } });
  res.status(201).json({ data: corrDetail(cid) });
}));

router.get('/:id', ah(async (req, res) => {
  const c = corrDetail(Number(req.params.id));
  if (!c) throw notFound('Not found');
  audit({ user: req.user, action: 'VIEW', entityType: 'CORRESPONDENCE', entityId: c.id });
  ok(res, c);
}));

router.put('/:id/status', ah(async (req, res) => {
  const c = corrDetail(Number(req.params.id));
  if (!c) throw notFound('Not found');
  const { status, comments } = req.body || {};
  if (!['new', 'in_progress', 'awaiting_response', 'responded', 'closed', 'open', 'pending', 'replied', 'void'].includes(status)) throw badRequest('Invalid status');
  q.run(`UPDATE correspondence SET status=?, closed_at=CASE WHEN ?='closed' THEN datetime('now') ELSE closed_at END WHERE id=?`,
    status, status, c.id);
  audit({ user: req.user, action: 'STATUS_CHANGE', entityType: 'CORRESPONDENCE', entityId: c.id, prev: { status: c.status }, next: { status, comments } });
  ok(res, corrDetail(c.id));
}));

module.exports = router;
