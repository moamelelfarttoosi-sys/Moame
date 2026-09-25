'use strict';
const express = require('express');
const { q } = require('../db');
const { ah, ok, badRequest, notFound, forbidden } = require('../lib/http');
const { requireAuth, requirePerm } = require('../lib/auth');
const { audit } = require('../lib/audit');
const { notify } = require('../lib/notify');
const { completeWfStep } = require('../lib/workflow');
const { transition, statusByCode } = require('../lib/statuses');

const router = express.Router();
router.use(requireAuth);

function reviewWithDoc(id) {
  return q.get(
    `SELECT r.*, d.doc_number, d.title AS doc_title, rev.revision_code,
            u.full_name AS reviewer_name FROM reviews r
     JOIN documents d ON d.id=r.document_id
     JOIN document_revisions rev ON rev.id=r.revision_id
     JOIN users u ON u.id=r.reviewer_user_id
     WHERE r.id=?`, id);
}

router.get('/mine', requirePerm('review.perform'), ah(async (req, res) => {
  ok(res, q.all(
    `SELECT r.id, r.document_id, r.status, r.assigned_at, r.review_due_date, r.completed_at,
            d.doc_number, d.title AS doc_title, rev.revision_code
     FROM reviews r JOIN documents d ON d.id=r.document_id
     JOIN document_revisions rev ON rev.id=r.revision_id
     WHERE r.reviewer_user_id=? AND r.status IN ('pending','in_progress') ORDER BY r.review_due_date IS NULL, r.review_due_date`, req.user.id));
}));

router.get('/:id', ah(async (req, res) => {
  const r = reviewWithDoc(Number(req.params.id));
  if (!r) throw notFound('Review not found');
  r.comments = q.all(
    `SELECT c.*, u.full_name AS user_name FROM review_comments c JOIN users u ON u.id=c.user_id
     WHERE c.review_id=? ORDER BY c.id`, r.id);
  ok(res, r);
}));

router.post('/:id/start', requirePerm('review.perform'), ah(async (req, res) => {
  const r = reviewWithDoc(Number(req.params.id));
  if (!r) throw notFound('Review not found');
  if (r.reviewer_user_id !== req.user.id && req.user.role_code !== 'ADMIN') throw forbidden('Not your review');
  if (r.status !== 'pending') throw badRequest('Review already started');
  q.run(`UPDATE reviews SET status='in_progress' WHERE id=?`, r.id);
  audit({ user: req.user, action: 'REVIEW_START', entityType: 'DOCUMENT', entityId: r.document_id });
  ok(res, reviewWithDoc(r.id));
}));

router.post('/:id/comments', requirePerm('review.perform'), ah(async (req, res) => {
  const r = reviewWithDoc(Number(req.params.id));
  if (!r) throw notFound('Review not found');
  const { comment } = req.body || {};
  if (!comment || !comment.trim()) throw badRequest('Comment required');
  q.run(`INSERT INTO review_comments (review_id, user_id, comment) VALUES (?,?,?)`,
    r.id, req.user.id, comment.trim());
  q.run(`UPDATE reviews SET status=CASE WHEN status='pending' THEN 'in_progress' ELSE status END WHERE id=?`, r.id);
  audit({ user: req.user, action: 'COMMENT', entityType: 'DOCUMENT', entityId: r.document_id, next: { comment } });
  res.status(201).json({ data: { posted: true } });
}));

/**
 * Complete review.
 * outcome: approve | reject | request_changes | return_to_dcc
 */
router.post('/:id/complete', requirePerm('review.perform'), ah(async (req, res) => {
  const r = reviewWithDoc(Number(req.params.id));
  if (!r) throw notFound('Review not found');
  if (r.reviewer_user_id !== req.user.id && req.user.role_code !== 'ADMIN') throw forbidden('Not your review');
  const { outcome, comments } = req.body || {};
  if (!['approve', 'reject', 'request_changes', 'return_to_dcc'].includes(outcome)) {
    throw badRequest('outcome must be approve|reject|request_changes|return_to_dcc');
  }
  if (comments) q.run(`INSERT INTO review_comments (review_id, user_id, comment) VALUES (?,?,?)`, r.id, req.user.id, comments);

  const docStatus = (code) => statusByCode(code).id;

  if (outcome === 'approve') {
    q.run(`UPDATE reviews SET status='approved', outcome_comments=?, completed_at=datetime('now') WHERE id=?`,
      comments || null, r.id);
    if (r.wf_step_id) completeWfStep(r.wf_step_id, 'completed', comments, req.user.id);
    else transition({
      table: 'documents', idColumn: 'id', statusColumn: 'internal_status_id',
      entityType: 'DOCUMENT', entityId: r.document_id, toStatusId: docStatus('PEND'),
      user: req.user, reason: 'Review approved'
    });
    audit({ user: req.user, action: 'REVIEW_COMPLETE', entityType: 'DOCUMENT', entityId: r.document_id, next: { outcome } });
    notify('REVIEW_COMPLETED', {
      assigneeIds: [r.dcc_user_id || r.assigned_by].filter(Boolean), entityType: 'DOCUMENT', entityId: r.document_id,
      title: 'Review completed',
      body: `${r.doc_number} review approved by ${req.user.full_name}.`,
      vars: { docNumber: r.doc_number, userName: req.user.full_name, outcome: 'approved' }
    });
  } else if (outcome === 'reject') {
    q.run(`UPDATE reviews SET status='rejected', outcome_comments=?, completed_at=datetime('now') WHERE id=?`,
      comments || null, r.id);
    if (r.wf_step_id) completeWfStep(r.wf_step_id, 'rejected', comments, req.user.id);
    transition({
      table: 'documents', idColumn: 'id', statusColumn: 'internal_status_id',
      entityType: 'DOCUMENT', entityId: r.document_id, toStatusId: docStatus('REJ'),
      user: req.user, reason: 'Rejected at review', comment: comments
    });
    audit({ user: req.user, action: 'REJECT', entityType: 'DOCUMENT', entityId: r.document_id, next: { outcome } });
    notify('REJECTED', {
      assigneeIds: [r.dcc_user_id || r.assigned_by].filter(Boolean), entityType: 'DOCUMENT', entityId: r.document_id,
      title: 'Document rejected at review',
      body: `${r.doc_number} rejected by ${req.user.full_name}. Reason: ${comments || '-'}`,
      vars: { docNumber: r.doc_number, userName: req.user.full_name, reason: comments || '-' }
    });
  } else {
    // request_changes / return_to_dcc — control returns to DCC; workflow instance closed as returned
    q.run(`UPDATE reviews SET status=?, outcome_comments=?, completed_at=datetime('now') WHERE id=?`,
      outcome === 'reject' ? 'rejected' : outcome === 'request_changes' ? 'changes_requested' : 'returned_to_dcc',
      comments || null, r.id);
    if (r.wf_step_id) {
      const step = q.get(`SELECT * FROM workflow_instance_steps WHERE id=?`, r.wf_step_id);
      q.run(`UPDATE workflow_instances SET status='cancelled', outcome='returned_to_dcc', completed_at=datetime('now')
             WHERE id=? AND status='running'`, step.instance_id);
      q.run(`UPDATE workflow_instance_steps SET status='skipped' WHERE instance_id=? AND status IN ('pending','active')`, step.instance_id);
    }
    transition({
      table: 'documents', idColumn: 'id', statusColumn: 'internal_status_id',
      entityType: 'DOCUMENT', entityId: r.document_id, toStatusId: docStatus('REG'),
      user: req.user, reason: `Returned by reviewer (${outcome})`, comment: comments
    });
    audit({ user: req.user, action: 'REVIEW_RETURNED', entityType: 'DOCUMENT', entityId: r.document_id, next: { outcome, comments } });
    notify('DOC_REFERRED', {
      assigneeIds: [r.dcc_user_id || r.assigned_by].filter(Boolean), entityType: 'DOCUMENT', entityId: r.document_id,
      title: `Returned to DCC (${outcome})`,
      body: `${r.doc_number}: ${comments || ''}`,
      vars: { docNumber: r.doc_number }
    });
  }
  ok(res, reviewWithDoc(r.id));
}));

module.exports = router;
