'use strict';
const crypto = require('crypto');
const express = require('express');
const { q } = require('../db');
const config = require('../config');
const jwtLib = require('../lib/jwt');
const { verifyPassword, hashPassword } = require('../lib/passwords');
const { verifyTotp } = require('../lib/totp');
const { audit } = require('../lib/audit');
const { ah, unauthorized, badRequest } = require('../lib/http');
const { requireAuth } = require('../lib/auth');

const router = express.Router();

// Simple login rate limiting: 8 failures per username+IP per 15-minute window
const loginAttempts = new Map();
function rateLimited(key) {
  const now = Date.now();
  const rec = loginAttempts.get(key);
  if (!rec) return false;
  if (now - rec.first > 15 * 60 * 1000) { loginAttempts.delete(key); return false; }
  return rec.count >= 8;
}
function recordFailure(key) {
  const now = Date.now();
  const rec = loginAttempts.get(key);
  if (!rec || now - rec.first > 15 * 60 * 1000) loginAttempts.set(key, { first: now, count: 1 });
  else rec.count++;
}
const attemptKey = (req, username) => `${String(username || '').toLowerCase()}|${req.ip}`;

function profileFor(u) {
  const permissions = q.all(
    `SELECT p.code FROM permissions p JOIN role_permissions rp ON rp.permission_id=p.id WHERE rp.role_id=?`,
    u.role_id
  ).map(r => r.code);
  const unread = q.get(`SELECT COUNT(*) c FROM notifications WHERE user_id=? AND read_at IS NULL`, u.id).c;
  return {
    id: u.id, username: u.username, full_name: u.full_name, email: u.email,
    role_code: u.role_code, role_name: u.role_name,
    department_id: u.department_id, organization_id: u.organization_id,
    mfa_enabled: !!u.mfa_secret,
    permissions: u.role_code === 'ADMIN' ? ['*'] : permissions,
    unread_notifications: unread
  };
}

router.post('/login', ah(async (req, res) => {
  const { username, password, otp, ticket } = req.body || {};
  let user = null;

  if (ticket) {
    const payload = jwtLib.verify(ticket, config.jwtSecret);
    if (!payload || payload.purpose !== 'mfa') throw unauthorized('MFA ticket invalid or expired');
    user = q.get(
      `SELECT u.*, r.code AS role_code, r.name AS role_name FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=?`,
      payload.sub);
    if (!user || !user.mfa_secret) throw unauthorized();
    if (!verifyTotp(user.mfa_secret, otp)) {
      audit({ user: { id: user.id }, action: 'LOGIN_FAILED', entityType: 'USER', entityId: user.id, details: 'invalid MFA code' });
      throw unauthorized('Invalid MFA code');
    }
  } else {
    if (!username || !password) throw badRequest('Username and password required');
    if (rateLimited(attemptKey(req, username))) {
      audit({ action: 'LOGIN_RATE_LIMITED', entityType: 'USER', entityId: null, ip: req.ip, details: username });
      throw unauthorized('Too many failed attempts — try again in 15 minutes');
    }
    user = q.get(
      `SELECT u.*, r.code AS role_code, r.name AS role_name FROM users u JOIN roles r ON r.id=u.role_id WHERE username=?`,
      String(username).trim());
    if (!user || !verifyPassword(password, user.password_hash)) {
      const probe = user ? user.id : null;
      recordFailure(attemptKey(req, username));
      audit({ user: probe ? { id: probe } : null, action: 'LOGIN_FAILED', entityType: 'USER', entityId: probe, ip: req.ip });
      throw unauthorized('Invalid credentials');
    }
    if (!user.is_active) throw unauthorized('Account is disabled');
    if (user.mfa_secret && !otp) {
      return res.json({
        data: { mfa_required: true },
        meta: { message: 'MFA code required' }
      });
    }
    if (user.mfa_secret && otp && !verifyTotp(user.mfa_secret, otp)) {
      audit({ user: { id: user.id }, action: 'LOGIN_FAILED', entityType: 'USER', entityId: user.id, details: 'invalid MFA code', ip: req.ip });
      throw unauthorized('Invalid MFA code');
    }
  }

  const jti = crypto.randomUUID();
  const expires = new Date(Date.now() + config.jwtTtlSeconds * 1000).toISOString().replace('T', ' ').slice(0, 19);
  q.run(
    `INSERT INTO sessions (id, user_id, ip, user_agent, expires_at) VALUES (?,?,?,?,?)`,
    jti, user.id, req.ip, (req.headers['user-agent'] || '').slice(0, 250), expires
  );
  q.run(`UPDATE users SET last_login_at=datetime('now') WHERE id=?`, user.id);

  const token = jwtLib.sign({ sub: user.id, jti }, config.jwtSecret, config.jwtTtlSeconds);
  audit({ user, action: 'LOGIN', entityType: 'USER', entityId: user.id, ip: req.ip, sessionId: jti });
  res.json({ data: { token, expires_at: expires, profile: profileFor(user) } });
}));

router.post('/logout', ah(async (req, res) => {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (token) {
    const payload = jwtLib.verify(token, config.jwtSecret);
    if (payload) {
      q.run(`UPDATE sessions SET revoked_at=datetime('now') WHERE id=?`, payload.jti);
      audit({ user: { id: payload.sub }, action: 'LOGOUT', entityType: 'USER', entityId: payload.sub });
    }
  }
  res.json({ data: { ok: true } });
}));

router.get('/me', requireAuth, ah(async (req, res) => {
  res.json({ data: profileFor(req.user) });
}));

router.post('/change-password', requireAuth, ah(async (req, res) => {
  const { current_password, new_password } = req.body || {};
  if (!current_password || !new_password) throw badRequest('Current and new password required');
  if (String(new_password).length < 8) throw badRequest('New password must be at least 8 characters');
  const u = q.get(`SELECT password_hash FROM users WHERE id=?`, req.user.id);
  if (!verifyPassword(current_password, u.password_hash)) throw unauthorized('Current password incorrect');
  q.run(`UPDATE users SET password_hash=?, updated_at=datetime('now') WHERE id=?`,
    hashPassword(new_password), req.user.id);
  // revoke all other sessions
  q.run(`UPDATE sessions SET revoked_at=datetime('now') WHERE user_id=? AND id<>?`, req.user.id, req.sessionId);
  audit({ user: req.user, action: 'PASSWORD_CHANGE', entityType: 'USER', entityId: req.user.id });
  res.json({ data: { ok: true } });
}));

// MFA enrollment (self-service): generate secret; confirm with first valid code
router.post('/mfa/setup', requireAuth, ah(async (req, res) => {
  const { generateSecret } = require('../lib/totp');
  if (req.user.mfa_secret) throw badRequest('MFA already enabled');
  const secret = generateSecret();
  res.json({ data: { secret, otpauth: `otpauth://totp/IDMS:${req.user.username}?secret=${secret}&issuer=IDMS` } });
}));

router.post('/mfa/confirm', requireAuth, ah(async (req, res) => {
  const { secret, code } = req.body || {};
  if (!secret || !code) throw badRequest('Secret and code required');
  if (!verifyTotp(secret, code)) throw badRequest('Code does not match â€” not enrolled');
  q.run(`UPDATE users SET mfa_secret=?, updated_at=datetime('now') WHERE id=?`, secret, req.user.id);
  audit({ user: req.user, action: 'MFA_ENABLE', entityType: 'USER', entityId: req.user.id });
  res.json({ data: { ok: true } });
}));

router.post('/mfa/disable', requireAuth, ah(async (req, res) => {
  const { password } = req.body || {};
  const u = q.get(`SELECT password_hash FROM users WHERE id=?`, req.user.id);
  if (!verifyPassword(password || '', u.password_hash)) throw unauthorized('Password confirmation failed');
  q.run(`UPDATE users SET mfa_secret=NULL WHERE id=?`, req.user.id);
  audit({ user: req.user, action: 'MFA_DISABLE', entityType: 'USER', entityId: req.user.id });
  res.json({ data: { ok: true } });
}));

module.exports = router;
