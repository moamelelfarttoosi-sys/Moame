'use strict';
const express = require('express');
const { q } = require('../db');
const { ah, ok, badRequest, notFound } = require('../lib/http');
const { requireAuth, requirePerm } = require('../lib/auth');
const { audit } = require('../lib/audit');
const { resolveRouting } = require('../lib/ddm');

const router = express.Router();
router.use(requireAuth);

router.get('/', requirePerm('ddm.manage'), ah(async (req, res) => {
  ok(res, q.all(
    `SELECT r.*, u1.full_name AS reviewer1_name, u2.full_name AS reviewer2_name,
            ue.full_name AS endorser_name, ua.full_name AS approver_name
     FROM ddm_rules r
     LEFT JOIN users u1 ON u1.id=r.reviewer1_user_id
     LEFT JOIN users u2 ON u2.id=r.reviewer2_user_id
     LEFT JOIN users ue ON ue.id=r.endorser_user_id
     LEFT JOIN users ua ON ua.id=r.approver_user_id
     ORDER BY r.id`));
}));

router.post('/', requirePerm('ddm.manage'), ah(async (req, res) => {
  const b = req.body || {};
  const rule = q.run(
    `INSERT INTO ddm_rules (discipline_code, doc_type_code, class_code, originator_code,
       reviewer1_user_id, reviewer2_user_id, endorser_user_id, approver_user_id, approver_role_code,
       copy_to, business_process_level, purpose_id, remarks)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    b.discipline_code || '*', b.doc_type_code || '*', b.class_code || '*', b.originator_code || '*',
    b.reviewer1_user_id || null, b.reviewer2_user_id || null, b.endorser_user_id || null,
    b.approver_user_id || null, b.approver_role_code || 'APPROVER',
    JSON.stringify(b.copy_to || []), b.business_process_level || null, b.purpose_id || null, b.remarks || null);
  audit({ user: req.user, action: 'CREATE', entityType: 'DDM_RULE', entityId: Number(rule.lastInsertRowid), next: req.body });
  res.status(201).json({ data: q.get(`SELECT * FROM ddm_rules WHERE id=?`, Number(rule.lastInsertRowid)) });
}));

router.put('/:id', requirePerm('ddm.manage'), ah(async (req, res) => {
  const id = Number(req.params.id);
  const prev = q.get(`SELECT * FROM ddm_rules WHERE id=?`, id);
  if (!prev) throw notFound('DDM rule not found');
  const sets = [], params = [];
  for (const k of ['discipline_code', 'doc_type_code', 'class_code', 'originator_code', 'reviewer1_user_id',
    'reviewer2_user_id', 'endorser_user_id', 'approver_user_id', 'approver_role_code', 'business_process_level', 'purpose_id', 'is_active', 'remarks']) {
    if (req.body[k] !== undefined) { sets.push(`${k}=?`); params.push(req.body[k]); }
  }
  if (req.body.copy_to !== undefined) { sets.push('copy_to=?'); params.push(JSON.stringify(req.body.copy_to)); }
  if (!sets.length) throw badRequest('Nothing to update');
  params.push(id);
  q.run(`UPDATE ddm_rules SET ${sets.join(',')} WHERE id=?`, ...params);
  audit({ user: req.user, action: 'EDIT', entityType: 'DDM_RULE', entityId: id, prev, next: req.body });
  ok(res, q.get(`SELECT * FROM ddm_rules WHERE id=?`, id));
}));

/** Preview routing resolution for a document profile */
router.get('/resolve', ah(async (req, res) => {
  const routing = resolveRouting({
    discipline: req.query.discipline || '*', docType: req.query.doc_type || '*',
    klass: req.query.class || '*', originator: req.query.originator || '*'
  });
  ok(res, routing || { resolved: false });
}));

module.exports = router;
