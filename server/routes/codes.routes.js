'use strict';
const express = require('express');
const { q } = require('../db');
const { ah, ok, badRequest, notFound } = require('../lib/http');
const { requireAuth, requirePerm } = require('../lib/auth');
const { audit } = require('../lib/audit');
const { CODE_SETS, listCodes, setLifecycle } = require('../lib/codes');

const router = express.Router();
router.use(requireAuth);

/** Lookup for forms — active codes only (mounted at /api/codes) */
router.get('/:codeSet', ah(async (req, res) => {
  const cs = String(req.params.codeSet).toUpperCase();
  if (!CODE_SETS.includes(cs)) throw badRequest(`Unknown code set: ${cs}`);
  ok(res, listCodes(cs, { includeInactive: req.query.all === '1' && req.user.role_code === 'ADMIN' }));
}));

// ---- Administration (governance) ----
router.get('/admin/codes', requirePerm('codes.manage'), ah(async (req, res) => {
  const where = req.query.code_set ? 'WHERE code_set=?' : '';
  const params = req.query.code_set ? [req.query.code_set] : [];
  ok(res, q.all(`SELECT c.*, u.username AS updated_by_name FROM controlled_codes c
                 LEFT JOIN users u ON u.id=c.updated_by ${where} ORDER BY c.code_set, c.sort_order, c.code`, ...params));
}));

router.post('/admin/codes', requirePerm('codes.manage'), ah(async (req, res) => {
  const { code_set, code, description, sort_order } = req.body || {};
  if (!CODE_SETS.includes(String(code_set).toUpperCase())) throw badRequest('Invalid code_set');
  if (!code || !description) throw badRequest('code and description required');
  if (!/^[A-Z0-9]{1,10}$/i.test(String(code))) throw badRequest('Code must be 1-10 alphanumeric characters');
  try {
    const r = q.run(
      `INSERT INTO controlled_codes (code_set, code, description, sort_order, updated_by) VALUES (?,?,?,?,?)`,
      String(code_set).toUpperCase(), String(code).toUpperCase(), description, sort_order || 0, req.user.id);
    audit({ user: req.user, action: 'CREATE', entityType: 'CONTROLLED_CODE', entityId: Number(r.lastInsertRowid), next: req.body });
    res.status(201).json({ data: q.get(`SELECT * FROM controlled_codes WHERE id=?`, Number(r.lastInsertRowid)) });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) throw badRequest(`Code "${code}" already exists in ${code_set}`);
    throw e;
  }
}));

router.put('/admin/codes/:id', requirePerm('codes.manage'), ah(async (req, res) => {
  const id = Number(req.params.id);
  const prev = q.get(`SELECT * FROM controlled_codes WHERE id=?`, id);
  if (!prev) throw notFound('Code not found');
  const sets = [], params = [];
  if (req.body.description !== undefined) { sets.push('description=?'); params.push(req.body.description); }
  if (req.body.sort_order !== undefined) { sets.push('sort_order=?'); params.push(req.body.sort_order); }
  if (req.body.lifecycle !== undefined) {
    const row = setLifecycle(id, req.body.lifecycle, req.user.id);
    audit({ user: req.user, action: 'CODE_LIFECYCLE', entityType: 'CONTROLLED_CODE', entityId: id, prev: { lifecycle: prev.lifecycle }, next: { lifecycle: row.lifecycle } });
    return ok(res, row);
  }
  if (!sets.length) throw badRequest('Nothing to update');
  params.push(id);
  q.run(`UPDATE controlled_codes SET ${sets.join(',')}, updated_at=datetime('now'), updated_by=? WHERE id=?`, req.user.id, ...params);
  audit({ user: req.user, action: 'EDIT', entityType: 'CONTROLLED_CODE', entityId: id, prev, next: req.body });
  ok(res, q.get(`SELECT * FROM controlled_codes WHERE id=?`, id));
}));

// Codes are never physically deleted (governance rule 14)
router.delete('/admin/codes/:id', ah(async () => {
  throw badRequest('Codes are never deleted — use lifecycle: active → inactive → retired');
}));

module.exports = router;
