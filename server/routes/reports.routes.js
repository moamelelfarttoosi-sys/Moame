'use strict';
const express = require('express');
const path = require('path');
const fs = require('fs');
const { q } = require('../db');
const { ah, ok, badRequest, pagination } = require('../lib/http');
const { requireAuth, requirePerm } = require('../lib/auth');
const { exportResultSet } = require('../lib/exporter');
const { audit } = require('../lib/audit');

const router = express.Router();
router.use(requireAuth);

/** Predefined register reports; each supports ?format=csv|excel|pdf|json */
const REPORTS = {
  'document-register': {
    title: 'Document Register',
    columns: [
      ['doc_number', 'Document Number', 'd.doc_number'], ['title', 'Title', 'd.title'],
      ['revision', 'Revision', `(SELECT revision_code FROM document_revisions r WHERE r.document_id=d.id AND r.is_current=1 LIMIT 1)`],
      ['internal_status', 'Internal Status', 'ist.name'], ['external_status', 'External Status', 'est.name'],
      ['register', 'Register', 'd.register_type'], ['prid', 'PRID', 'd.prid'], ['so_po', 'SO/PO', 'd.so_po'],
      ['class', 'Class', 'd.class_code'], ['entry', 'Entry No', 'd.entry_number'],
      ['project', 'Project', 'p.name'], ['contract', 'Contract', 'c.number'], ['discipline', 'Discipline', 'di.name'],
      ['doc_type', 'Doc Type', 't.name'], ['receipt_date', 'Receipt Date', 'd.receipt_date'],
      ['accept_date', 'Accept Date', 'd.accept_date']
    ],
    from: `FROM documents d JOIN statuses ist ON ist.id=d.internal_status_id
           LEFT JOIN statuses est ON est.id=d.external_status_id
           LEFT JOIN projects p ON p.id=d.project_id LEFT JOIN contracts c ON c.id=d.contract_id
           LEFT JOIN disciplines di ON di.id=d.discipline_id JOIN document_types t ON t.id=d.doc_type_id`,
    where: `d.deleted_at IS NULL`
  },
  'incoming-register': {
    title: 'Incoming Document Register (LOIR)',
    columns: [
      ['doc_number', 'Document Number', 'd.doc_number'], ['title', 'Title', 'd.title'],
      ['originator', 'Originator', 'oo.name'], ['received', 'Receipt Date', 'd.receipt_date'],
      ['internal_status', 'Status', 'ist.name'], ['reviewer', 'Reviewer', 'ru.full_name'],
      ['due', 'Review Due', 'd.review_due_date']
    ],
    from: `FROM documents d JOIN statuses ist ON ist.id=d.internal_status_id
           LEFT JOIN organizations oo ON oo.id=d.originator_org_id
           LEFT JOIN users ru ON ru.id=d.reviewer_user_id`,
    where: `d.deleted_at IS NULL AND d.direction='incoming'`
  },
  'outgoing-register': {
    title: 'Outgoing Register',
    columns: [
      ['trn_number', 'Transmittal No', 't.trn_number'], ['subject', 'Subject', 't.subject'],
      ['recipient', 'Recipient Org', 'ro.name'], ['issued', 'Date', 't.trn_date'],
      ['status', 'Status', 't.status'], ['response_due', 'Response Due', 't.response_due_date']
    ],
    from: `FROM transmittals t LEFT JOIN organizations ro ON ro.id=t.recipient_org_id`,
    where: `t.direction='outgoing'`
  },
  'transmittal-register': {
    title: 'Transmittal Register',
    columns: [
      ['trn_number', 'Transmittal No', 't.trn_number'], ['direction', 'Direction', 't.direction'],
      ['subject', 'Subject', 't.subject'], ['sender', 'Sender', 'su.full_name'],
      ['recipient', 'Recipient', 'ro.name'], ['date', 'Date', 't.trn_date'],
      ['status', 'Status', 't.status'], ['ack', 'Acknowledged At', 't.acknowledged_at']
    ],
    from: `FROM transmittals t LEFT JOIN users su ON su.id=t.sender_user_id
           LEFT JOIN organizations ro ON ro.id=t.recipient_org_id`,
    where: `1=1`
  },
  'review-report': {
    title: 'Review Report',
    columns: [
      ['doc_number', 'Document', 'd.doc_number'], ['revision', 'Rev', 'r.revision_code'],
      ['reviewer', 'Reviewer', 'u.full_name'], ['assigned', 'Assigned', 'r.assigned_at'],
      ['due', 'Due', 'r.review_due_date'], ['status', 'Status', 'r.status'], ['completed', 'Completed', 'r.completed_at']
    ],
    from: `FROM reviews r JOIN documents d ON d.id=r.document_id JOIN users u ON u.id=r.reviewer_user_id
           JOIN document_revisions rev ON rev.id=r.revision_id`,
    where: `1=1`
  },
  'approval-report': {
    title: 'Approval Report',
    columns: [
      ['doc_number', 'Document', 'd.doc_number'], ['revision', 'Rev', 'rev.revision_code'],
      ['mode', 'Mode', 'a.mode'], ['initiated', 'Initiated', 'a.initiated_at'],
      ['deadline', 'Deadline', 'a.deadline_at'], ['status', 'Status', 'a.status'], ['completed', 'Completed', 'a.completed_at']
    ],
    from: `FROM approvals a JOIN documents d ON d.id=a.document_id
           JOIN document_revisions rev ON rev.id=a.revision_id`,
    where: `1=1`
  },
  'overdue-report': {
    title: 'Overdue Actions Report',
    columns: [
      ['kind', 'Type'], ['reference', 'Reference'], ['responsible', 'Responsible'],
      ['due', 'Due Date'], ['status', 'Status'], ['days_over', 'Days Overdue']
    ],
    union: [
      { from: `FROM reviews r JOIN documents d ON d.id=r.document_id JOIN users u ON u.id=r.reviewer_user_id`,
        where: `r.status IN ('pending','in_progress') AND r.review_due_date IS NOT NULL AND r.review_due_date < date('now')`,
        select: `'REVIEW' AS kind, d.doc_number AS reference, u.full_name AS responsible, r.review_due_date AS due, r.status AS status, CAST(julianday('now')-julianday(r.review_due_date) AS INT) AS days_over` },
      { from: `FROM approvals ap JOIN documents d ON d.id=ap.document_id LEFT JOIN users u ON u.id=ap.initiated_by`,
        where: `ap.status='in_progress' AND ap.deadline_at IS NOT NULL AND date(ap.deadline_at) < date('now')`,
        select: `'APPROVAL' AS kind, d.doc_number AS reference, u.full_name AS responsible, date(ap.deadline_at) AS due, ap.status AS status, CAST(julianday('now')-julianday(ap.deadline_at) AS INT) AS days_over` },
      { from: `FROM resolutions x JOIN users u ON u.id=x.responsible_user_id`,
        where: `x.status IN ('open','in_progress','escalated') AND x.due_date IS NOT NULL AND x.due_date < date('now')`,
        select: `'RESOLUTION' AS kind, x.resolution_number AS reference, u.full_name AS responsible, x.due_date AS due, x.status AS status, CAST(julianday('now')-julianday(x.due_date) AS INT) AS days_over` },
      { from: `FROM transmittals t LEFT JOIN users u ON u.id=t.created_by`,
        where: `t.status IN ('issued','acknowledged') AND t.response_required=1 AND t.response_due_date IS NOT NULL AND t.response_due_date < date('now')`,
        select: `'TRANSMITTAL RESPONSE' AS kind, t.trn_number AS reference, u.full_name AS responsible, t.response_due_date AS due, t.status AS status, CAST(julianday('now')-julianday(t.response_due_date) AS INT) AS days_over` }
    ]
  },
  'correspondence-report': {
    title: 'Correspondence Report',
    columns: [
      ['corr_number', 'Number', 'c.corr_number'], ['direction', 'Dir', 'c.direction'],
      ['subject', 'Subject', 'c.subject'], ['sender', 'From', 'so.name'], ['recipient', 'To', 'ro.name'],
      ['date', 'Date', 'c.corr_date'], ['status', 'Status', 'c.status']
    ],
    from: `FROM correspondence c LEFT JOIN organizations so ON so.id=c.sender_org_id
           LEFT JOIN organizations ro ON ro.id=c.recipient_org_id`,
    where: `1=1`
  },
  'resolution-report': {
    title: 'Resolution Report',
    columns: [
      ['resolution_number', 'Number', 'x.resolution_number'], ['subject', 'Subject', 'x.subject'],
      ['decision', 'Decision', 'x.decision'], ['responsible', 'Responsible', 'u.full_name'],
      ['due', 'Due', 'x.due_date'], ['priority', 'Priority', 'x.priority'], ['status', 'Status', 'x.status'],
      ['closed', 'Closed', 'x.closure_date']
    ],
    from: `FROM resolutions x JOIN users u ON u.id=x.responsible_user_id`,
    where: `1=1`
  },
  'audit-report': {
    title: 'Audit Trail Report',
    columns: [
      ['at', 'Timestamp', 'a.at'], ['username', 'User', 'a.username'], ['action', 'Action', 'a.action'],
      ['entity_type', 'Entity', 'a.entity_type'], ['entity_id', 'Record ID', 'a.entity_id'], ['details', 'Details', 'a.details']
    ],
    from: `FROM audit_logs a`,
    where: `1=1`
  },
  'revision-report': {
    title: 'Revision Report',
    columns: [
      ['doc_number', 'Document', 'd.doc_number'], ['revision', 'Revision', 'r.revision_code'],
      ['status', 'Status', 's.name'], ['author', 'Author', 'ua.full_name'], ['approver', 'Approver', 'up.full_name'],
      ['approval_date', 'Approval Date', 'r.approval_date'], ['current', 'Current', `CASE r.is_current WHEN 1 THEN 'Yes' ELSE 'No' END`]
    ],
    from: `FROM document_revisions r JOIN documents d ON d.id=r.document_id
           JOIN statuses s ON s.id=r.status_id
           LEFT JOIN users ua ON ua.id=r.author_user_id LEFT JOIN users up ON up.id=r.approver_user_id`,
    where: `1=1`
  },
  'distribution-report': {
    title: 'Distribution Report',
    columns: [
      ['trn_number', 'Transmittal', 't.trn_number'], ['recipient_org', 'Recipient Org', 'o.name'],
      ['recipient_user', 'Recipient', 'u.full_name'], ['copy', 'Copy Type', 'di.copy_type'],
      ['status', 'Status', 'di.status'], ['sent', 'Sent', 'di.sent_at'], ['ack', 'Acknowledged', 'di.acknowledged_at']
    ],
    from: `FROM distributions di JOIN transmittals t ON t.id=di.transmittal_id
           LEFT JOIN organizations o ON o.id=di.recipient_org_id
           LEFT JOIN users u ON u.id=di.recipient_user_id`,
    where: `1=1`
  }
};

router.get('/', requirePerm('report.view'), ah(async (req, res) => {
  ok(res, Object.entries(REPORTS).map(([key, r]) => ({ key, title: r.title })));
}));

router.get('/:key', requirePerm('report.view'), ah(async (req, res) => {
  const rep = REPORTS[req.params.key];
  if (!rep) throw badRequest('Unknown report');
  const format = (req.query.format || 'json').toLowerCase();

  // Build dynamic WHERE clauses from query parameters
  const extraWhere = [];
  const params = [];
  if (req.query.from) { extraWhere.push(`d.receipt_date >= ?`); params.push(req.query.from); }
  if (req.query.to) { extraWhere.push(`d.receipt_date <= ?`); params.push(req.query.to); }
  if (req.query.project) { extraWhere.push(`p.code = ?`); params.push(req.query.project); }

  let rowsAll;
  if (rep.union) {
    const sql = rep.union.map(part => `SELECT ${part.select} ${part.from} WHERE ${part.where}`).join('\nUNION ALL\n');
    rowsAll = q.all(`${sql} LIMIT 10000`, ...params);
  } else {
    const selectCols = rep.columns.map(([k, l, e]) => `${e} AS "${k}"`).join(', ');
    const whereClause = [rep.where, ...extraWhere].join(' AND ');
    rowsAll = q.all(`SELECT ${selectCols} ${rep.from} WHERE ${whereClause} LIMIT 10000`, ...params);
  }

  audit({ user: req.user, action: 'REPORT_VIEW', entityType: 'REPORT', entityId: null, details: `${req.params.key} rows=${rowsAll.length}` });

  if (format === 'json') {
    return ok(res, rowsAll.map(r => ({ cells: r })), { total: rowsAll.length });
  }

  const needExportPerm = req.user.role_code !== 'ADMIN';
  const hasPerm = needExportPerm ? q.get(
    `SELECT 1 x FROM role_permissions rp JOIN permissions p ON p.id=rp.permission_id
     WHERE rp.role_id=? AND p.code='report.export'`, req.user.role_id) : { x: 1 };
  if (!hasPerm) throw badRequest('You are not permitted to export reports');

  const file = exportResultSet({
    format, title: rep.title,
    columns: rep.columns.map(([k, l]) => ({ key: k, label: l })),
    rows: rowsAll, user: req.user
  });
  ok(res, { download: `/api/files/export/${encodeURIComponent(file.filename)}`, filename: file.filename, rows: rowsAll.length });
}));

module.exports = router;
