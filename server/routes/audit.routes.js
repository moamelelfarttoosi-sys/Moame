'use strict';
const express = require('express');
const { q } = require('../db');
const { ah, ok, pagination } = require('../lib/http');
const { requireAuth, requirePerm } = require('../lib/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', requirePerm('audit.view'), ah(async (req, res) => {
  const { page, pageSize, limit, offset } = pagination(req.query);
  const where = ['1=1'], params = [];
  if (req.query.user_id) { where.push('user_id=?'); params.push(req.query.user_id); }
  if (req.query.action) { where.push('action=?'); params.push(req.query.action); }
  if (req.query.entity_type) { where.push('entity_type=?'); params.push(String(req.query.entity_type).toUpperCase()); }
  if (req.query.entity_id) { where.push('entity_id=?'); params.push(req.query.entity_id); }
  if (req.query.from) { where.push(`at >= ?`); params.push(`${req.query.from} 00:00:00`); }
  if (req.query.to) { where.push(`at <= ?`); params.push(`${req.query.to} 23:59:59`); }
  if (req.query.search) { where.push('(username LIKE ? OR details LIKE ? OR action LIKE ?)'); params.push(`%${req.query.search}%`, `%${req.query.search}%`, `%${req.query.search}%`); }
  const w = `WHERE ${where.join(' AND ')}`;
  const rows = q.all(
    `SELECT a.*, u.full_name AS user_display FROM audit_logs a LEFT JOIN users u ON u.id=a.user_id
     ${w} ORDER BY a.id DESC LIMIT ? OFFSET ?`, ...params, limit, offset);
  for (const r of rows) {
    try { r.prev_value = r.prev_value ? JSON.parse(r.prev_value) : null; } catch {}
    try { r.new_value = r.new_value ? JSON.parse(r.new_value) : null; } catch {}
    try { r.details = r.details && r.details.startsWith('{') ? JSON.parse(r.details) : r.details; } catch {}
  }
  const total = q.get(`SELECT COUNT(*) c FROM audit_logs a ${w}`, ...params).c;
  ok(res, rows, { page, pageSize, total });
}));

router.get('/actions', requirePerm('audit.view'), ah(async (req, res) => {
  ok(res, q.all(`SELECT DISTINCT action FROM audit_logs ORDER BY action`).map(r => r.action));
}));

module.exports = router;
