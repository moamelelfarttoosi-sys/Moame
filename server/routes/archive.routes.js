'use strict';
const express = require('express');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const { q } = require('../db');
const { ah, ok, badRequest, notFound } = require('../lib/http');
const { requireAuth, requirePerm } = require('../lib/auth');
const { audit } = require('../lib/audit');

const router = express.Router();
router.use(requireAuth);

/** Archive eligibility + records management */
router.get('/', requirePerm('archive.manage'), ah(async (req, res) => {
  ok(res, q.all(
    `SELECT ar.*, u.username AS archived_by_name, rr.name AS retention_rule_name,
            CASE ar.entity_type WHEN 'DOCUMENT' THEN (SELECT doc_number FROM documents WHERE id=ar.entity_id) END AS reference
     FROM archive_records ar LEFT JOIN users u ON u.id=ar.archived_by
     LEFT JOIN retention_rules rr ON rr.id=ar.retention_rule_id
     ORDER BY ar.id DESC`));
}));

router.post('/documents/:id/archive', requirePerm('archive.manage'), ah(async (req, res) => {
  const id = Number(req.params.id);
  const doc = q.get(`SELECT * FROM documents WHERE id=? AND deleted_at IS NULL`, id);
  if (!doc) throw notFound('Document not found');
  if (doc.archive_status === 'archived') throw badRequest('Already archived');

  // Archiving allowed when: superseded / closed / retention rule requires / project closed
  const st = q.get(`SELECT code, name FROM statuses WHERE id=?`, doc.internal_status_id);
  const projectClosed = q.get(`SELECT lifecycle_stage, status FROM projects WHERE id=?`, doc.project_id);
  const eligible =
    ['SUP', 'CLS'].includes(st.code) ||
    doc.archive_status === 'eligible' ||
    (projectClosed && (projectClosed.status === 'Closed' || projectClosed.lifecycle_stage === 'Closed'));
  if (!eligible) throw badRequest(`Document is not archivable in status ${st.name} — close or supersede it first`);

  const retention = q.get(`SELECT * FROM retention_rules WHERE id=?`, doc.retention_rule_id || 0);
  const dispositionDue = retention
    ? new Date(Date.now() + retention.retention_years * 365.25 * 86400000).toISOString().slice(0, 10)
    : null;

  q.tx(() => {
    q.run(`INSERT INTO archive_records (entity_type, entity_id, archived_by, reason, retention_rule_id, disposition_due)
           VALUES ('DOCUMENT',?,?,?,?,?)`,
      id, req.user.id, req.body.reason || `Archived in status ${st.name}`,
      doc.retention_rule_id || null, dispositionDue);
    q.run(`UPDATE documents SET archive_status='archived', updated_at=datetime('now') WHERE id=?`, id);
    q.run(`UPDATE document_revisions SET status_id=(SELECT id FROM statuses WHERE code='ARC')
           WHERE document_id=? AND is_current=1`, id);
  });
  audit({ user: req.user, action: 'ARCHIVE', entityType: 'DOCUMENT', entityId: id, next: { archived: true } });
  const { notify } = require('../lib/notify');
  notify('ARCHIVED', {
    assigneeIds: [doc.dcc_user_id].filter(Boolean), entityType: 'DOCUMENT', entityId: id,
    title: `${doc.doc_number} archived`, body: req.body.reason || '', vars: { entityLabel: doc.doc_number }
  });
  ok(res, { archived: true, disposition_due: dispositionDue });
}));

/** Authorized disposition (physical removal) — ADMIN only with explicit confirm token */
router.post('/:archiveId/disposition', requirePerm('admin.manage'), ah(async (req, res) => {
  const rec = q.get(`SELECT * FROM archive_records WHERE id=?`, Number(req.params.archiveId));
  if (!rec) throw notFound('Archive record not found');
  if (!rec.dispositioned_at) {
    if (String(req.body.confirm || '').toUpperCase() !== 'DISPOSE') {
      throw badRequest('Confirmation token required: send {"confirm":"DISPOSE"}');
    }
    if (rec.disposition_due && new Date(rec.disposition_due + 'T00:00:00Z') > new Date()) {
      throw badRequest(`Retention period active until ${rec.disposition_due}`);
    }
    q.run(`UPDATE archive_records SET dispositioned_at=datetime('now'), dispositioned_by=? WHERE id=?`,
      req.user.id, rec.id);
    q.run(`UPDATE documents SET archive_status='disposed', deleted_at=datetime('now') WHERE id=? AND ?='DOCUMENT'`,
      rec.entity_id, rec.entity_type);
    audit({ user: req.user, action: 'DISPOSITION', entityType: rec.entity_type, entityId: rec.entity_id, next: { disposed: true } });
  }
  ok(res, q.get(`SELECT * FROM archive_records WHERE id=?`, rec.id));
}));

module.exports = router;
