'use strict';
const express = require('express');
const crypto = require('crypto');
const { q } = require('../db');
const { hashPassword } = require('../lib/passwords');
const { generateSecret, totpNow } = require('../lib/totp');
const { audit } = require('../lib/audit');
const { ah, ok, badRequest, notFound, conflict, pagination } = require('../lib/http');
const { requireAuth, requirePerm } = require('../lib/auth');

const router = express.Router();
router.use(requireAuth);

// ---------------- Generic master-data CRUD (whitelisted tables) ----------------
// Every taxonomy table: id/code/name/is_active (+ optional extra columns)
const TAXONOMY = {
  organizations: ['code', 'name', 'org_type', 'contact_name', 'contact_email'],
  departments: ['code', 'name'],
  projects: ['code', 'name', 'lifecycle_stage', 'status', 'customer_org_id', 'archive_trigger_stage'],
  contracts: ['number', 'title', 'project_id', 'customer_org_id', 'contractor_org_id', 'status'],
  disciplines: ['code', 'name'],
  document_types: ['code', 'name', 'requires_review', 'requires_endorsement', 'requires_approval', 'numbering_rule_id'],
  categories: ['code', 'name'],
  purposes: ['code', 'name'],
  retention_rules: ['code', 'name', 'retention_years', 'description'],
  statuses: ['code', 'name', 'scope', 'phase', 'color', 'is_initial', 'is_terminal']
};

function listTaxonomy(table, orderCol = 'code') {
  return (req, res) => {
    const { page, pageSize, limit, offset } = pagination(req.query, 200, 1000);
    const where = req.query.active_only === '1' ? 'WHERE is_active=1' : '';
    const rows = q.all(`SELECT * FROM ${table} ${where} ORDER BY ${orderCol} LIMIT ? OFFSET ?`, limit, offset);
    const total = q.get(`SELECT COUNT(*) c FROM ${table} ${where}`).c;
    ok(res, rows, { page, pageSize, total });
  };
}

function createTaxonomy(table, fields) {
  return ah(async (req, res) => {
    const vals = {};
    for (const f of fields) if (req.body[f] !== undefined) vals[f] = req.body[f];
    const identityCol = fields[0]; // natural identity per table: code, number, ...
    if (vals[identityCol] === undefined || String(vals[identityCol]).trim() === '') {
      throw badRequest(`'${identityCol}' is required`);
    }
    const cols = Object.keys(vals);
    try {
      const r = q.run(
        `INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`,
        ...cols.map(c => vals[c])
      );
      const row = q.get(`SELECT * FROM ${table} WHERE id=?`, Number(r.lastInsertRowid));
      audit({ user: req.user, action: 'CREATE', entityType: table.toUpperCase(), entityId: row.id, next: vals });
      res.status(201).json({ data: row });
    } catch (e) {
      if (String(e.message).includes('UNIQUE')) throw conflict(`Value already exists in ${table}`);
      throw e;
    }
  });
}

function updateTaxonomy(table, fields) {
  return ah(async (req, res) => {
    const id = Number(req.params.id);
    const prev = q.get(`SELECT * FROM ${table} WHERE id=?`, id);
    if (!prev) throw notFound('Record not found');
    const sets = [], params = [];
    for (const f of fields) {
      if (req.body[f] !== undefined) { sets.push(`${f}=?`); params.push(req.body[f]); }
    }
    if (!sets.length) throw badRequest('No fields to update');
    params.push(id);
    q.run(`UPDATE ${table} SET ${sets.join(',')} WHERE id=?`, ...params);
    const row = q.get(`SELECT * FROM ${table} WHERE id=?`, id);
    audit({ user: req.user, action: 'EDIT', entityType: table.toUpperCase(), entityId: id, prev, next: row });
    ok(res, row);
  });
}

function deleteTaxonomy(table) {
  return ah(async (req, res) => {
    const id = Number(req.params.id);
    const prev = q.get(`SELECT * FROM ${table} WHERE id=?`, id);
    if (!prev) throw notFound('Record not found');
    // Soft-deactivate only â€” controlled records are never hard-deleted
    q.run(`UPDATE ${table} SET is_active=0 WHERE id=?`, id);
    audit({ user: req.user, action: 'DEACTIVATE', entityType: table.toUpperCase(), entityId: id, prev });
    ok(res, { deactivated: true });
  });
}

for (const [table, fields] of Object.entries(TAXONOMY)) {
  router.get(`/${table}`, requirePerm('admin.manage'), listTaxonomy(table, fields[0]));
  router.post(`/${table}`, requirePerm('admin.manage'), createTaxonomy(table, fields));
  router.put(`/${table}/:id`, requirePerm('admin.manage'), updateTaxonomy(table, [...fields, 'is_active']));
  router.delete(`/${table}/:id`, requirePerm('admin.manage'), deleteTaxonomy(table));
}
// Public-to-app lookups (any authenticated user needs these for forms)
for (const [table, fields] of Object.entries(TAXONOMY)) {
  router.get(`/lookups/${table}`, listTaxonomy(table, fields[0]));
}
router.get('/lookups/users', ah(async (req, res) => {
  ok(res, q.all(
    `SELECT u.id, u.username, u.full_name, r.code AS role_code FROM users u JOIN roles r ON r.id=u.role_id
     WHERE u.is_active=1 ORDER BY u.full_name`));
}));

// ---------------- Status transition rules ----------------
router.get('/status-transitions', requirePerm('admin.manage'), ah(async (req, res) => {
  ok(res, q.all(
    `SELECT t.*, f.code AS from_code, t2.code AS to_code FROM status_transitions t
     LEFT JOIN statuses f ON f.id=t.from_status_id JOIN statuses t2 ON t2.id=t.to_status_id ORDER BY t.id`));
}));
router.post('/status-transitions', requirePerm('admin.manage'), ah(async (req, res) => {
  const { from_status_id, to_status_id, allowed_roles, reason_required } = req.body;
  if (!to_status_id) throw badRequest('to_status_id required');
  const r = q.run(
    `INSERT INTO status_transitions (from_status_id, to_status_id, allowed_roles, reason_required)
     VALUES (?,?,?,?) ON CONFLICT(from_status_id, to_status_id)
     DO UPDATE SET allowed_roles=excluded.allowed_roles, reason_required=excluded.reason_required`,
    from_status_id ?? null, to_status_id,
    JSON.stringify(allowed_roles || []), reason_required ? 1 : 0
  );
  audit({ user: req.user, action: 'CREATE', entityType: 'STATUS_TRANSITION', entityId: null, next: req.body });
  ok(res, q.all(`SELECT * FROM status_transitions`).slice(-1)[0]);
}));

// ---------------- Users administration ----------------
router.get('/users', requirePerm('admin.manage'), ah(async (req, res) => {
  const { page, pageSize, limit, offset } = pagination(req.query);
  const where = [];
  const params = [];
  if (req.query.search) { where.push('(u.username LIKE ? OR u.full_name LIKE ? OR u.email LIKE ?)'); params.push(`%${req.query.search}%`, `%${req.query.search}%`, `%${req.query.search}%`); }
  const w = where.length ? `AND ${where.join(' AND ')}` : '';
  const rows = q.all(
    `SELECT u.id, u.username, u.email, u.full_name, u.is_active, u.mfa_secret, u.last_login_at,
            u.department_id, u.organization_id, r.code AS role_code, r.name AS role_name,
            d.name AS department_name, o.name AS organization_name
     FROM users u JOIN roles r ON r.id=u.role_id
     LEFT JOIN departments d ON d.id=u.department_id
     LEFT JOIN organizations o ON o.id=u.organization_id
     WHERE 1=1 ${w} ORDER BY u.username LIMIT ? OFFSET ?`, ...params, limit, offset);
  const total = q.get(`SELECT COUNT(*) c FROM users u WHERE 1=1 ${w}`, ...params).c;
  ok(res, rows, { page, pageSize, total });
}));

router.post('/users', requirePerm('admin.manage'), ah(async (req, res) => {
  const { username, email, full_name, password, role_code, department_id, organization_id, phone } = req.body;
  if (!username || !email || !full_name || !password || !role_code) throw badRequest('username, email, full_name, password, role_code are required');
  if (String(password).length < 8) throw badRequest('Password must be at least 8 characters');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) throw badRequest('Invalid email address');
  const role = q.get(`SELECT id FROM roles WHERE code=?`, role_code);
  if (!role) throw badRequest('Unknown role');
  try {
    const r = q.run(
      `INSERT INTO users (username, email, full_name, password_hash, role_id, department_id, organization_id, phone)
       VALUES (?,?,?,?,?,?,?,?)`,
      String(username).trim(), String(email).trim(), full_name, hashPassword(password), role.id,
      department_id ?? null, organization_id ?? null, phone ?? null
    );
    audit({ user: req.user, action: 'CREATE', entityType: 'USER', entityId: Number(r.lastInsertRowid), next: { username, role_code } });
    res.status(201).json({ data: { id: Number(r.lastInsertRowid), username } });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) throw conflict('Username or email already exists');
    throw e;
  }
}));

router.put('/users/:id', requirePerm('admin.manage'), ah(async (req, res) => {
  const id = Number(req.params.id);
  const prev = q.get(`SELECT * FROM users WHERE id=?`, id);
  if (!prev) throw notFound('User not found');
  const sets = [], params = [];
  for (const [k, col] of [['email', 'email'], ['full_name', 'full_name'], ['department_id', 'department_id'], ['organization_id', 'organization_id'], ['phone', 'phone'], ['is_active', 'is_active']]) {
    if (req.body[k] !== undefined) { sets.push(`${col}=?`); params.push(req.body[k]); }
  }
  if (req.body.role_code) {
    const role = q.get(`SELECT id FROM roles WHERE code=?`, req.body.role_code);
    if (!role) throw badRequest('Unknown role');
    sets.push('role_id=?'); params.push(role.id);
  }
  if (!sets.length) throw badRequest('Nothing to update');
  params.push(id);
  q.run(`UPDATE users SET updated_at=datetime('now'), ${sets.join(',')} WHERE id=?`, ...params);
  audit({ user: req.user, action: 'PERMISSION_CHANGE', entityType: 'USER', entityId: id, prev, next: req.body });
  ok(res, { updated: true });
}));

router.post('/users/:id/reset-password', requirePerm('admin.manage'), ah(async (req, res) => {
  const id = Number(req.params.id);
  const pwd = req.body.password || ('Idms-' + crypto.randomBytes(4).toString('hex'));
  q.run(`UPDATE users SET password_hash=?, updated_at=datetime('now') WHERE id=?`, hashPassword(pwd), id);
  q.run(`UPDATE sessions SET revoked_at=datetime('now') WHERE user_id=?`, id);
  audit({ user: req.user, action: 'PASSWORD_RESET', entityType: 'USER', entityId: id });
  ok(res, { temporary_password: pwd });
}));

/** MFA enrollment by admin (returns current TOTP so the admin can hand over an authenticator seed) */
router.post('/users/:id/mfa-enable', requirePerm('admin.manage'), ah(async (req, res) => {
  const id = Number(req.params.id);
  const secret = generateSecret();
  q.run(`UPDATE users SET mfa_secret=?, updated_at=datetime('now') WHERE id=?`, secret, id);
  audit({ user: req.user, action: 'MFA_ENABLE', entityType: 'USER', entityId: id });
  ok(res, { secret, sample_code: totpNow(secret) });
}));

router.post('/users/:id/mfa-disable', requirePerm('admin.manage'), ah(async (req, res) => {
  const id = Number(req.params.id);
  q.run(`UPDATE users SET mfa_secret=NULL WHERE id=?`, id);
  audit({ user: req.user, action: 'MFA_DISABLE', entityType: 'USER', entityId: id });
  ok(res, { ok: true });
}));

// ---------------- Roles & permissions ----------------
router.get('/roles', requirePerm('admin.manage'), ah(async (req, res) => {
  ok(res, q.all(`SELECT * FROM roles ORDER BY id`));
}));
router.get('/permissions', requirePerm('admin.manage'), ah(async (req, res) => {
  ok(res, q.all(
    `SELECT p.*, CASE WHEN rp.role_id IS NOT NULL THEN 1 ELSE 0 END AS granted, rp.role_id
     FROM permissions p LEFT JOIN role_permissions rp ON rp.permission_id=p.id AND rp.role_id=?
     ORDER BY p.domain, p.code`, Number(req.query.role_id || 0)));
}));
router.put('/roles/:roleId/permissions', requirePerm('admin.manage'), ah(async (req, res) => {
  const roleId = Number(req.params.roleId);
  const { permission_codes } = req.body; // full replacement list
  if (!Array.isArray(permission_codes)) throw badRequest('permission_codes array required');
  q.tx(() => {
    q.run(`DELETE FROM role_permissions WHERE role_id=?`, roleId);
    for (const code of permission_codes) {
      const p = q.get(`SELECT id FROM permissions WHERE code=?`, code);
      if (p) q.run(`INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?,?)`, roleId, p.id);
    }
  });
  audit({ user: req.user, action: 'PERMISSION_CHANGE', entityType: 'ROLE', entityId: roleId, next: { permission_codes } });
  ok(res, { ok: true });
}));

// ---------------- Numbering rules ----------------
router.get('/numbering-rules', requirePerm('admin.manage'), ah(async (req, res) => {
  ok(res, q.all(`SELECT * FROM numbering_rules ORDER BY id`));
}));
router.post('/numbering-rules', requirePerm('admin.manage'), ah(async (req, res) => {
  const { code, name, entity_type, pattern, sequence_length, sequence_scope, revision_style, separator } = req.body;
  if (!code || !pattern) throw badRequest('code and pattern required');
  JSON.parse(pattern); // validate JSON
  const r = q.run(
    `INSERT INTO numbering_rules (code, name, entity_type, pattern, sequence_length, sequence_scope, revision_style, separator)
     VALUES (?,?,?,?,?,?,?,?)`,
    code, name || code, entity_type || 'DOCUMENT', pattern,
    sequence_length || 4, sequence_scope || 'RULE_YEAR_PROJECT', revision_style || 'numeric0', separator || '-');
  audit({ user: req.user, action: 'CREATE', entityType: 'NUMBERING_RULE', entityId: Number(r.lastInsertRowid), next: req.body });
  res.status(201).json({ data: q.get(`SELECT * FROM numbering_rules WHERE id=?`, Number(r.lastInsertRowid)) });
}));
router.put('/numbering-rules/:id', requirePerm('admin.manage'), ah(async (req, res) => {
  const id = Number(req.params.id);
  const prev = q.get(`SELECT * FROM numbering_rules WHERE id=?`, id);
  if (!prev) throw notFound('Rule not found');
  const sets = [], params = [];
  for (const k of ['name', 'entity_type', 'pattern', 'sequence_length', 'sequence_scope', 'revision_style', 'separator', 'is_active']) {
    if (req.body[k] !== undefined) { sets.push(`${k}=?`); params.push(k === 'pattern' ? JSON.stringify(JSON.parse(req.body[k])) : req.body[k]); }
  }
  if (!sets.length) throw badRequest('Nothing to update');
  params.push(id);
  q.run(`UPDATE numbering_rules SET ${sets.join(',')} WHERE id=?`, ...params);
  audit({ user: req.user, action: 'EDIT', entityType: 'NUMBERING_RULE', entityId: id, prev, next: req.body });
  ok(res, q.get(`SELECT * FROM numbering_rules WHERE id=?`, id));
}));
router.get('/numbering-history', requirePerm('admin.manage'), ah(async (req, res) => {
  const { page, pageSize, limit, offset } = pagination(req.query);
  const rows = q.all(`SELECT h.*, r.code AS rule_code FROM numbering_history h JOIN numbering_rules r ON r.id=h.rule_id
                      ORDER BY h.id DESC LIMIT ? OFFSET ?`, limit, offset);
  const total = q.get(`SELECT COUNT(*) c FROM numbering_history`).c;
  ok(res, rows, { page, pageSize, total });
}));

// ---------------- Workflow templates ----------------
router.get('/workflows', requirePerm('admin.manage'), ah(async (req, res) => {
  ok(res, q.all(
    `SELECT w.*, v.version_no, v.definition, v.is_active AS version_active
     FROM workflows w LEFT JOIN workflow_versions v ON v.workflow_id=w.id AND v.is_active=1 ORDER BY w.id`));
}));
router.post('/workflows', requirePerm('admin.manage'), ah(async (req, res) => {
  const { code, name, description, entity_type, steps } = req.body;
  if (!code || !Array.isArray(steps) || !steps.length) throw badRequest('code and non-empty steps[] required');
  for (const s of steps) {
    if (!s.key || !s.name || !['task', 'review', 'endorsement', 'approval', 'notification'].includes(s.type)) {
      throw badRequest('Each step requires key, name and a valid type');
    }
  }
  const r = q.tx(() => {
    const wf = q.run(`INSERT INTO workflows (code, name, description, entity_type) VALUES (?,?,?,?)`,
      code, name || code, description || '', entity_type || 'DOCUMENT');
    const wfId = Number(wf.lastInsertRowid);
    q.run(`INSERT INTO workflow_versions (workflow_id, version_no, definition, created_by) VALUES (?,1,?,?)`,
      wfId, JSON.stringify({ steps }), req.user.id);
    return wfId;
  });
  audit({ user: req.user, action: 'CREATE', entityType: 'WORKFLOW', entityId: r, next: { code, steps } });
  res.status(201).json({ data: { id: r } });
}));
router.put('/workflows/:id/new-version', requirePerm('admin.manage'), ah(async (req, res) => {
  const id = Number(req.params.id);
  const { steps } = req.body;
  if (!Array.isArray(steps) || !steps.length) throw badRequest('steps[] required');
  const lastV = q.get(`SELECT MAX(version_no) m FROM workflow_versions WHERE workflow_id=?`, id).m || 0;
  q.tx(() => {
    q.run(`UPDATE workflow_versions SET is_active=0 WHERE workflow_id=?`, id);
    q.run(`INSERT INTO workflow_versions (workflow_id, version_no, definition, created_by) VALUES (?,?,?,?)`,
      id, lastV + 1, JSON.stringify({ steps }), req.user.id);
  });
  audit({ user: req.user, action: 'EDIT', entityType: 'WORKFLOW', entityId: id, next: { new_version: lastV + 1, steps } });
  ok(res, { version_no: lastV + 1 });
}));

// ---------------- Notification rules ----------------
router.get('/notification-rules', requirePerm('admin.manage'), ah(async (req, res) => {
  ok(res, q.all(`SELECT * FROM notification_rules ORDER BY event_code`));
}));
router.put('/notification-rules/:id', requirePerm('admin.manage'), ah(async (req, res) => {
  const id = Number(req.params.id);
  const prev = q.get(`SELECT * FROM notification_rules WHERE id=?`, id);
  if (!prev) throw notFound('Rule not found');
  const sets = [], params = [];
  for (const k of ['inapp_enabled', 'email_enabled', 'target_mode', 'target_role_code', 'is_active']) {
    if (req.body[k] !== undefined) { sets.push(`${k}=?`); params.push(req.body[k]); }
  }
  if (sets.length) { params.push(id); q.run(`UPDATE notification_rules SET ${sets.join(',')} WHERE id=?`, ...params); }
  audit({ user: req.user, action: 'EDIT', entityType: 'NOTIFICATION_RULE', entityId: id, prev, next: req.body });
  ok(res, q.get(`SELECT * FROM notification_rules WHERE id=?`, id));
}));

// ---------------- SLA rules ----------------
router.get('/sla-rules', requirePerm('admin.manage'), ah(async (req, res) => {
  ok(res, q.all(`SELECT * FROM sla_rules ORDER BY entity_type, priority`));
}));
router.post('/sla-rules', requirePerm('admin.manage'), ah(async (req, res) => {
  const { code, entity_type, doc_type_id, priority, days, escalate_after_days } = req.body;
  if (!code || !entity_type || !days) throw badRequest('code, entity_type, days required');
  const r = q.run(
    `INSERT INTO sla_rules (code, entity_type, doc_type_id, priority, days, escalate_after_days) VALUES (?,?,?,?,?,?)`,
    code, entity_type, doc_type_id ?? null, priority ?? null, days, escalate_after_days ?? null);
  audit({ user: req.user, action: 'CREATE', entityType: 'SLA_RULE', entityId: Number(r.lastInsertRowid), next: req.body });
  const row = q.get(`SELECT * FROM sla_rules WHERE id=?`, Number(r.lastInsertRowid));
  res.status(201).json({ data: row });
}));

// ---------------- System configuration ----------------
router.get('/configurations', requirePerm('admin.manage'), ah(async (req, res) => {
  ok(res, q.all(`SELECT * FROM configurations ORDER BY key`));
}));
router.put('/configurations/:key', requirePerm('admin.manage'), ah(async (req, res) => {
  const key = req.params.key;
  const { value, description } = req.body;
  if (value === undefined) throw badRequest('value required');
  q.run(
    `INSERT INTO configurations (key, value, description, updated_by, updated_at) VALUES (?,?,?,?,datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value=excluded.value, description=excluded.description,
       updated_by=excluded.updated_by, updated_at=datetime('now')`,
    key, String(value), description ?? null, req.user.id);
  audit({ user: req.user, action: 'CONFIGURATION_CHANGE', entityType: 'CONFIGURATION', entityId: null, next: { key, value } });
  ok(res, { key, value });
}));

module.exports = router;
