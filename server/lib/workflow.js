'use strict';
const { q } = require('../db');
const { badRequest, notFound } = require('./http');
const { audit } = require('./audit');
const { transition, statusByCode } = require('./statuses');
const { notify } = require('./notify');

/**
 * Reusable workflow engine.
 * A workflow version definition: {steps:[{key,name,type,assignee_type,assignee_value,
 *   deadline_hours,condition}]}
 * Step types: task | review | endorsement | approval | notification
 * Steps with equal seq_no run in parallel (all must complete).
 * Domain side effects (reviews/endorsements/approvals rows) are created on activation,
 * and completing them drives the engine forward.
 */

function activeVersion(workflowCode) {
  return q.get(
    `SELECT v.* FROM workflow_versions v JOIN workflows w ON w.id=v.workflow_id
     WHERE w.code=? AND w.is_active=1 AND v.is_active=1 ORDER BY v.version_no DESC LIMIT 1`, workflowCode);
}

function resolveUser(assigneeType, assigneeValue, fallbackRoleCode) {
  let u = null;
  const v = assigneeValue == null ? '' : String(assigneeValue).trim();
  if (v !== '') {
    // numeric -> user id ; string -> username ; otherwise fall through to role
    if (/^\d+$/.test(v)) u = q.get(`SELECT id FROM users WHERE id=? AND is_active=1`, Number(v));
    if (!u) u = q.get(`SELECT id FROM users WHERE username=? AND is_active=1`, v);
  }
  if (!u) {
    const roleIsName = v !== '' && !/^\d+$/.test(v);
    const roleCode = roleIsName ? v : (assigneeType === 'role' && v !== '' ? v : fallbackRoleCode);
    u = q.get(
      `SELECT id FROM users WHERE is_active=1 AND role_id IN (SELECT id FROM roles WHERE code=?)
       ORDER BY id LIMIT 1`, roleCode);
  }
  return u ? u.id : null;
}

function getDoc(docId) {
  const d = q.get(`SELECT d.*, t.code AS doc_type_code FROM documents d JOIN document_types t ON t.id=d.doc_type_id WHERE d.id=?`, docId);
  if (!d) throw notFound('Document not found');
  return d;
}

function startWorkflow(workflowCode, doc, revisionId, opts = {}) {
  const version = activeVersion(workflowCode);
  if (!version) throw badRequest(`No active workflow template '${workflowCode}'`);
  const def = JSON.parse(version.definition);
  if (!def.steps || !def.steps.length) throw badRequest('Workflow template has no steps');

  return q.tx(() => {
    const inst = q.run(
      `INSERT INTO workflow_instances (workflow_version_id, entity_type, entity_id, started_by, current_step_no, status)
       VALUES (?,?,?,?,0,'running')`,
      version.id, opts.entityType || 'DOCUMENT', doc.id, opts.startedBy
    );
    const instanceId = Number(inst.lastInsertRowid);

    // materialize steps
    def.steps.forEach((s, i) => {
      q.run(
        `INSERT INTO workflow_instance_steps
         (instance_id, seq_no, step_key, name, step_type, assignee_type, assignee_value, parallel_group, deadline_hours, condition_json)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        instanceId, s.seq_no != null ? s.seq_no : i + 1, s.key || `step${i + 1}`, s.name || s.key,
        s.type || 'task', s.assignee_type || 'role', s.assignee_value || '',
        s.parallel_group || null, s.deadline_hours || null, s.condition ? JSON.stringify(s.condition) : null
      );
    });

    audit({
      user: { id: opts.startedBy }, action: 'WORKFLOW_START', entityType: 'DOCUMENT', entityId: doc.id,
      next: { instanceId, workflow: workflowCode }
    });
    activateNext(instanceId, doc.id, revisionId, opts);
    return instanceId;
  });
}

/** Activate every pending step at the lowest pending seq_no */
function activateNext(instanceId, docId, revisionId, opts = {}) {
  const inst = q.get(`SELECT * FROM workflow_instances WHERE id=?`, instanceId);
  if (!inst || inst.status !== 'running') return;

  const next = q.get(
    `SELECT MIN(seq_no) AS n FROM workflow_instance_steps WHERE instance_id=? AND status='pending'`, instanceId
  );
  if (next.n == null) {
    finishInstance(instanceId, 'completed', 'completed');
    return;
  }

  const doc = getDoc(docId);
  q.run(`UPDATE workflow_instances SET current_step_no=? WHERE id=?`, next.n, instanceId);
  const steps = q.all(
    `SELECT * FROM workflow_instance_steps WHERE instance_id=? AND seq_no=? AND status='pending' ORDER BY id`,
    instanceId, next.n
  );

  for (const st of steps) {
    // conditional skip
    if (st.condition_json) {
      try {
        const c = JSON.parse(st.condition_json);
        const val = doc[c.field];
        const pass = c.op === 'eq' ? val === c.value : c.op === 'neq' ? val !== c.value : true;
        if (!pass) {
          q.run(`UPDATE workflow_instance_steps SET status='skipped' WHERE id=?`, st.id);
          continue;
        }
      } catch { /* malformed condition -> run step */ }
    }

    const assignedUserId = resolveUser(
      st.assignee_type,
      (opts.assignments && (opts.assignments[st.step_key] || opts.assignments[st.name])) || st.assignee_value,
      'REVIEWER'
    );
    if (!assignedUserId) throw badRequest(`No active user available to assign step '${st.name}'`);

    const deadlineAt = st.deadline_hours
      ? new Date(Date.now() + st.deadline_hours * 3600 * 1000).toISOString().replace('T', ' ').slice(0, 19)
      : null;
    q.run(
      `UPDATE workflow_instance_steps SET status='active', acted_by=?, deadline_at=? WHERE id=?`,
      assignedUserId, deadlineAt, st.id
    );

    switch (st.step_type) {
      case 'review': {
        const r = q.run(
          `INSERT INTO reviews (document_id, revision_id, reviewer_user_id, assigned_by, review_due_date, status, wf_step_id)
           VALUES (?,?,?,?,?, 'pending', ?)`,
          doc.id, revisionId, assignedUserId, opts.startedBy, opts.reviewDueDate || null, st.id
        );
        transition({
          table: 'documents', idColumn: 'id', statusColumn: 'internal_status_id',
          entityType: 'DOCUMENT', entityId: doc.id, toStatusId: statusByCode('URV').id,
          user: { id: opts.startedBy, role_code: 'DCC' },
          reason: 'Assigned for technical review', workflowRef: instanceId
        });
        notify('REVIEW_ASSIGNED', {
          assigneeIds: [assignedUserId], entityType: 'DOCUMENT', entityId: doc.id,
          title: 'Review assigned',
          body: `You are assigned to review ${doc.doc_number} Rev ${q.get('SELECT revision_code FROM document_revisions WHERE id=?', revisionId).revision_code}.`,
          vars: { docNumber: doc.doc_number, dueDate: opts.reviewDueDate || '-' }
        });
        break;
      }
      case 'endorsement': {
        const endorserId = resolveEndorser(doc, assignedUserId);
        q.run(
          `INSERT INTO endorsements (document_id, revision_id, endorser_user_id, assigned_by, status, wf_step_id)
           VALUES (?,?,?,?,'pending',?)`,
          doc.id, revisionId, endorserId, opts.startedBy, st.id
        );
        transition({
          table: 'documents', idColumn: 'id', statusColumn: 'internal_status_id',
          entityType: 'DOCUMENT', entityId: doc.id, toStatusId: statusByCode('PEND').id,
          user: { id: opts.startedBy, role_code: 'DCC' }, reason: 'Pending endorsement', workflowRef: instanceId
        });
        notify('ENDORSEMENT_ASSIGNED', {
          assigneeIds: [endorserId], entityType: 'DOCUMENT', entityId: doc.id,
          title: 'Endorsement requested',
          body: `Endorsement requested for ${doc.doc_number}.`,
          vars: { docNumber: doc.doc_number }
        });
        break;
      }
      case 'approval': {
        createApproval(doc, revisionId, st, opts, assignedUserId);
        transition({
          table: 'documents', idColumn: 'id', statusColumn: 'internal_status_id',
          entityType: 'DOCUMENT', entityId: doc.id, toStatusId: statusByCode('PAP').id,
          user: { id: opts.startedBy, role_code: 'DCC' }, reason: 'Pending formal approval', workflowRef: instanceId
        });
        break;
      }
      case 'notification':
      case 'task':
      default:
        notify('TASK_ASSIGNED', {
          assigneeIds: [assignedUserId], entityType: 'DOCUMENT', entityId: doc.id,
          title: st.name, body: `${st.name}: ${doc.doc_number}`
        });
    }
  }
}

function resolveEndorser(doc, fallbackUserId) {
  if (doc.endorser_user_id) return doc.endorser_user_id;
  const e = q.get(
    `SELECT id FROM users WHERE is_active=1 AND role_id IN (SELECT id FROM roles WHERE code='ENDORSER') ORDER BY id LIMIT 1`);
  return e ? e.id : fallbackUserId;
}

function createApproval(doc, revisionId, wfStep, opts, fallbackUserId) {
  const mode = (opts.approvalMode || (wfStep.parallel_group ? 'parallel' : 'sequential'));
  let approverIds = [];
  if (opts.approvers && opts.approvers.length) {
    approverIds = opts.approvers.map(a => typeof a === 'object' ? (a.userId || a.id) : a).filter(Boolean);
  }
  if (!approverIds.length && doc.approver_user_id) approverIds = [doc.approver_user_id];
  if (!approverIds.length) {
    const roleUsers = q.all(
      `SELECT id FROM users WHERE is_active=1 AND role_id IN (SELECT id FROM roles WHERE code='APPROVER') ORDER BY id`);
    approverIds = roleUsers.map(u => u.id);
  }
  if (!approverIds.length) approverIds = [fallbackUserId];

  const appr = q.run(
    `INSERT INTO approvals (document_id, revision_id, mode, initiated_by, wf_step_id, deadline_at)
     VALUES (?,?,?,?,?,?)`,
    doc.id, revisionId, mode, opts.startedBy, wfStep.id,
    wfStep.deadline_at || null
  );
  const approvalId = Number(appr.lastInsertRowid);
  approverIds.forEach((uid, i) => {
    q.run(
      `INSERT INTO approval_steps (approval_id, seq_no, approver_user_id, status, deadline_at)
       VALUES (?,?,?,?,?)`,
      approvalId, i + 1, uid,
      mode === 'parallel' ? 'pending' : (i === 0 ? 'pending' : 'waiting'),
      wfStep.deadline_at || null
    );
    notify('APPROVAL_REQUESTED', {
      assigneeIds: [uid], entityType: 'DOCUMENT', entityId: doc.id,
      title: 'Approval requested',
      body: `Your approval is requested for ${doc.doc_number}.`,
      vars: { docNumber: doc.doc_number }
    });
  });
  return approvalId;
}

function finishInstance(instanceId, status, outcome) {
  q.run(
    `UPDATE workflow_instances SET status=?, outcome=?, completed_at=datetime('now')
     WHERE id=?`, status, outcome, instanceId
  );
  q.run(
    `UPDATE workflow_instance_steps SET status=CASE WHEN status IN ('pending','active') THEN 'skipped' ELSE status END
     WHERE instance_id=?`, instanceId
  );
}

/**
 * Complete a domain-driven step (review/endorsement/approval/task).
 * outcome: completed|rejected|skipped ; advances engine or rejects instance.
 */
function completeWfStep(wfStepId, outcome, comments, actedBy) {
  const step = q.get(`SELECT * FROM workflow_instance_steps WHERE id=?`, wfStepId);
  if (!step) throw notFound('Workflow step not found');
  const inst = q.get(`SELECT * FROM workflow_instances WHERE id=?`, step.instance_id);
  if (inst.status !== 'running') throw badRequest('Workflow already finished');

  q.run(
    `UPDATE workflow_instance_steps SET status=?, acted_by=?, acted_at=datetime('now'), comments=?
     WHERE id=?`,
    outcome === 'rejected' ? 'rejected' : outcome === 'skipped' ? 'skipped' : 'completed',
    actedBy, comments || null, wfStepId
  );
  audit({
    user: { id: actedBy }, action: 'WORKFLOW_STEP_' + outcome.toUpperCase(),
    entityType: 'DOCUMENT', entityId: inst.entity_id,
    next: { stepKey: step.step_key, outcome, comments }
  });

  if (outcome === 'rejected') {
    finishInstance(step.instance_id, 'rejected', 'rejected');
    return { finished: true, outcome: 'rejected' };
  }

  const remaining = q.get(
    `SELECT COUNT(*) AS c FROM workflow_instance_steps
     WHERE instance_id=? AND seq_no=(SELECT current_step_no FROM workflow_instances WHERE id=?) AND status='active'`,
    step.instance_id, step.instance_id
  );
  if (remaining.c > 0) return { finished: false };

  const rev = q.get(
    `SELECT r.id FROM document_revisions r JOIN workflow_instances i ON i.entity_type='DOCUMENT' AND i.entity_id=r.document_id
     WHERE i.id=? ORDER BY r.id DESC LIMIT 1`, step.instance_id);
  activateNext(step.instance_id, inst.entity_id, rev ? rev.id : null, { startedBy: actedBy });
  return { finished: false };
}

module.exports = { startWorkflow, completeWfStep, activateNext, finishInstance, activeVersion, getDoc };
