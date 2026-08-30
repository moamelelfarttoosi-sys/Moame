'use strict';
const { q } = require('../db');
const { audit } = require('./audit');
const { notify } = require('./notify');

/**
 * Revision control: promote an APPROVED revision to controlled state,
 * supersede previous controlled revision, update document pointers.
 */
function finalizeApprovedRevision({ documentId, revisionId, actor }) {
  const rev = q.get(`SELECT * FROM document_revisions WHERE id=? AND document_id=?`, revisionId, documentId);
  if (!rev) throw new Error('Revision not found');

  // pin latest uploaded version file as the controlled file
  let fileId = rev.file_id;
  if (!fileId) {
    const v = q.get(`SELECT file_id FROM document_versions WHERE revision_id=? ORDER BY version_no DESC LIMIT 1`, revisionId);
    fileId = v ? v.file_id : null;
    if (fileId) q.run(`UPDATE document_revisions SET file_id=? WHERE id=?`, fileId, revisionId);
  }

  const prevCurrent = q.get(
    `SELECT id, revision_code FROM document_revisions WHERE document_id=? AND is_current=1 AND id<>?`,
    documentId, revisionId);

  const supStatusId = q.get(`SELECT id FROM statuses WHERE code='SUP'`).id;
  const appStatusId = q.get(`SELECT id FROM statuses WHERE code='APP'`).id;

  q.tx(() => {
    if (prevCurrent) {
      q.run(
        `UPDATE document_revisions SET is_current=0, status_id=?, superseded_by_revision_id=? WHERE id=?`,
        supStatusId, revisionId, prevCurrent.id);
    }
    q.run(
      `UPDATE document_revisions SET is_current=1, status_id=?, approval_date=date('now'),
       approver_user_id=COALESCE(approver_user_id, ?), file_id=COALESCE(file_id,?) WHERE id=?`,
      appStatusId, actor.id, fileId, revisionId);
    q.run(`UPDATE documents SET current_revision_id=?, updated_at=datetime('now') WHERE id=?`, revisionId, documentId);
  });

  audit({
    user: actor, action: 'REVISION_APPROVED', entityType: 'DOCUMENT', entityId: documentId,
    next: { revision: rev.revision_code, superseded: prevCurrent ? prevCurrent.revision_code : null }
  });

  const doc = q.get(`SELECT doc_number, dcc_user_id, created_by FROM documents WHERE id=?`, documentId);
  const targets = [doc.dcc_user_id, doc.created_by].filter(Boolean);
  notify('APPROVAL_COMPLETED', {
    assigneeIds: targets, entityType: 'DOCUMENT', entityId: documentId,
    title: 'Document approved',
    body: `${doc.doc_number} Rev ${rev.revision_code} approved and now controlled.`,
    vars: { docNumber: doc.doc_number, revision: rev.revision_code, outcome: 'approved' }
  });
  if (prevCurrent) {
    notify('SUPERSEDED', {
      assigneeIds: targets, entityType: 'DOCUMENT', entityId: documentId,
      title: 'Revision superseded',
      body: `${doc.doc_number} Rev ${prevCurrent.revision_code} superseded by Rev ${rev.revision_code}.`,
      vars: { docNumber: doc.doc_number, oldRev: prevCurrent.revision_code, newRev: rev.revision_code }
    });
  }
  return true;
}

module.exports = { finalizeApprovedRevision };
