'use strict';
const express = require('express');
const { q } = require('../db');
const { ah, ok, badRequest, notFound, pagination } = require('../lib/http');
const { requireAuth, requirePerm } = require('../lib/auth');
const { audit } = require('../lib/audit');
const { nextNumber } = require('../lib/numbering');
const { notify } = require('../lib/notify');

const router = express.Router();
router.use(requireAuth);

function resDetail(id) {
  const r = q.get(
    `SELECT x.*, u.full_name AS responsible_name, d.name AS department_name, f.original_name AS evidence_name, f.id AS evidence_file_id
     FROM resolutions x
     JOIN users u ON u.id=x.responsible_user_id
     LEFT JOIN departments d ON d.id=x.department_id
     LEFT JOIN files f ON f.id=x.evidence_file_id
     WHERE x.id=?`, id);
  if (!r) return null;
  r.comments = q.all(
    `SELECT c.*, u.full_name AS user_name FROM resolution_comments c JOIN users u ON u.id=c.user_id
     WHERE c.resolution_id=? ORDER BY c.id`, id);
  return r;
}

router.get('/', ah(async (req, res) => {
  const { page, pageSize, limit, offset } = pagination(req.query);
  const where = ['1=1'], params = [];
  if (req.query.status) { where.push('x.status=?'); params.push(req.query.status); }
  if (req.query.mine === '1') { where.push('x.responsible_user_id=?'); params.push(req.user.id); }
  if (req.query.search) { where.push('(x.resolution_number LIKE ? OR x.subject LIKE ?)'); params.push(`%${req.query.search}%`, `%${req.query.search}%`); }
  const rows = q.all(
    `SELECT x.id, x.resolution_number, x.subject, x.status, x.priority, x.due_date, x.closure_date,
            u.full_name AS responsible_name
     FROM resolutions x JOIN users u ON u.id=x.responsible_user_id
     WHERE ${where.join(' AND ')} ORDER BY x.due_date IS NULL, x.due_date LIMIT ? OFFSET ?`,
    ...params, limit, offset);
  const total = q.get(`SELECT COUNT(*) c FROM resolutions x WHERE ${where.join(' AND ')}`, ...params).c;
  ok(res, rows, { page, pageSize, total });
}));

router.post('/', requirePerm('resolution.create'), ah(async (req, res) => {
  const b = req.body || {};
  if (!b.subject || !b.decision) throw badRequest('Subject and decision are mandatory');
  if (!b.responsible_user_id) throw badRequest('Responsible person required');
  if (!Number.isInteger(Number(b.responsible_user_id)) ||
      !q.get(`SELECT id FROM users WHERE id=? AND is_active=1`, Number(b.responsible_user_id))) {
    throw badRequest('Responsible person must be an active user');
  }
  if (b.due_date !== undefined && b.due_date !== null && (typeof b.due_date !== 'string' || isNaN(Date.parse(b.due_date)))) {
    throw badRequest('due_date must be a valid date string (YYYY-MM-DD)');
  }
  if (!['Low', 'Normal', 'High', 'Urgent'].includes(b.priority || 'Normal')) throw badRequest('priority must be Low, Normal, High or Urgent');
  const number = nextNumber('RES-DEFAULT', {}, req.user.id, 'RESOLUTION');
  const r = q.run(
    `INSERT INTO resolutions (resolution_number, resolution_date, meeting_ref, subject, decision,
       responsible_user_id, department_id, action_required, due_date, priority, created_by)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    number, b.resolution_date || new Date().toISOString().slice(0, 10), b.meeting_ref || null,
    String(b.subject).trim(), b.decision, b.responsible_user_id, b.department_id || null,
    b.action_required || null, b.due_date || null, b.priority || 'Normal', req.user.id);
  const rid = Number(r.lastInsertRowid);
  notify('RESOLUTION_ASSIGNED', {
    assigneeIds: [b.responsible_user_id], entityType: 'RESOLUTION', entityId: rid,
    title: 'Resolution action assigned',
    body: `${number}: ${b.subject}${b.due_date ? ' — due ' + b.due_date : ''}`,
    vars: { resNumber: number, dueDate: b.due_date || '-' }
  });
  audit({ user: req.user, action: 'CREATE', entityType: 'RESOLUTION', entityId: rid, next: { number } });
  res.status(201).json({ data: resDetail(rid) });
}));

router.get('/:id', ah(async (req, res) => {
  const r = resDetail(Number(req.params.id));
  if (!r) throw notFound('Resolution not found');
  audit({ user: req.user, action: 'VIEW', entityType: 'RESOLUTION', entityId: r.id });
  ok(res, r);
}));

router.post('/:id/comments', ah(async (req, res) => {
  const r = resDetail(Number(req.params.id));
  if (!r) throw notFound('Resolution not found');
  const { comment } = req.body || {};
  if (!comment) throw badRequest('Comment required');
  q.run(`INSERT INTO resolution_comments (resolution_id, user_id, comment) VALUES (?,?,?)`, r.id, req.user.id, comment);
  audit({ user: req.user, action: 'COMMENT', entityType: 'RESOLUTION', entityId: r.id, next: { comment } });
  res.status(201).json({ data: { posted: true } });
}));

/** Progress / complete with evidence */
router.post('/:id/progress', ah(async (req, res) => {
  const r = resDetail(Number(req.params.id));
  if (!r) throw notFound('Not found');
  if (['completed', 'closed'].includes(r.status)) throw badRequest('Already completed');
  q.run(`UPDATE resolutions SET status='in_progress' WHERE id=? AND status='open'`, r.id);
  audit({ user: req.user, action: 'EDIT', entityType: 'RESOLUTION', entityId: r.id, next: { progress: true } });
  ok(res, resDetail(r.id));
}));

router.post('/:id/close', ah(async (req, res) => {
  const r = resDetail(Number(req.params.id));
  if (!r) throw notFound('Not found');
  if (r.status === 'closed') throw badRequest('Already closed');
  const { closure_comments } = req.body || {};
  let evidenceFileId = r.evidence_file_id;
  if ((req.headers['content-type'] || '').includes('multipart/form-data')) {
    const multer = require('multer');
    // handled below by middleware variant — JSON path uses evidence_file_id
  }
  if (req.body && req.body.evidence_file_id) evidenceFileId = Number(req.body.evidence_file_id);
  q.run(
    `UPDATE resolutions SET status='closed', closure_date=date('now'), closure_comments=?, evidence_file_id=? WHERE id=?`,
    closure_comments || null, evidenceFileId, r.id);
  audit({
    user: req.user, action: 'CLOSE', entityType: 'RESOLUTION', entityId: r.id,
    prev: { status: r.status }, next: { closed: true, evidence: evidenceFileId }
  });
  notify('DEADLINE_APPROACHING', {
    assigneeIds: [r.created_by].filter(Boolean), entityType: 'RESOLUTION', entityId: r.id,
    title: `Resolution ${r.resolution_number} closed`,
    body: `Closed by ${req.user.full_name}.`
  });
  ok(res, resDetail(r.id));
}));

// Evidence upload (multipart)
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });
router.post('/:id/evidence', upload.single('file'), ah(async (req, res) => {
  const r = resDetail(Number(req.params.id));
  if (!r) throw notFound('Not found');
  if (!req.file) throw badRequest('file required');
  const { storeFile } = require('../lib/storage');
  const fileId = storeFile(req.file.buffer, req.file.originalname, req.file.mimetype, req.user.id);
  q.run(`UPDATE resolutions SET evidence_file_id=? WHERE id=?`, fileId, r.id);
  audit({ user: req.user, action: 'UPLOAD', entityType: 'RESOLUTION_EVIDENCE', entityId: r.id, next: { fileId } });
  res.status(201).json({ data: { file_id: fileId, original_name: req.file.originalname } });
}));

module.exports = router;
