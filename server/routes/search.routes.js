'use strict';
const express = require('express');
const { q } = require('../db');
const { ah, ok, badRequest, pagination } = require('../lib/http');
const { requireAuth, requirePerm, scopeFilterFor } = require('../lib/auth');
const { audit } = require('../lib/audit');
const { exportResultSet } = require('../lib/exporter');

const router = express.Router();
router.use(requireAuth);

/** Searchable/filterable field registry -> SQL expressions */
const FIELDS = {
  doc_number: 'd.doc_number',
  title: 'd.title',
  doc_type: `t.code`,
  category: `cat.code`,
  project: `p.code`,
  contract: `c.number`,
  discipline: `disc.code`,
  organization: `oo.code`,
  customer: `co.name`,
  contractor: `ko.name`,
  department: `dep.name`,
  area: 'd.area',
  system: 'd.system',
  phase: 'd.phase',
  purpose: `pur.code`,
  internal_status: 'ist.code',
  external_status: 'est.code',
  revision: `(SELECT r.revision_code FROM document_revisions r WHERE r.document_id=d.id AND r.is_current=1 LIMIT 1)`,
  receipt_date: 'd.receipt_date',
  accept_date: 'd.accept_date',
  document_date: 'd.document_date',
  due_date: 'd.due_date',
  review_due_date: 'd.review_due_date',
  registered_at: 'd.registered_at',
  endorser: `eu.full_name`,
  dcc: `du.full_name`,
  reviewer: `ru.full_name`,
  approver: `au.full_name`,
  transmittal: 'd.transmittal_ref',
  correspondence_ref: 'd.correspondence_ref',
  confidentiality: 'd.confidentiality',
  archive_status: 'd.archive_status',
  // UEF Document Control fields
  register_type: 'd.register_type',
  prid: 'd.prid',
  so_po: 'd.so_po',
  class: 'd.class_code',
  department_code: 'd.department_code',
  section_code: 'd.section_code',
  originator_code: 'd.originator_code',
  numbering_scheme: 'd.numbering_scheme'
};

const SORTABLE = new Set(Object.keys(FIELDS));

/** Result grid default columns */
const GRID_COLUMNS = [
  { key: 'accept_date', label: 'Accept Date', sql: `d.accept_date` },
  { key: 'doc_number', label: 'Document Number', sql: 'd.doc_number' },
  { key: 'revision', label: 'Revision', sql: `(SELECT r.revision_code FROM document_revisions r WHERE r.document_id=d.id AND r.is_current=1 LIMIT 1)` },
  { key: 'title', label: 'Title', sql: 'd.title' },
  { key: 'internal_status_code', label: 'Internal Status', sql: 'ist.code' },
  { key: 'external_status_code', label: 'External Status', sql: 'est.code' },
  { key: 'customer_name', label: 'Customer', sql: `co.name` },
  { key: 'contract_number', label: 'Contract', sql: 'c.number' },
  { key: 'discipline_code', label: 'Discipline', sql: 'disc.code' },
  { key: 'doc_type_code', label: 'Doc Type', sql: 't.code' },
  { key: 'dcc_name', label: 'DCC', sql: `du.username` },
  { key: 'reviewer_name', label: 'Reviewer', sql: `ru.full_name` },
  { key: 'endorser_name', label: 'Endorser', sql: `eu.full_name` },
  { key: 'approver_name', label: 'Approver', sql: `au.full_name` },
  { key: 'project_code', label: 'Project', sql: 'p.code' },
  { key: 'receipt_date', label: 'Receipt Date', sql: 'd.receipt_date' },
  { key: 'purpose_name', label: 'Purpose of Issue', sql: `pur.name` },
  { key: 'register_type', label: 'Register', sql: 'd.register_type' },
  { key: 'prid', label: 'PRID', sql: 'd.prid' },
  { key: 'so_po', label: 'SO/PO', sql: 'd.so_po' },
  { key: 'class_code', label: 'Class', sql: 'd.class_code' },
  { key: 'department_code', label: 'Dept', sql: 'd.department_code' },
  { key: 'section_code', label: 'Section', sql: 'd.section_code' },
  { key: 'originator_code', label: 'Originator', sql: 'd.originator_code' }
];

function buildFilterSql(filters, logic) {
  const clauses = [], params = [];
  const OPS = {
    eq: '=', neq: '<>', contains: 'LIKE', starts: 'LIKE',
    gt: '>', gte: '>=', lt: '<', lte: '<='
  };
  for (const f of filters || []) {
    const expr = FIELDS[f.field];
    if (!expr) continue;
    const op = (f.op || 'eq').toLowerCase();
    if (op === 'between') {
      clauses.push(`${expr} >= ? AND ${expr} <= ?`);
      params.push(f.value, f.value2);
    } else if (op === 'in') {
      if (!Array.isArray(f.value) || !f.value.length) continue;
      clauses.push(`${expr} IN (${f.value.map(() => '?').join(',')})`);
      params.push(...f.value);
    } else if (op === 'contains') {
      clauses.push(`${expr} LIKE ?`);
      params.push(`%${f.value}%`);
    } else if (op === 'starts') {
      clauses.push(`${expr} LIKE ?`);
      params.push(`${f.value}%`);
    } else if ((op === 'eq' || op === 'neq') && (f.value === null || f.value === undefined)) {
      clauses.push(`${expr} IS ${op === 'eq' ? 'NULL' : 'NOT NULL'}`);
    } else if (OPS[op]) {
      clauses.push(`${expr} ${OPS[op]} ?`);
      params.push(f.value);
    }
  }
  if (!clauses.length) return { sql: '', params };
  return { sql: `(${clauses.join(` ${logic === 'OR' ? 'OR' : 'AND'} `)})`, params };
}

function runSearch(user, body) {
  const logic = (body.logic === 'OR' ? 'OR' : 'AND');
  const { page, pageSize, limit, offset } = pagination({ ...body }, 25, 1000);

  const base = `
    FROM documents d
    JOIN statuses ist ON ist.id=d.internal_status_id
    LEFT JOIN statuses est ON est.id=d.external_status_id
    LEFT JOIN projects p ON p.id=d.project_id
    JOIN document_types t ON t.id=d.doc_type_id
    LEFT JOIN contracts c ON c.id=d.contract_id
    LEFT JOIN disciplines disc ON disc.id=d.discipline_id
    LEFT JOIN organizations oo ON oo.id=d.originator_org_id
    LEFT JOIN organizations co ON co.id=d.customer_org_id
    LEFT JOIN organizations ko ON ko.id=d.contractor_org_id
    LEFT JOIN departments dep ON dep.id=d.department_id
    LEFT JOIN purposes pur ON pur.id=d.purpose_id
    LEFT JOIN categories cat ON cat.id=d.category_id
    LEFT JOIN users eu ON eu.id=d.endorser_user_id
    LEFT JOIN users du ON du.id=d.dcc_user_id
    LEFT JOIN users ru ON ru.id=d.reviewer_user_id
    LEFT JOIN users au ON au.id=d.approver_user_id`;

  const conds = [`d.deleted_at IS NULL`];
  const filterRes = buildFilterSql(body.filters, logic);
  if (filterRes.sql) conds.push(filterRes.sql);

  // data segregation
  if (user.role_code === 'CONTRACTOR') {
    conds.push(`(d.contractor_org_id=? OR d.originator_org_id=? OR d.created_by=?)`);
    filterRes.params.push(user.organization_id, user.organization_id, user.id);
  }

  const whereSql = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

  // multi-level sorting
  let orderParts = [];
  for (const s of (body.sort || [])) {
    if (SORTABLE.has(s.field)) {
      orderParts.push(`${FIELDS[s.field]} COLLATE NOCASE ${String(s.dir).toLowerCase() === 'desc' ? 'DESC' : 'ASC'}`);
    }
  }
  orderParts.push('d.id DESC');

  // selected output columns (unknown/empty selection falls back to the default grid)
  const wanted = Array.isArray(body.columns) && body.columns.length ? body.columns : null;
  let cols = wanted ? GRID_COLUMNS.filter(c => wanted.includes(c.key)) : GRID_COLUMNS;
  if (!cols.length) cols = GRID_COLUMNS;

  const colSql = cols.map(c => `${c.sql} AS "${c.key}"`).join(', ');
  const rows = q.all(
    `SELECT d.id AS _id, ${colSql} ${base} ${whereSql}
     ORDER BY ${orderParts.join(', ')} LIMIT ? OFFSET ?`,
    ...filterRes.params, limit, offset);
  const total = q.get(`SELECT COUNT(*) c ${base} ${whereSql}`, ...filterRes.params).c;

  return { rows, total, cols, page, pageSize };
}

router.post('/', ah(async (req, res) => {
  const { rows, total, cols, page, pageSize } = runSearch(req.user, req.body || {});
  ok(res, rows.map(r => ({ id: r._id, cells: r })), {
    page, pageSize, total, columns: cols.map(c => ({ key: c.key, label: c.label }))
  });
}));

// Export using identical search payload
router.post('/export', requirePerm('report.export'), ah(async (req, res) => {
  const format = (req.body.format || 'csv').toLowerCase();
  const { rows, cols } = runSearch(req.user, { ...req.body });
  const plain = rows.map(r => {
    const o = {};
    for (const c of cols) o[c.key] = r[c.key];
    return o;
  });
  const file = exportResultSet({
    format, title: req.body.title || 'IDMS-Search-Results',
    columns: cols.map(c => ({ key: c.key, label: c.label })), rows: plain, user: req.user
  });
  res.json({ data: { download: `/api/files/export/${encodeURIComponent(file.filename)}`, filename: file.filename, rows: plain.length } });
}));

// Saved searches & shared templates
router.get('/templates', ah(async (req, res) => {
  ok(res, q.all(
    `SELECT id, name, definition, is_shared_template FROM saved_searches
     WHERE user_id=? OR is_shared_template=1 ORDER BY is_shared_template, name`, req.user.id));
}));

router.post('/templates', ah(async (req, res) => {
  const { name, definition, is_shared_template } = req.body || {};
  if (!name || !definition) throw badRequest('name and definition required');
  JSON.parse(JSON.stringify(definition));
  try {
    const r = q.run(
      `INSERT INTO saved_searches (user_id, name, definition, is_shared_template) VALUES (?,?,?,?)`,
      req.user.id, name, JSON.stringify(definition), is_shared_template ? 1 : 0);
    res.status(201).json({ data: { id: Number(r.lastInsertRowid), name } });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) throw badRequest('You already have a template with this name');
    throw e;
  }
}));

router.delete('/templates/:id', ah(async (req, res) => {
  const row = q.get(`SELECT * FROM saved_searches WHERE id=?`, Number(req.params.id));
  if (!row) throw badRequest('Template not found');
  if (row.user_id !== req.user.id) { if (req.user.role_code !== 'ADMIN') throw badRequest('Not your template'); }
  q.run(`DELETE FROM saved_searches WHERE id=?`, row.id);
  audit({ user: req.user, action: 'DELETE', entityType: 'SAVED_SEARCH', entityId: row.id, prev: { name: row.name } });
  ok(res, { deleted: true });
}));

// Column metadata for the search workbench UI
router.get('/columns', ah(async (req, res) => {
  ok(res, GRID_COLUMNS.map(c => ({ key: c.key, label: c.label })));
}));

module.exports = router;
