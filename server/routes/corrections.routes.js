'use strict';
const express = require('express');
const { q } = require('../db');
const { ah, ok, badRequest, pagination } = require('../lib/http');
const { requireAuth, requirePerm } = require('../lib/auth');
const { audit } = require('../lib/audit');

const router = express.Router();
router.use(requireAuth);

/** Immutable Correction / Change Log — governance model from the UEF register. */

// field whitelist per register (controlled corrections only)
const CORRECTABLE = {
  DOCUMENTS: { table: 'documents', fields: ['title', 'prid', 'so_po', 'class_code', 'department_code', 'section_code', 'originator_code', 'pages_sheets', 'archive_location', 'keywords', 'remarks', 'owner_user_id'] },
  CORRESPONDENCE: { table: 'correspondence', fields: ['subject', 'counterparty_code', 'counterparty_ref', 'letter_date', 'responsible_dept_code', 'clause', 'archive_box', 'reply_reference'] },
  TDR: { table: 'register_tdr', key: 'document_id', fields: ['typical', 'planned_revision', 'approval_code', 'date_submitted', 'date_approved', 'transmittal_ref', 'sheets'] },
  MDR: { table: 'register_mdr', key: 'document_id', fields: ['deliverable_category', 'planned_revision', 'approval_code', 'date_submitted', 'date_approved', 'transmittal_ref'] },
  VDR: { table: 'register_vdr', key: 'document_id', fields: ['vendor_doc_number', 'po_number', 'mr_number', 'system_area', 'approval_code', 'date_submitted', 'transmittal_ref'] },
  SOP: { table: 'register_sop', key: 'document_id', fields: ['section_code', 'issue_date', 'approving_order', 'review_interval_months', 'linked_forms'] }
};

router.post('/', requirePerm('correction.record'), ah(async (req, res) => {
  const { register, record_id, field_name, corrected_value, reason, authorization_by } = req.body || {};
  const reg = CORRECTABLE[String(register || '').toUpperCase()];
  if (!reg) throw badRequest(`Unknown register: ${register}`);
  if (!record_id || !field_name || !reason) throw badRequest('record_id, field_name and reason are mandatory');
  if (String(reason).length > 4000) throw badRequest('reason exceeds 4000 characters');
  if (corrected_value !== undefined && corrected_value !== null && String(corrected_value).length > 2000) {
    throw badRequest('corrected_value exceeds 2000 characters');
  }
  if (!reg.fields.includes(field_name)) throw badRequest(`Field "${field_name}" is not a controlled correctable field of ${register.toUpperCase()}`);

  const keyCol = reg.key || 'id';
  let record = q.get(`SELECT * FROM ${reg.table} WHERE ${keyCol}=?`, Number(record_id));
  if (reg.table === 'documents' && (!record || record.deleted_at)) {
    throw badRequest(`Record ${record_id} not found in ${register.toUpperCase()}`);
  }
  if (!record) throw badRequest(`Record ${record_id} not found in ${register.toUpperCase()}`);
  const previousValue = record[field_name] == null ? null : String(record[field_name]);

  if (authorization_by && !q.get(`SELECT id FROM users WHERE id=?`, Number(authorization_by))) {
    throw badRequest('Authorizing user not found');
  }

  const year = new Date().getFullYear();
  const seq = (q.get(`SELECT COUNT(*) c FROM correction_log WHERE correction_number LIKE ?`, `CORR-${year}-%`).c) + 1;
  const correctionNumber = `CORR-${year}-${String(seq).padStart(4, '0')}`;

  // apply + record atomically
  q.tx(() => {
    q.run(`UPDATE ${reg.table} SET ${field_name}=? WHERE ${keyCol}=?`,
      corrected_value === undefined || corrected_value === null ? null : String(corrected_value), Number(record_id));
    if (reg.table === 'documents') q.run(`UPDATE documents SET updated_at=datetime('now') WHERE id=?`, Number(record_id));
    // keep SOP review schedule consistent after corrections
    if (reg.table === 'register_sop') {
      const sop = q.get(`SELECT * FROM register_sop WHERE document_id=?`, Number(record_id));
      if (sop && sop.issue_date) {
        const interval = Math.min(24, Math.max(1, Number(sop.review_interval_months) || 12));
        q.run(`UPDATE register_sop SET next_review_due=date(?, '+${interval} month'), review_interval_months=? WHERE document_id=?`,
          sop.issue_date, interval, Number(record_id));
      }
    }    q.run(
      `INSERT INTO correction_log (correction_number, user_id, register, record_id, field_name, previous_value, corrected_value, reason, authorization_by)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      correctionNumber, req.user.id, String(register).toUpperCase(), Number(record_id), field_name,
      previousValue, corrected_value == null ? null : String(corrected_value), reason,
      authorization_by ? Number(authorization_by) : null);
  });

  audit({
    user: req.user, action: 'CORRECTION', entityType: String(register).toUpperCase(), entityId: Number(record_id),
    prev: { [field_name]: previousValue }, next: { [field_name]: corrected_value },
    details: JSON.stringify({ correctionNumber, reason, authorizedBy: authorization_by || null })
  });
  res.status(201).json({ data: q.get(`SELECT * FROM correction_log WHERE correction_number=?`, correctionNumber) });
}));

router.get('/', ah(async (req, res) => {
  const { page, pageSize, limit, offset } = pagination(req.query);
  const where = ['1=1'], params = [];
  if (req.query.register) { where.push('register=?'); params.push(String(req.query.register).toUpperCase()); }
  if (req.query.record_id) { where.push('record_id=?'); params.push(Number(req.query.record_id)); }
  if (req.query.search) { where.push('(correction_number LIKE ? OR field_name LIKE ? OR reason LIKE ?)'); params.push(`%${req.query.search}%`, `%${req.query.search}%`, `%${req.query.search}%`); }
  const rows = q.all(
    `SELECT cl.*, u.full_name AS user_name, au.full_name AS authorizer_name
     FROM correction_log cl
     LEFT JOIN users u ON u.id=cl.user_id
     LEFT JOIN users au ON au.id=cl.authorization_by
     WHERE ${where.join(' AND ')} ORDER BY cl.id DESC LIMIT ? OFFSET ?`, ...params, limit, offset);
  const total = q.get(`SELECT COUNT(*) c FROM correction_log WHERE ${where.join(' AND ')}`, ...params).c;
  ok(res, rows, { page, pageSize, total });
}));

module.exports = router;
