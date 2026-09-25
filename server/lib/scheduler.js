'use strict';
const { q } = require('../db');
const { notify } = require('./notify');

/**
 * Background scheduler: SLA deadline tracking + escalation.
 * Scans reviews/approvals/resolutions/transmittal response dues and
 * emits DEADLINE_APPROACHING / DEADLINE_EXCEEDED / ESCALATION notifications once per period.
 */
let timer = null;
const lastRun = {};

function withinWindow(dateStr, hours) {
  if (!dateStr) return false;
  const t = new Date(String(dateStr).replace(' ', 'T') + 'Z').getTime();
  if (isNaN(t)) return false;
  const now = Date.now();
  return t > now && t - now <= hours * 3600 * 1000;
}

function isOverdue(dateStr) {
  if (!dateStr) return false;
  const t = new Date(String(dateStr).replace(' ', 'T') + 'Z').getTime();
  return !isNaN(t) && t < Date.now();
}

function runOnce() {
  // Reviews overdue -> notify reviewer + DCC escalation
  for (const r of q.all(
    `SELECT r.*, d.doc_number FROM reviews r JOIN documents d ON d.id=r.document_id
     WHERE r.status IN ('pending','in_progress') AND r.review_due_date IS NOT NULL`)) {
    const label = `Review of ${r.doc_number}`;
    if (isOverdue(r.review_due_date)) escalate('review', r.id, label, r.reviewer_user_id, r.review_due_date);
    else if (withinWindow(r.review_due_date, 24)) approaching('review', r.id, label, r.reviewer_user_id, r.review_due_date);
  }

  // Approvals overdue
  for (const a of q.all(
    `SELECT ap.*, d.doc_number FROM approvals ap JOIN documents d ON d.id=ap.document_id
     WHERE ap.status='in_progress' AND ap.deadline_at IS NOT NULL`)) {
    const steps = q.all(`SELECT approver_user_id FROM approval_steps WHERE approval_id=? AND status='pending'`, a.id)
      .map(s => s.approver_user_id).filter(Boolean);
    if (isOverdue(a.deadline_at)) escalate('approval', a.id, `Approval of ${a.doc_number}`, steps[0] || null, a.deadline_at, steps.slice(1));
    else if (withinWindow(a.deadline_at, 24)) approaching('approval', a.id, `Approval of ${a.doc_number}`, steps[0], a.deadline_at);
  }

  // Resolutions overdue -> escalate status + notify
  for (const res of q.all(
    `SELECT * FROM resolutions WHERE status IN ('open','in_progress') AND due_date IS NOT NULL`)) {
    const label = `Resolution ${res.resolution_number}`;
    if (isOverdue(res.due_date)) {
      escalate('resolution', res.id, label, res.responsible_user_id, res.due_date);
      if (res.status !== 'escalated') q.run(`UPDATE resolutions SET status='escalated' WHERE id=?`, res.id);
    } else if (withinWindow(res.due_date, 48)) approaching('resolution', res.id, label, res.responsible_user_id, res.due_date);
  }

  // Transmittal responses due
  for (const t of q.all(
    `SELECT * FROM transmittals WHERE status='issued' AND response_required=1 AND response_due_date IS NOT NULL`)) {
    const label = `Transmittal ${t.trn_number} response`;
    if (isOverdue(t.response_due_date)) escalate('transmittal', t.id, label, t.created_by, t.response_due_date);
    else if (withinWindow(t.response_due_date, 48)) approaching('transmittal', t.id, label, t.created_by, t.response_due_date);
  }

  // SOP & corporate document reviews — reminders before Next Review Due (interval <= 24 months)
  for (const sop of q.all(
    `SELECT s.*, d.doc_number, d.title AS doc_title, ist.code AS status_code
     FROM register_sop s JOIN documents d ON d.id=s.document_id
     JOIN statuses ist ON ist.id=d.internal_status_id
     WHERE d.deleted_at IS NULL AND s.next_review_due IS NOT NULL AND ist.code NOT IN ('SUP','ARC')`)) {
    const label = `Review of ${sop.doc_number} (${sop.doc_title})`;
    const owner = sop.owner_user_id;
    if (isOverdue(sop.next_review_due)) escalate('sop', sop.document_id, label, owner, sop.next_review_due);
    else if (withinWindow(sop.next_review_due, 24 * 30)) approaching('sop', sop.document_id, label, owner, sop.next_review_due);
  }

  // Correspondence reply SLA — overdue / approaching per configurable rules
  for (const c of q.all(
    `SELECT * FROM correspondence WHERE status NOT IN ('responded','closed') AND reply_due_date IS NOT NULL`)) {
    const label = `Correspondence ${c.corr_number} reply`;
    const target = c.focal_point_user_id || c.assigned_user_id || c.created_by;
    if (isOverdue(c.reply_due_date)) escalate('correspondence', c.id, label, target, c.reply_due_date);
    else if (withinWindow(c.reply_due_date, 24 * 3)) approaching('correspondence', c.id, label, target, c.reply_due_date);
  }
}

function keyOf(kind, id, kind2) { return `${kind}:${id}:${kind2}`; }

function approaching(kind, id, label, userId, dueDate) {
  const k = keyOf(kind, id, 'approaching');
  if (lastRun[k]) return;
  lastRun[k] = true;
  notify('DEADLINE_APPROACHING', {
    assigneeIds: userId ? [userId] : [], entityType: kind.toUpperCase(), entityId: id,
    title: 'Deadline approaching',
    body: `${label} is due on ${dueDate}.`, vars: { entityLabel: label, dueDate }
  });
}

function escalate(kind, id, label, userId, dueDate, also = []) {
  const k = keyOf(kind, id, 'escalated');
  if (lastRun[k]) return;
  lastRun[k] = true;
  notify('ESCALATION', {
    assigneeIds: [...new Set([userId, ...also].filter(Boolean))], entityType: kind.toUpperCase(), entityId: id,
    title: 'Escalation: deadline exceeded',
    body: `${label} exceeded its deadline (${dueDate}). Escalated per SLA rules.`,
    vars: { entityLabel: label, dueDate }
  });
}

function start(intervalMs) {
  if (timer) return;
  timer = setInterval(() => {
    try { runOnce(); } catch (e) { console.error('[scheduler]', e.message); }
  }, intervalMs || 60000);
  timer.unref();
  console.log('[scheduler] SLA/escalation monitor started');
}

module.exports = { start, runOnce };
