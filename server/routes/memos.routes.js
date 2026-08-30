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

function memoDetail(id) {
  const m = q.get(
    `SELECT m.*, u.full_name AS from_name, d.name AS department_name
     FROM memos m JOIN users u ON u.id=m.from_user_id
     LEFT JOIN departments d ON d.id=m.department_id WHERE m.id=?`, id);
  if (!m) return null;
  m.to_users = JSON.parse(m.to_users || '[]');
  m.cc_users = JSON.parse(m.cc_users || '[]');
  m.recipients = q.all(
    `SELECT mr.user_id, mr.kind, u.full_name, u.username FROM memo_recipients mr JOIN users u ON u.id=mr.user_id
     WHERE mr.memo_id=?`, id);
  return m;
}

router.get('/', ah(async (req, res) => {
  const { page, pageSize, limit, offset } = pagination(req.query);
  const mineOnly = req.query.scope === 'mine';
  const mineSql = mineOnly ? `WHERE (m.created_by=? OR EXISTS (SELECT 1 FROM memo_recipients r WHERE r.memo_id=m.id AND r.user_id=?))` : '';
  const mineParams = mineOnly ? [req.user.id, req.user.id] : [];
  const rows = q.all(
    `SELECT m.id, m.memo_number, m.subject, m.memo_date, m.priority, m.status,
            u.full_name AS from_name, d.name AS department_name
     FROM memos m JOIN users u ON u.id=m.from_user_id LEFT JOIN departments d ON d.id=m.department_id
     ${mineSql}
     ORDER BY m.id DESC LIMIT ? OFFSET ?`, ...mineParams, limit, offset);
  const total = q.get(`SELECT COUNT(*) c FROM memos m ${mineSql}`, ...mineParams).c;
  ok(res, rows, { page, pageSize, total });
}));

router.post('/', requirePerm('memo.create'), ah(async (req, res) => {
  const b = req.body || {};
  if (!b.subject) throw badRequest('Subject required');
  if (!b.body) throw badRequest('Body required');
  if (!Array.isArray(b.to_users) || !b.to_users.length) throw badRequest('At least one recipient (to_users)');
  if (!['Low', 'Normal', 'High', 'Urgent'].includes(b.priority || 'Normal')) throw badRequest('priority must be Low, Normal, High or Urgent');
  if (typeof b.subject !== 'string' || !b.subject.trim()) throw badRequest('subject must be a non-empty string');
  if (typeof b.body !== 'string' || !b.body.trim()) throw badRequest('body must be a non-empty string');
  const number = nextNumber('MEMO-DEFAULT', {}, req.user.id, 'MEMO');
  const r = q.tx(() => {
    const ins = q.run(
      `INSERT INTO memos (memo_number, subject, from_user_id, to_users, cc_users, department_id, memo_date,
         priority, body, status, created_by)
       VALUES (?,?,?,?,?,?,?,?,?, 'draft', ?)`,
      number, String(b.subject).trim(), req.user.id, JSON.stringify(b.to_users), JSON.stringify(b.cc_users || []),
      b.department_id || null, b.memo_date || new Date().toISOString().slice(0, 10),
      b.priority || 'Normal', b.body, req.user.id);
    const mid = Number(ins.lastInsertRowid);
    for (const uid of b.to_users) q.run(`INSERT OR IGNORE INTO memo_recipients (memo_id,user_id,kind) VALUES (?,?,'to')`, mid, uid);
    for (const uid of (b.cc_users || [])) q.run(`INSERT OR IGNORE INTO memo_recipients (memo_id,user_id,kind) VALUES (?,?,'cc')`, mid, uid);
    return mid;
  });
  audit({ user: req.user, action: 'CREATE', entityType: 'MEMO', entityId: r, next: { number } });
  res.status(201).json({ data: memoDetail(r) });
}));

router.get('/:id', ah(async (req, res) => {
  const m = memoDetail(Number(req.params.id));
  if (!m) throw notFound('Memo not found');
  audit({ user: req.user, action: 'VIEW', entityType: 'MEMO', entityId: m.id });
  ok(res, m);
}));

/** Route memo through internal approval then distribute */
router.post('/:id/issue', requirePerm('memo.create'), ah(async (req, res) => {
  const m = memoDetail(Number(req.params.id));
  if (!m) throw notFound('Memo not found');
  if (m.status !== 'draft') throw badRequest('Memo already issued');
  q.run(`UPDATE memos SET status='issued', issued_at=datetime('now'), distribution_status='distributed' WHERE id=?`, m.id);
  notify('MEMO_ISSUED', {
    assigneeIds: [...m.to_users, ...(m.cc_users || [])], entityType: 'MEMO', entityId: m.id,
    title: `Memo ${m.memo_number}`, body: `${m.subject}`,
    vars: { memoNumber: m.memo_number, subject: m.subject }
  });
  audit({ user: req.user, action: 'ISSUE', entityType: 'MEMO', entityId: m.id });
  ok(res, memoDetail(m.id));
}));

module.exports = router;
