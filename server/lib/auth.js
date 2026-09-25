'use strict';
const { q } = require('../db');
const config = require('../config');
const jwt = require('./jwt');
const { unauthorized, forbidden } = require('./http');

/** Attach req.user (with role + permissions) from Bearer token. Validates session revocation. */
function requireAuth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return next(unauthorized());
  const payload = jwt.verify(token, config.jwtSecret);
  if (!payload) return next(unauthorized('Invalid or expired session token'));

  const sess = q.get(`SELECT * FROM sessions WHERE id=?`, payload.jti);
  if (!sess || sess.revoked_at) return next(unauthorized('Session revoked'));
  if (new Date(sess.expires_at.replace(' ', 'T') + 'Z').getTime() < Date.now()) return next(unauthorized('Session expired'));

  const u = q.get(
    `SELECT u.id, u.username, u.full_name, u.email, u.is_active, u.role_id, u.department_id,
            u.organization_id, u.mfa_secret, r.code AS role_code, r.name AS role_name
     FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=?`, payload.sub);
  if (!u || !u.is_active) return next(unauthorized('Account disabled'));

  req.user = u;
  req.sessionId = sess.id;
  req.permissions = new Set(q.all(
    `SELECT p.code FROM permissions p JOIN role_permissions rp ON rp.permission_id=p.id WHERE rp.role_id=?`,
    u.role_id
  ).map(r => r.code));
  next();
}

function requirePerm(code) {
  return (req, res, next) => {
    if (!req.user) return next(unauthorized());
    if (req.user.role_code === 'ADMIN' || req.permissions.has(code)) return next();
    next(forbidden(`Missing permission: ${code}`));
  };
}

/** Data segregation: contractors see only their organization's documents. */
function scopeFilterFor(user, alias = 'd') {
  if (user.role_code === 'CONTRACTOR') {
    return { sql: ` AND (${alias}.contractor_org_id = ? OR ${alias}.originator_org_id = ? OR ${alias}.created_by = ?)`,
      params: [user.organization_id, user.organization_id, user.id] };
  }
  return { sql: '', params: [] };
}

function assertCanSeeDocument(user, doc) {
  if (user.role_code === 'CONTRACTOR') {
    const visible = doc.contractor_org_id === user.organization_id ||
      doc.originator_org_id === user.organization_id ||
      doc.created_by === user.id;
    if (!visible) throw forbidden('You are not permitted to access this document');
  }
}

module.exports = { requireAuth, requirePerm, scopeFilterFor, assertCanSeeDocument };
