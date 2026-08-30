'use strict';
const express = require('express');
const { q } = require('../db');
const { ah, ok, badRequest, pagination } = require('../lib/http');
const { requireAuth } = require('../lib/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', ah(async (req, res) => {
  const { page, pageSize, limit, offset } = pagination(req.query, 50, 200);
  const unreadOnly = req.query.unread === '1';
  const rows = q.all(
    `SELECT id, event_code, title, body, entity_type, entity_id, read_at, created_at
     FROM notifications WHERE user_id=? ${unreadOnly ? 'AND read_at IS NULL' : ''}
     ORDER BY id DESC LIMIT ? OFFSET ?`, req.user.id, limit, offset);
  const total = q.get(`SELECT COUNT(*) c FROM notifications WHERE user_id=?`, req.user.id).c;
  const unread = q.get(`SELECT COUNT(*) c FROM notifications WHERE user_id=? AND read_at IS NULL`, req.user.id).c;
  ok(res, rows, { page, pageSize, total, unread });
}));

router.post('/:id/read', ah(async (req, res) => {
  q.run(`UPDATE notifications SET read_at=datetime('now') WHERE id=? AND user_id=?`,
    Number(req.params.id), req.user.id);
  ok(res, { ok: true });
}));

router.post('/read-all', ah(async (req, res) => {
  q.run(`UPDATE notifications SET read_at=datetime('now') WHERE user_id=? AND read_at IS NULL`, req.user.id);
  ok(res, { ok: true });
}));

module.exports = router;
