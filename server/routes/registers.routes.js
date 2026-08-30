'use strict';
const express = require('express');
const { q } = require('../db');
const { ah, ok, badRequest, notFound, pagination } = require('../lib/http');
const { requireAuth, requirePerm, scopeFilterFor } = require('../lib/auth');
const { audit } = require('../lib/audit');
const { assertCode } = require('../lib/codes');

const router = express.Router();
router.use(requireAuth);

/**
 * UEF Registers — TDR / MDR / VDR / SOP.
 * Each register is a first-class entity over the DCR master (documents):
 * one authoritative record per controlled document, register-specific fields
 * in extension tables. Records are never physically deleted.
 */
const REGISTERS = {
  TDR: {
    table: 'register_tdr',
    label: 'Technical Document Register',
    fields: ['s_n', 'typical', 'planned_revision', 'approval_code', 'date_submitted', 'date_approved', 'transmittal_ref', 'sheets'],
    joins: `LEFT JOIN register_tdr x ON x.document_id=d.id`
  },
  MDR: {
    table: 'register_mdr',
    label: 'Management Document Register',
    fields: ['deliverable_category', 'planned_revision', 'approval_code', 'date_submitted', 'date_approved', 'transmittal_ref'],
    joins: `LEFT JOIN register_mdr x ON x.document_id=d.id`
  },
  VDR: {
    table: 'register_vdr',
    label: 'Vendor Document Register',
    fields: ['vendor_doc_number', 'vendor_org_id', 'po_number', 'mr_number', 'system_area', 'mrb_included', 'approval_code', 'date_submitted', 'transmittal_ref'],
    joins: `LEFT JOIN register_vdr x ON x.document_id=d.id LEFT JOIN organizations vo ON vo.id=x.vendor_org_id`
  },
  SOP: {
    table: 'register_sop',
    label: 'SOP & Corporate Document Master Register',
    fields: ['section_code', 'owner_user_id', 'issue_date', 'approving_order', 'review_interval_months', 'next_review_due', 'linked_forms'],
    joins: `LEFT JOIN register_sop x ON x.document_id=d.id LEFT JOIN users so ON so.id=x.owner_user_id`
  }
};

const LIST_COLS = {
  TDR: `x.s_n, x.typical, x.planned_revision, x.approval_code, x.date_submitted, x.date_approved, x.transmittal_ref, x.sheets`,
  MDR: `x.deliverable_category, x.planned_revision, x.approval_code, x.date_submitted, x.date_approved, x.transmittal_ref`,
  VDR: `x.vendor_doc_number, vo.name AS vendor_name, x.po_number, x.mr_number, x.system_area, x.mrb_included, x.approval_code, x.date_submitted, x.transmittal_ref`,
  SOP: `x.section_code, x.owner_user_id, so.full_name AS owner_name, x.issue_date, x.approving_order, x.review_interval_months, x.next_review_due,
        CAST(MAX(0, julianday(x.next_review_due) - julianday('now')) AS INTEGER) AS days_to_review`
};

function assertRegister(type) {
  const r = REGISTERS[String(type || '').toUpperCase()];
  if (!r) throw badRequest('Unknown register — use TDR, MDR, VDR or SOP');
  return r;
}

router.get('/:type', ah(async (req, res) => {
  const reg = assertRegister(req.params.type);
  const type = req.params.type.toUpperCase();
  const { page, pageSize, limit, offset } = pagination(req.query);
  const where = [`d.deleted_at IS NULL`, `d.register_type=?`];
  const params = [type];
  if (req.query.search) {
    const like = `%${req.query.search}%`;
    const base = `(d.doc_number LIKE ? OR d.title LIKE ?`;
    params.push(like, like);
    let clause = base;
    if (req.params.type.toUpperCase() === 'VDR') { clause += ` OR x.vendor_doc_number LIKE ? OR x.po_number LIKE ? OR x.mr_number LIKE ?`; params.push(like, like, like); }
    clause += ')';
    where.push(clause);
  }
  if (req.query.status) { where.push(`d.internal_status_id IN (SELECT id FROM statuses WHERE code=?)`); params.push(req.query.status); }
  if (req.params.type.toUpperCase() === 'VDR' && req.query.po_number) { where.push('x.po_number=?'); params.push(req.query.po_number); }
  if (req.params.type.toUpperCase() === 'SOP' && req.query.review_due === '1') {
    where.push(`x.next_review_due IS NOT NULL AND x.next_review_due <= date('now','+30 day')`);
  }
  const seg = scopeFilterFor(req.user);
  const rows = q.all(
    `SELECT d.id, d.doc_number, d.title, d.prid, d.so_po, d.class_code, d.register_type,
            ist.code AS status_code, ist.name AS status_name,
            (SELECT revision_code FROM document_revisions r WHERE r.document_id=d.id AND r.is_current=1 LIMIT 1) AS current_revision,
            ${LIST_COLS[req.params.type.toUpperCase()]}
     FROM documents d
     JOIN statuses ist ON ist.id=d.internal_status_id
     ${reg.joins}
     WHERE ${where.join(' AND ')} ${seg.sql}
     ORDER BY d.id DESC LIMIT ? OFFSET ?`, ...params, ...seg.params, limit, offset);
  const total = q.get(
    `SELECT COUNT(*) c FROM documents d ${reg.joins} WHERE ${where.join(' AND ')} ${seg.sql}`,
    ...params, ...seg.params).c;
  ok(res, rows, { page, pageSize, total, register: reg.label });
}));

/** Update register-specific extension fields */
router.put('/:type/:documentId', requirePerm('document.edit'), ah(async (req, res) => {
  const reg = assertRegister(req.params.type);
  const docId = Number(req.params.documentId);
  const doc = q.get(`SELECT * FROM documents WHERE id=? AND deleted_at IS NULL`, docId);
  if (!doc) throw notFound('Document not found');
  if (doc.register_type !== req.params.type.toUpperCase()) throw badRequest(`Document is not a ${req.params.type.toUpperCase()} register record`);

  if (req.params.type.toUpperCase() === 'SOP') {
    if (req.body.review_interval_months !== undefined) {
      const m = Number(req.body.review_interval_months);
      if (!Number.isInteger(m) || m < 1 || m > 24) throw badRequest('Review interval must be 1-24 months (maximum 24 per control model)');
    }
    if (req.body.section_code) assertCode('SECTION', req.body.section_code, { allowEmpty: false });
  }

  const sets = [], params = [];
  for (const f of reg.fields) {
    if (req.body[f] !== undefined) { sets.push(`${f}=?`); params.push(req.body[f]); }
  }
  if (!sets.length) throw badRequest('No register fields to update');

  const existing = q.get(`SELECT document_id FROM ${reg.table} WHERE document_id=?`, docId);
  if (existing) {
    q.run(`UPDATE ${reg.table} SET ${sets.join(',')} WHERE document_id=?`, ...params, docId);
  } else {
    const cols = reg.fields.filter(f => req.body[f] !== undefined);
    q.run(`INSERT INTO ${reg.table} (document_id, ${cols.join(',')}) VALUES (?,${cols.map(() => '?').join(',')})`,
      docId, ...reg.fields.filter(f => req.body[f] !== undefined).map(f => req.body[f]));
  }

  // SOP review engine: Next Review Due = Issue Date + Review Interval (<= 24 months)
  if (req.params.type.toUpperCase() === 'SOP') {
    const sop = q.get(`SELECT * FROM register_sop WHERE document_id=?`, docId);
    if (sop && sop.issue_date) {
      const interval = sop.review_interval_months || 12;
      q.run(`UPDATE register_sop SET next_review_due=date(?, '+${Number(interval)} month') WHERE document_id=?`, sop.issue_date, docId);
    }
  }

  audit({ user: req.user, action: 'EDIT', entityType: 'REGISTER_' + req.params.type.toUpperCase(), entityId: docId, next: req.body });
  ok(res, q.get(`SELECT x.*, d.doc_number, d.title FROM ${reg.table} x JOIN documents d ON d.id=x.document_id WHERE x.document_id=?`, docId));
}));

module.exports = router;
