'use strict';
const express = require('express');
const { q } = require('../db');
const config = require('../config');
const { ah, ok, pagination, badRequest } = require('../lib/http');
const { requireAuth } = require('../lib/auth');
const { audit } = require('../lib/audit');

const router = express.Router();
router.use(requireAuth);

router.get('/me', ah(async (req, res) => {
  const u = q.get(
    `SELECT u.id, u.username, u.full_name, u.email, u.phone, u.mfa_secret,
            r.name AS role_name, r.code AS role_code, d.name AS department_name
     FROM users u JOIN roles r ON r.id=u.role_id LEFT JOIN departments d ON d.id=u.department_id
     WHERE u.id=?`, req.user.id);
  delete u.mfa_secret;
  u.mfa_enabled = !!req.user.mfa_secret;
  ok(res, u);
}));

router.put('/me', ah(async (req, res) => {
  const sets = [], params = [];
  for (const k of ['full_name', 'email', 'phone']) {
    if (req.body[k] !== undefined) { sets.push(`${k}=?`); params.push(req.body[k]); }
  }
  if (sets.length) {
    params.push(req.user.id);
    q.run(`UPDATE users SET updated_at=datetime('now'), ${sets.join(',')} WHERE id=?`, ...params);
    audit({ user: req.user, action: 'EDIT', entityType: 'USER_PROFILE', entityId: req.user.id });
  }
  ok(res, { updated: true });
}));

router.get('/sessions', ah(async (req, res) => {
  ok(res, q.all(
    `SELECT s.id, s.issued_at, s.expires_at, s.ip, s.revoked_at,
            CASE WHEN s.revoked_at IS NULL AND s.expires_at > datetime('now') THEN 1 ELSE 0 END AS active
     FROM sessions s WHERE s.user_id=? ORDER BY s.issued_at DESC`, req.user.id));
}));

router.post('/sessions/:id/revoke', ah(async (req, res) => {
  q.run(`UPDATE sessions SET revoked_at=datetime('now') WHERE id=? AND user_id=?`,
    req.params.id, req.user.id);
  audit({ user: req.user, action: 'SESSION_REVOKE', entityType: 'SESSION', entityId: null, details: req.params.id });
  ok(res, { revoked: true });
}));

module.exports = router;
