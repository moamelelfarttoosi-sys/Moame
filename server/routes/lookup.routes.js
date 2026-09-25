'use strict';
const express = require('express');
const { q } = require('../db');
const { ah, ok } = require('../lib/http');
const { requireAuth } = require('../lib/auth');

const router = express.Router();
router.use(requireAuth);

/** Master-data lookups for any authenticated user (forms & filters). */
const LOOKUPS = {
  organizations: 'SELECT id, code, name, org_type FROM organizations WHERE is_active=1 ORDER BY name',
  departments: 'SELECT id, code, name FROM departments WHERE is_active=1 ORDER BY name',
  projects: 'SELECT id, code, name FROM projects WHERE is_active=1 ORDER BY code',
  contracts: 'SELECT id, number AS code, title AS name FROM contracts WHERE is_active=1 ORDER BY number',
  disciplines: 'SELECT id, code, name FROM disciplines WHERE is_active=1 ORDER BY code',
  document_types: 'SELECT id, code, name FROM document_types WHERE is_active=1 ORDER BY code',
  categories: 'SELECT id, code, name FROM categories WHERE is_active=1 ORDER BY code',
  purposes: 'SELECT id, code, name FROM purposes WHERE is_active=1 ORDER BY code',
  statuses: 'SELECT id, code, name, scope, color FROM statuses WHERE is_active=1 ORDER BY phase, code',
  retention_rules: 'SELECT id, code, name FROM retention_rules WHERE is_active=1 ORDER BY code'
};

for (const [table, sql] of Object.entries(LOOKUPS)) {
  router.get(`/${table}`, ah(async (req, res) => {
    if (req.query.active_only === '0') {
      return ok(res, q.all(sql.replace('WHERE is_active=1', '')));
    }
    ok(res, q.all(sql));
  }));
}

/** UEFL controlled-code lookups for Document Registration form */
router.get('/uefl/departments', ah(async (req, res) => {
  ok(res, q.all(`SELECT id, code, description AS name FROM controlled_codes
    WHERE code_set='DEPARTMENT' AND lifecycle='active' ORDER BY sort_order, code`));
}));
router.get('/uefl/sections', ah(async (req, res) => {
  ok(res, q.all(`SELECT id, code, description AS name FROM controlled_codes
    WHERE code_set='SECTION' AND lifecycle='active' ORDER BY sort_order, code`));
}));
router.get('/uefl/originators', ah(async (req, res) => {
  ok(res, q.all(`SELECT id, code, description AS name FROM controlled_codes
    WHERE code_set='ORIGINATOR' AND lifecycle='active' ORDER BY sort_order, code`));
}));
router.get('/uefl/classes', ah(async (req, res) => {
  ok(res, q.all(`SELECT id, code, description AS name FROM controlled_codes
    WHERE code_set='CLASS' AND lifecycle='active' ORDER BY sort_order, code`));
}));

router.get('/users', ah(async (req, res) => {
  ok(res, q.all(
    `SELECT u.id, u.username, u.full_name, r.code AS role_code FROM users u
     JOIN roles r ON r.id=u.role_id WHERE u.is_active=1 ORDER BY u.full_name`));
}));

module.exports = router;
