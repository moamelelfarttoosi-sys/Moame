'use strict';
const express = require('express');
const { q } = require('../db');
const { ah, ok, badRequest, notFound, pagination } = require('../lib/http');
const { requireAuth, requirePerm } = require('../lib/auth');
const { audit } = require('../lib/audit');
const { allocateNumber, gapCheck } = require('../lib/uefNumbering');
const { assertCode } = require('../lib/codes');
const { notify } = require('../lib/notify');

const router = express.Router();
router.use(requireAuth);

/** Request â†’ Validate â†’ Check Series â†’ Generate â†’ Allocate â†’ Record â†’ Lock */
router.post('/', requirePerm('number.allocate'), ah(async (req, res) => {
  const b = req.body || {};
  if (!b.proposed_title) throw badRequest('Proposed title required');
  if (typeof b.proposed_title !== 'string') throw badRequest('proposed_title must be a string');
  if (b.proposed_title.length > 500) throw badRequest('proposed_title exceeds 500 characters');
  if (!b.scheme || !['CORPORATE', 'PROJECT'].includes(b.scheme)) throw badRequest('scheme must be CORPORATE or PROJECT');

  // validate controlled codes + series parameters up-front
  if (b.scheme === 'CORPORATE') {
    assertCode('DEPARTMENT', b.department, { allowEmpty: false });
    assertCode('SECTION', b.section, { allowEmpty: false });
  } else {
    if (!b.prid || !/^\d{3,6}$/.test(String(b.prid))) throw badRequest('PRID required for project numbers (3-6 digits, e.g. 3120)');
    if (!(b.ss || b.so_po) || !/^\d{1,2}$/.test(String(b.ss || b.so_po))) throw badRequest('Service Order / SS required (e.g. 01)');
    assertCode('DISCIPLINE', b.discipline, { allowEmpty: false });
    if (b.requesting_department) assertCode('DEPARTMENT', b.requesting_department);
  }
  assertCode('DOCTYPE', b.doc_type, { allowEmpty: false });
  if (b.owner_user_id && !q.get(`SELECT id FROM users WHERE id=? AND is_active=1`, b.owner_user_id)) {
    throw badRequest('Owner user not found or inactive');
  }

  const rn = 'NAL-' + new Date().getFullYear() + '-' + String(
    (q.get(`SELECT COUNT(*) c FROM number_allocations WHERE request_number LIKE ?`, `NAL-${new Date().getFullYear()}-%`).c) + 1
  ).padStart(4, '0');

  const r = q.run(
    `INSERT INTO number_allocations (request_number, requesting_department, owner_user_id, proposed_title,
       system, prid, so_po, discipline, doc_type, scheme, department, section, ss, remarks, created_by)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    rn, b.requesting_department || null, b.owner_user_id || null, String(b.proposed_title).trim(),
    b.system || null, b.prid || null, b.so_po || null, b.discipline || null, b.doc_type || null,
    b.scheme, b.department || null, b.section || null, b.ss || null, b.remarks || null, req.user.id);
  const id = Number(r.lastInsertRowid);
  audit({ user: req.user, action: 'CREATE', entityType: 'NUMBER_ALLOCATION', entityId: id, next: { rn, scheme: b.scheme } });
  res.status(201).json({ data: q.get(`SELECT * FROM number_allocations WHERE id=?`, id) });
}));

/** Allocate: generate + lock the next number in the series. */
router.post('/:id/allocate', requirePerm('number.allocate'), ah(async (req, res) => {
  const a = q.get(`SELECT * FROM number_allocations WHERE id=?`, Number(req.params.id));
  if (!a) throw notFound('Allocation request not found');
  if (a.generated_number) throw badRequest(`Number already allocated: ${a.generated_number}`);
  if (['cancelled', 'rejected'].includes(a.decision)) throw badRequest(`Request is ${a.decision}`);
  const scheme = req.body.scheme || a.scheme;
  if (!['CORPORATE', 'PROJECT'].includes(scheme)) throw badRequest('Scheme missing â€” pass scheme or set it on the request');

  const { number, sequence, seriesKey } = allocateNumber({
    scheme,
    department: req.body.department || a.department,
    section: req.body.section || a.section,
    docType: a.doc_type,
    prid: req.body.prid || a.prid,
    ss: req.body.ss || a.so_po || a.ss,
    discipline: a.discipline
  }, req.user.id);

  q.run(
    `UPDATE number_allocations SET scheme=?, series_key=?, sequence=?, generated_number=?,
       decision='allocated', allocation_date=date('now'), allocated_by=?, gap_check='verified',
       department=COALESCE(department, ?), section=COALESCE(section, ?),
       prid=COALESCE(prid, ?), so_po=COALESCE(so_po, ?), ss=COALESCE(ss, ?)
     WHERE id=?`,
    scheme, seriesKey, sequence, number, req.user.id,
    req.body.department || null, req.body.section || null,
    req.body.prid || null, req.body.ss || null, req.body.ss || null, a.id);
  audit({ user: req.user, action: 'NUMBER_ALLOCATE', entityType: 'NUMBER_ALLOCATION', entityId: a.id, next: { number, seriesKey, sequence } });
  notify('NUMBER_ALLOCATED', {
    assigneeIds: [a.created_by].filter(Boolean), entityType: 'NUMBER_ALLOCATION', entityId: a.id,
    title: 'Document number allocated', body: `${number} allocated for "${a.proposed_title}".`,
    vars: { docNumber: number }
  });
  ok(res, q.get(`SELECT * FROM number_allocations WHERE id=?`, a.id));
}));

router.post('/:id/cancel', requirePerm('number.allocate'), ah(async (req, res) => {
  const a = q.get(`SELECT * FROM number_allocations WHERE id=?`, Number(req.params.id));
  if (!a) throw notFound('Allocation request not found');
  if (a.decision === 'issued') throw badRequest('Issued numbers cannot be cancelled');
  q.run(`UPDATE number_allocations SET decision='cancelled', status=?, remarks=COALESCE(remarks,'')||? WHERE id=?`,
    req.body.status || 'Cancelled', `\n[${req.user.username}] ${req.body.reason || 'Cancelled.'}`, a.id);
  audit({ user: req.user, action: 'CANCEL', entityType: 'NUMBER_ALLOCATION', entityId: a.id, next: { reason: req.body.reason } });
  ok(res, q.get(`SELECT * FROM number_allocations WHERE id=?`, a.id));
}));

router.post('/:id/reject', requirePerm('number.allocate'), ah(async (req, res) => {
  const a = q.get(`SELECT * FROM number_allocations WHERE id=?`, Number(req.params.id));
  if (!a) throw notFound('Allocation request not found');
  if (a.generated_number) throw badRequest('Already allocated â€” use cancel');
  q.run(`UPDATE number_allocations SET decision='rejected', remarks=COALESCE(remarks,'')||? WHERE id=?`,
    `\n[${req.user.username}] ${req.body.reason || 'Rejected.'}`, a.id);
  audit({ user: req.user, action: 'REJECT', entityType: 'NUMBER_ALLOCATION', entityId: a.id, next: { reason: req.body.reason } });
  ok(res, q.get(`SELECT * FROM number_allocations WHERE id=?`, a.id));
}));

router.get('/', ah(async (req, res) => {
  const { page, pageSize, limit, offset } = pagination(req.query);
  const where = ['1=1'], params = [];
  if (req.query.decision) { where.push('decision=?'); params.push(req.query.decision); }
  if (req.query.series_key) { where.push('series_key=?'); params.push(req.query.series_key); }
  if (req.query.search) { where.push('(request_number LIKE ? OR proposed_title LIKE ? OR generated_number LIKE ?)'); params.push(`%${req.query.search}%`, `%${req.query.search}%`, `%${req.query.search}%`); }
  const rows = q.all(
    `SELECT a.*, u.full_name AS allocated_by_name, o2.full_name AS owner_name
     FROM number_allocations a
     LEFT JOIN users u ON u.id=a.allocated_by
     LEFT JOIN users o2 ON o2.id=a.owner_user_id
     WHERE ${where.join(' AND ')} ORDER BY a.id DESC LIMIT ? OFFSET ?`, ...params, limit, offset);
  const total = q.get(`SELECT COUNT(*) c FROM number_allocations WHERE ${where.join(' AND ')}`, ...params).c;
  ok(res, rows, { page, pageSize, total });
}));

router.get('/gap-check', requirePerm('number.allocate'), ah(async (req, res) => {
  ok(res, gapCheck(req.query.series_key || null));
}));

router.get('/series', requirePerm('number.allocate'), ah(async (req, res) => {
  ok(res, q.all(`SELECT * FROM uef_series ORDER BY scheme, series_key`));
}));

router.get('/:id', ah(async (req, res) => {
  const a = q.get(`SELECT * FROM number_allocations WHERE id=?`, Number(req.params.id));
  if (!a) throw notFound('Allocation request not found');
  ok(res, a);
}));

module.exports = router;
