'use strict';
const express = require('express');
const { q } = require('../db');
const { ah, ok, badRequest, notFound, forbidden } = require('../lib/http');
const { requireAuth, requirePerm } = require('../lib/auth');
const { audit } = require('../lib/audit');
const { notify } = require('../lib/notify');
const { completeWfStep } = require('../lib/workflow');
const { transition, statusByCode } = require('../lib/statuses');
const { finalizeApprovedRevision } = require('../lib/revisionControl');

const router = express.Router();
router.use(requireAuth);

function approvalDetail(id) {
  const a = q.get(
    `SELECT a.*, d.doc_number, d.title AS doc_title, rev.revision_code
     FROM approvals a JOIN documents d ON d.id=a.document_id
     JOIN document_revisions rev ON rev.id=a.revision_id WHERE a.id=?`, id);
  if (!a) return null;
  a.steps = q.all(
    `SELECT st.*, u.full_name AS approver_name FROM approval_steps st
     LEFT JOIN users u ON u.id=st.approver_user_id WHERE st.approval_id=? ORDER BY st.seq_no`, id);
  return a;
}

/** Approvals awaiting MY action (pending steps assigned to me) */
router.get('/mine', requirePerm('approval.perform'), ah(async (req, res) => {
  ok(res, q.all(
    `SELECT st.id AS step_id, st.approval_id, st.seq_no, st.status AS step_status, st.deadline_at,
            a.mode, a.status AS approval_status, d.id AS document_id, d.doc_number, d.title AS doc_title,
            rev.revision_code
     FROM approval_steps st
     JOIN approvals a ON a.id=st.approval_id AND a.status='in_progress'
     JOIN documents d ON d.id=a.document_id
     JOIN document_revisions rev ON rev.id=a.revision_id
     WHERE st.approver_user_id=? AND st.status='pending' ORDER BY st.deadline_at IS NULL, st.deadline_at`, req.user.id));
}));

router.get('/:id', ah(async (req, res) => {
  const a = approvalDetail(Number(req.params.id));
  if (!a) throw notFound('Approval not found');
  ok(res, a);
}));

/**
 * Act on an approval step.
 * decision: approve | reject ; supports delegation & reassignment via /delegate & /reassign.
 */
router.post('/:id/steps/:stepId/act', requirePerm('approval.perform'), ah(async (req, res) => {
  const approvalId = Number(req.params.id);
  const stepId = Number(req.params.stepId);
  const a = q.get(`SELECT * FROM approvals WHERE id=?`, approvalId);
  if (!a) throw notFound('Approval not found');
  if (a.status !== 'in_progress') throw badRequest('Approval already finalized');
  const step = q.get(`SELECT * FROM approval_steps WHERE id=? AND approval_id=?`, stepId, approvalId);
  if (!step) throw notFound('Approval step not found');
  if (step.approver_user_id !== req.user.id && req.user.role_code !== 'ADMIN') throw forbidden('Not your approval step');
  if (step.status === 'waiting') throw forbidden('Sequential approval: previous approver has not acted yet');
  if (step.status !== 'pending') throw badRequest('Step already processed');

  const { decision, comments } = req.body || {};
  if (!['approve', 'reject'].includes(decision)) throw badRequest('decision must be approve|reject');
  const doc = q.get(`SELECT doc_number, dcc_user_id FROM documents WHERE id=?`, a.document_id);

  if (decision === 'reject') {
    q.tx(() => {
      q.run(`UPDATE approval_steps SET status='rejected', comments=?, acted_at=datetime('now') WHERE id=?`, comments || null, stepId);
      q.run(`UPDATE approvals SET status='rejected', completed_at=datetime('now') WHERE id=?`, approvalId);
      q.run(`UPDATE approval_steps SET status='skipped' WHERE approval_id=? AND status IN ('waiting','pending')`, approvalId);
      // revision rejected
      q.run(`UPDATE document_revisions SET status_id=(SELECT id FROM statuses WHERE code='REJ') WHERE id=?`, a.revision_id);
    });
    transition({
      table: 'documents', idColumn: 'id', statusColumn: 'internal_status_id',
      entityType: 'DOCUMENT', entityId: a.document_id, toStatusId: statusByCode('REJ').id,
      user: req.user, reason: 'Rejected at approval', comment: comments
    });
    audit({ user: req.user, action: 'APPROVAL_REJECTED', entityType: 'DOCUMENT', entityId: a.document_id, next: { decision, comments } });
    notify('REJECTED', {
      assigneeIds: [doc.dcc_user_id].filter(Boolean), entityType: 'DOCUMENT', entityId: a.document_id,
      title: 'Document rejected at approval',
      body: `${doc.doc_number} rejected by ${req.user.full_name}. Reason: ${comments || '-'}`,
      vars: { docNumber: doc.doc_number, userName: req.user.full_name, reason: comments || '-' }
    });
    if (a.wf_step_id) completeWfStep(a.wf_step_id, 'rejected', comments, req.user.id);
    return ok(res, approvalDetail(approvalId));
  }

  q.run(`UPDATE approval_steps SET status='approved', comments=?, acted_at=datetime('now') WHERE id=?`, comments || null, stepId);
  audit({ user: req.user, action: 'APPROVE_STEP', entityType: 'DOCUMENT', entityId: a.document_id, next: { stepId, decision } });

  const remaining = q.get(
    `SELECT COUNT(*) c FROM approval_steps WHERE approval_id=? AND status IN ('waiting','pending')`, approvalId).c;

  if (remaining > 0) {
    if (a.mode === 'sequential') {
      // activate next waiting step + notify
      const next = q.get(
        `SELECT * FROM approval_steps WHERE approval_id=? AND status='waiting' ORDER BY seq_no LIMIT 1`, approvalId);
      if (next) {
        q.run(`UPDATE approval_steps SET status='pending' WHERE id=?`, next.id);
        notify('APPROVAL_REQUESTED', {
          assigneeIds: [next.approver_user_id].filter(Boolean), entityType: 'DOCUMENT', entityId: a.document_id,
          title: 'Approval requested',
          body: `Your sequential approval is requested for ${doc.doc_number}.`,
          vars: { docNumber: doc.doc_number }
        });
      }
    }
    return ok(res, approvalDetail(approvalId));
  }

  // all approved -> finalize
  q.run(`UPDATE approvals SET status='approved', completed_at=datetime('now') WHERE id=?`, approvalId);
  finalizeApprovedRevision({ documentId: a.document_id, revisionId: a.revision_id, actor: req.user });
  transition({
    table: 'documents', idColumn: 'id', statusColumn: 'internal_status_id',
    entityType: 'DOCUMENT', entityId: a.document_id, toStatusId: statusByCode('APP').id,
    user: req.user, reason: 'Formally approved'
  });
  audit({ user: req.user, action: 'APPROVAL_COMPLETE', entityType: 'DOCUMENT', entityId: a.document_id, next: { outcome: 'approved' } });
  if (a.wf_step_id) completeWfStep(a.wf_step_id, 'completed', comments, req.user.id);
  ok(res, approvalDetail(approvalId));
}));

/** Delegation: hand my pending step to another user */
router.post('/:id/steps/:stepId/delegate', requirePerm('approval.perform'), ah(async (req, res) => {
  const { delegate_to } = req.body || {};
  const target = q.get(`SELECT id, username FROM users WHERE (id=? OR username=?) AND is_active=1`,
    Number(delegate_to) || 0, String(delegate_to || ''));
  if (!target) throw badRequest('Delegate target user not found');
  const step = q.get(
    `SELECT st.* FROM approval_steps st JOIN approvals a ON a.id=st.approval_id
     WHERE st.id=? AND st.approval_id=?`, Number(req.params.stepId), Number(req.params.id));
  if (!step) throw notFound('Step not found');
  if (step.approver_user_id !== req.user.id && req.user.role_code !== 'ADMIN') throw forbidden();
  q.run(`UPDATE approval_steps SET approver_user_id=? WHERE id=?`, target.id, step.id);
  audit({ user: req.user, action: 'DELEGATE', entityType: 'APPROVAL_STEP', entityId: step.id, next: { delegatedTo: target.username } });
  notify('APPROVAL_REQUESTED', {
    assigneeIds: [target.id], entityType: 'DOCUMENT', entityId: null,
    title: 'Delegated approval', body: `${req.user.full_name} delegated an approval to you.`
  });
  ok(res, { delegated: true });
}));

/** DCC reassignment of any pending step */
router.post('/:id/steps/:stepId/reassign', requirePerm('document.edit'), ah(async (req, res) => {
  const { user: usernameOrId } = req.body || {};
  const target = q.get(`SELECT id, username FROM users WHERE (id=? OR username=?) AND is_active=1`,
    Number(usernameOrId) || 0, String(usernameOrId || ''));
  if (!target) throw badRequest('Target user not found');
  const step = q.get(
    `SELECT st.* FROM approval_steps st JOIN approvals a ON a.id=st.approval_id
     WHERE st.id=? AND st.approval_id=?`, Number(req.params.stepId), Number(req.params.id));
  if (!step) throw notFound('Step not found');
  if (step.status !== 'pending') throw badRequest('Only pending steps can be reassigned');
  q.run(`UPDATE approval_steps SET approver_user_id=? WHERE id=?`, target.id, step.id);
  audit({ user: req.user, action: 'REASSIGN', entityType: 'APPROVAL_STEP', entityId: step.id, next: { reassignedTo: target.username } });
  ok(res, { reassigned: true });
}));

module.exports = router;
