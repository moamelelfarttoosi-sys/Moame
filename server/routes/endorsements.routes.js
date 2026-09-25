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

router.get('/mine', requirePerm('endorsement.perform'), ah(async (req, res) => {
  ok(res, q.all(
    `SELECT e.id, e.document_id, e.status, e.assigned_at,
            d.doc_number, d.title AS doc_title, rev.revision_code
     FROM endorsements e JOIN documents d ON d.id=e.document_id
     JOIN document_revisions rev ON rev.id=e.revision_id
     WHERE e.endorser_user_id=? AND e.status='pending' ORDER BY e.assigned_at`, req.user.id));
}));

router.get('/:id', ah(async (req, res) => {
  const e = q.get(
    `SELECT e.*, d.doc_number, u.full_name AS endorser_name FROM endorsements e
     JOIN documents d ON d.id=e.document_id JOIN users u ON u.id=e.endorser_user_id WHERE e.id=?`,
    Number(req.params.id));
  if (!e) throw notFound('Endorsement not found');
  ok(res, e);
}));

/** Endorser decision: endorse | reject | return */
router.post('/:id/act', requirePerm('endorsement.perform'), ah(async (req, res) => {
  const id = Number(req.params.id);
  const e = q.get(`SELECT * FROM endorsements WHERE id=?`, id);
  if (!e) throw notFound('Endorsement not found');
  if (e.endorser_user_id !== req.user.id && req.user.role_code !== 'ADMIN') throw forbidden('Not your endorsement');
  if (e.status !== 'pending') throw badRequest('Endorsement already processed');
  const { decision, comments } = req.body || {};
  if (!['endorse', 'reject', 'return'].includes(decision)) throw badRequest('decision must be endorse|reject|return');

  const doc = q.get(`SELECT doc_number, dcc_user_id FROM documents WHERE id=?`, e.document_id);

  if (decision === 'endorse') {
    q.run(`UPDATE endorsements SET status='endorsed', comments=?, acted_at=datetime('now') WHERE id=?`,
      comments || null, id);
    q.run(`UPDATE endorsements SET endorser_user_id=COALESCE(endorser_user_id, ?) WHERE id=?`, req.user.id, id);
    audit({ user: req.user, action: 'ENDORSE', entityType: 'DOCUMENT', entityId: e.document_id, next: { decision, comments } });
    notify('ENDORSEMENT_COMPLETED', {
      assigneeIds: [doc.dcc_user_id].filter(Boolean), entityType: 'DOCUMENT', entityId: e.document_id,
      title: 'Endorsed',
      body: `${doc.doc_number} endorsed by ${req.user.full_name}.`,
      vars: { docNumber: doc.doc_number, outcome: 'endorsed', userName: req.user.full_name }
    });
    if (e.wf_step_id) completeWfStep(e.wf_step_id, 'completed', comments, req.user.id);
  } else if (decision === 'reject') {
    q.run(`UPDATE endorsements SET status='rejected', comments=?, acted_at=datetime('now') WHERE id=?`, comments || null, id);
    transition({
      table: 'documents', idColumn: 'id', statusColumn: 'internal_status_id',
      entityType: 'DOCUMENT', entityId: e.document_id, toStatusId: statusByCode('REJ').id,
      user: req.user, reason: 'Rejected at endorsement', comment: comments
    });
    audit({ user: req.user, action: 'REJECT', entityType: 'DOCUMENT', entityId: e.document_id, next: { stage: 'endorsement', comments } });
    if (e.wf_step_id) completeWfStep(e.wf_step_id, 'rejected', comments, req.user.id);
  } else {
    q.run(`UPDATE endorsements SET status='returned', comments=?, acted_at=datetime('now') WHERE id=?`, comments || null, id);
    if (e.wf_step_id) {
      const step = q.get(`SELECT * FROM workflow_instance_steps WHERE id=?`, e.wf_step_id);
      q.run(`UPDATE workflow_instances SET status='cancelled', outcome='returned_to_dcc', completed_at=datetime('now')
             WHERE id=? AND status='running'`, step.instance_id);
      q.run(`UPDATE workflow_instance_steps SET status='skipped' WHERE instance_id=? AND status IN ('pending','active')`, step.instance_id);
    }
    transition({
      table: 'documents', idColumn: 'id', statusColumn: 'internal_status_id',
      entityType: 'DOCUMENT', entityId: e.document_id, toStatusId: statusByCode('REG').id,
      user: req.user, reason: 'Returned by endorser', comment: comments
    });
    audit({ user: req.user, action: 'ENDORSEMENT_RETURNED', entityType: 'DOCUMENT', entityId: e.document_id, next: { comments } });
  }
  ok(res, q.get(`SELECT * FROM endorsements WHERE id=?`, id));
}));

module.exports = router;
