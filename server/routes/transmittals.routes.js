'use strict';
const express = require('express');
const { q } = require('../db');
const { ah, ok, badRequest, notFound, conflict, pagination } = require('../lib/http');
const { requireAuth, requirePerm } = require('../lib/auth');
const { audit } = require('../lib/audit');
const { nextNumber } = require('../lib/numbering');

const router = express.Router();
router.use(requireAuth);

function trnDetail(id) {
  const t = q.get(
    `SELECT t.*, su.full_name AS sender_name, so.name AS sender_org_name,
            ro.name AS recipient_org_name, p.code AS purpose_code,
            c.corr_number AS related_corr_number
     FROM transmittals t
     LEFT JOIN users su ON su.id=t.sender_user_id
     LEFT JOIN organizations so ON so.id=t.sender_org_id
     LEFT JOIN organizations ro ON ro.id=t.recipient_org_id
     LEFT JOIN purposes p ON p.id=t.purpose_id
     LEFT JOIN correspondence c ON c.id=t.related_correspondence_id
     WHERE t.id=?`, id);
  if (!t) return null;
  t.items = q.all(
    `SELECT ti.*, d.doc_number, d.title AS doc_title, r.revision_code
     FROM transmittal_items ti
     JOIN documents d ON d.id=ti.document_id
     JOIN document_revisions r ON r.id=ti.revision_id
     WHERE ti.transmittal_id=? ORDER BY ti.id`, id);
  t.distributions = q.all(
    `SELECT di.*, u.full_name AS recipient_name, o.name AS recipient_org_name
     FROM distributions di
     LEFT JOIN users u ON u.id=di.recipient_user_id
     LEFT JOIN organizations o ON o.id=di.recipient_org_id
     WHERE di.transmittal_id=? ORDER BY di.id`, id);
  t.attachments = q.all(
    `SELECT a.id, f.original_name, f.size_bytes, a.file_id FROM attachments a JOIN files f ON f.id=a.file_id
     WHERE a.entity_type='TRANSMITTAL' AND a.entity_id=?`, id);
  return t;
}

router.get('/', ah(async (req, res) => {
  const { page, pageSize, limit, offset } = pagination(req.query);
  const where = ['1=1'], params = [];
  if (req.query.direction) { where.push('t.direction=?'); params.push(req.query.direction); }
  if (req.query.status) { where.push('t.status=?'); params.push(req.query.status); }
  if (req.query.search) { where.push('(t.trn_number LIKE ? OR t.subject LIKE ?)'); params.push(`%${req.query.search}%`, `%${req.query.search}%`); }
  const rows = q.all(
    `SELECT t.id, t.trn_number, t.subject, t.direction, t.status, t.trn_date, t.response_required,
            t.response_due_date, t.acknowledged_at,
            ro.name AS recipient_org_name, su.full_name AS sender_name
     FROM transmittals t
     LEFT JOIN organizations ro ON ro.id=t.recipient_org_id
     LEFT JOIN users su ON su.id=t.sender_user_id
     WHERE ${where.join(' AND ')} ORDER BY t.id DESC LIMIT ? OFFSET ?`,
    ...params, limit, offset);
  const total = q.get(`SELECT COUNT(*) c FROM transmittals t WHERE ${where.join(' AND ')}`, ...params).c;
  ok(res, rows, { page, pageSize, total });
}));

router.post('/', requirePerm('transmittal.create'), ah(async (req, res) => {
  const b = req.body || {};
  if (!b.subject) throw badRequest('Subject required');
  if (!Array.isArray(b.document_ids) || !b.document_ids.length) throw badRequest('At least one document required (missing transmittal documents)');
  const number = b.trn_number || nextNumber('TRN-DEFAULT', {}, req.user.id, 'TRANSMITTAL');
  if (q.get(`SELECT id FROM transmittals WHERE trn_number=? COLLATE NOCASE`, number)) throw conflict(`Duplicate transmittal number ${number}`);

  const r = q.tx(() => {
    const ins = q.run(
      `INSERT INTO transmittals (trn_number, direction, subject, sender_user_id, sender_org_id, recipient_org_id,
         recipient_contact, recipient_user_id, purpose_id, trn_date, response_required, response_due_date,
         comments, related_correspondence_id, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      number, b.direction || 'outgoing', b.subject, req.user.id, b.sender_org_id || req.user.organization_id,
      b.recipient_org_id || null, b.recipient_contact || null, b.recipient_user_id || null,
      b.purpose_id || null, b.trn_date || new Date().toISOString().slice(0, 10),
      b.response_required ? 1 : 0, b.response_due_date || null, b.comments || null,
      b.related_correspondence_id || null, req.user.id);
    const tid = Number(ins.lastInsertRowid);

    for (const docId of b.document_ids) {
      const cur = q.get(`SELECT id FROM document_revisions WHERE document_id=? AND is_current=1 ORDER BY id DESC LIMIT 1`, docId);
      if (!cur) throw badRequest(`Document ${docId} has no current revision`);
      q.run(`INSERT INTO transmittal_items (transmittal_id, document_id, revision_id, item_action, remarks)
             VALUES (?,?,?,?,?)`, tid, docId, cur.id, b.item_action || 'issue', null);
    }
    // distribution list: explicit recipients or org-level
    const recipients = Array.isArray(b.recipient_user_ids) && b.recipient_user_ids.length
      ? b.recipient_user_ids : [];
    if (recipients.length || b.recipient_org_id) {
      if (recipients.length) {
        for (const uid of recipients) {
          q.run(`INSERT INTO distributions (transmittal_id, recipient_user_id, copy_type) VALUES (?,?,'Electronic')`, tid, uid);
        }
      } else {
        q.run(`INSERT INTO distributions (transmittal_id, recipient_org_id, copy_type) VALUES (?,?,'Electronic')`,
          tid, b.recipient_org_id);
      }
    }
    return tid;
  });
  audit({ user: req.user, action: 'CREATE', entityType: 'TRANSMITTAL', entityId: r, next: { number } });
  res.status(201).json({ data: trnDetail(r) });
}));

router.get('/:id', ah(async (req, res) => {
  const t = trnDetail(Number(req.params.id));
  if (!t) throw notFound('Transmittal not found');
  audit({ user: req.user, action: 'VIEW', entityType: 'TRANSMITTAL', entityId: t.id });
  ok(res, t);
}));

/** Issue the transmittal — locks items, notifies recipients */
router.post('/:id/issue', requirePerm('transmittal.issue'), ah(async (req, res) => {
  const t = trnDetail(Number(req.params.id));
  if (!t) throw notFound('Transmittal not found');
  if (t.status !== 'draft') throw badRequest(`Only draft transmittals can be issued (status=${t.status})`);
  if (!t.items.length) throw badRequest('Missing transmittal documents — add at least one item');
  if (!t.distributions.length && !t.recipient_org_id) throw badRequest('No recipients configured');

  q.tx(() => {
    q.run(`UPDATE transmittals SET status='issued' WHERE id=?`, t.id);
    q.run(`UPDATE distributions SET status='sent', sent_at=datetime('now') WHERE transmittal_id=?`, t.id);
  });

  // notify recipient org users + specific recipients
  let assignees = t.distributions.map(d => d.recipient_user_id).filter(Boolean);
  if (!assignees.length && t.recipient_org_id) {
    assignees = q.all(`SELECT id FROM users WHERE organization_id=? AND is_active=1`, t.recipient_org_id).map(u => u.id);
  }
  const { notify } = require('../lib/notify');
  notify('TRANSMITTAL_ISSUED', {
    assigneeIds: assignees, entityType: 'TRANSMITTAL', entityId: t.id,
    title: 'Transmittal issued',
    body: `Transmittal ${t.trn_number} "${t.subject}" issued to you.`,
    vars: { trnNumber: t.trn_number }
  });

  // documents move to issued-for-review/approval/construction per purpose of issue
  const { transition, statusByCode } = require('../lib/statuses');
  for (const item of t.items) {
    const purpose = q.get(`SELECT p.code FROM purposes p JOIN documents d ON d.purpose_id=p.id WHERE d.id=?`, item.document_id);
    const targetCode = purpose && purpose.code === 'ASB' ? 'AB'
      : purpose && purpose.code === 'CON' ? 'IFC' : 'IFA';
    try {
      transition({
        table: 'documents', idColumn: 'id', statusColumn: 'external_status_id',
        entityType: 'DOCUMENT', entityId: item.document_id, toStatusId: statusByCode(targetCode).id,
        user: { ...req.user }, reason: `Issued via transmittal ${t.trn_number}`
      });
    } catch { /* external status optional */ }
  }

  audit({ user: req.user, action: 'TRANSMITTAL_ISSUE', entityType: 'TRANSMITTAL', entityId: t.id });
  ok(res, trnDetail(t.id));
}));

/** Acknowledge receipt of an issued transmittal */
router.post('/:id/acknowledge', ah(async (req, res) => {
  const t = trnDetail(Number(req.params.id));
  if (!t) throw notFound('Transmittal not found');
  if (t.status !== 'issued') throw badRequest('Only issued transmittals can be acknowledged');
  const dist = q.get(
    `SELECT * FROM distributions WHERE transmittal_id=? AND status='sent' AND (recipient_user_id IS NULL OR recipient_user_id=?)`,
    t.id, req.user.id);
  if (dist) q.run(`UPDATE distributions SET status='acknowledged', acknowledged_at=datetime('now'), acknowledged_by=? WHERE id=?`,
    req.user.id, dist.id);
  else q.run(`UPDATE distributions SET status='acknowledged', acknowledged_at=datetime('now'), acknowledged_by=? WHERE transmittal_id=?`,
    req.user.id, t.id);

  q.run(`UPDATE transmittals SET status='acknowledged', acknowledged_at=datetime('now')
         WHERE id=? AND status='issued'`, t.id);
  audit({ user: req.user, action: 'ACKNOWLEDGE', entityType: 'TRANSMITTAL', entityId: t.id });

  const { notify } = require('../lib/notify');
  notify('ACK_RECEIVED', {
    assigneeIds: [t.sender_user_id].filter(Boolean), entityType: 'TRANSMITTAL', entityId: t.id,
    title: 'Acknowledgement received',
    body: `${t.trn_number} acknowledged by ${req.user.full_name}.`,
    vars: { trnNumber: t.trn_number, orgName: req.user.full_name }
  });
  ok(res, trnDetail(t.id));
}));

/** Record response / close */
router.post('/:id/respond', ah(async (req, res) => {
  const t = trnDetail(Number(req.params.id));
  if (!t) throw notFound('Transmittal not found');
  if (!['issued', 'acknowledged'].includes(t.status)) throw badRequest('Transmittal is not awaiting response');
  const { comments } = req.body || {};
  q.run(`UPDATE transmittals SET status='responded', responded_at=datetime('now'), comments=COALESCE(comments,'')||? WHERE id=?`,
    `\n[${req.user.username}] ${comments || 'Response recorded.'}`, t.id);
  audit({ user: req.user, action: 'TRANSMITTAL_RESPOND', entityType: 'TRANSMITTAL', entityId: t.id, next: { comments } });
  ok(res, trnDetail(t.id));
}));

router.post('/:id/close', requirePerm('transmittal.issue'), ah(async (req, res) => {
  const t = trnDetail(Number(req.params.id));
  if (!t) throw notFound('Transmittal not found');
  q.run(`UPDATE transmittals SET status='closed', closed_at=datetime('now') WHERE id=?`, t.id);
  audit({ user: req.user, action: 'CLOSE', entityType: 'TRANSMITTAL', entityId: t.id });
  ok(res, trnDetail(t.id));
}));

module.exports = router;
