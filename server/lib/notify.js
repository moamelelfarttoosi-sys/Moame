'use strict';
const fs = require('fs');
const path = require('path');
const config = require('../config');
const { q } = require('../db');

/**
 * Centralized notification engine.
 * Rules per event_code control inapp/email delivery + targeting.
 * Email mode 'outbox' writes RFC822 .eml files to storage/outbox (pluggable SMTP).
 */

function renderTemplate(tpl, vars) {
  return String(tpl || '').replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : ''));
}

function resolveTargets(rule, { actorId, assigneeIds, roleCode }) {
  switch (rule.target_mode) {
    case 'role': {
      const users = roleCode
        ? q.all(`SELECT id FROM users WHERE is_active=1 AND role_id IN (SELECT id FROM roles WHERE code=?)`, roleCode)
        : [];
      return users.map(u => u.id);
    }
    case 'assignee': return assigneeIds || [];
    case 'custom': return assigneeIds || []; // caller passes explicit list via assigneeIds
    case 'actor':
    default: return actorId ? [actorId] : [];
  }
}

function deliverEmail(userId, title, body) {
  const u = q.get(`SELECT email, full_name FROM users WHERE id=?`, userId);
  if (!u) return;
  if (config.smtp.mode === 'smtp' && config.smtp.host) {
    // Production: plug nodemailer/SMTP relay here.
    console.log(`[notify:smtp] -> ${u.email}: ${title}`);
    return;
  }
  const eml = [
    `From: ${config.smtp.from}`,
    `To: ${u.full_name} <${u.email}>`,
    `Subject: ${title}`,
    `Date: ${new Date().toUTCString()}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=utf-8`,
    ``,
    body
  ].join('\r\n');
  const fname = `${Date.now()}-${userId}-${title.replace(/[^\w]+/g, '_').slice(0, 40)}.eml`;
  fs.writeFileSync(path.join(config.outboxDir, fname), eml);
}

/**
 * notify(eventCode, {actorId, assigneeIds, roleCode, entityType, entityId, vars})
 * Vars interpolate into subject/body templates from notification_rules.
 */
function notify(eventCode, opts = {}) {
  try {
    const rule = q.get(`SELECT * FROM notification_rules WHERE event_code=? AND is_active=1`, eventCode);
    const title = renderTemplate(opts.title || eventCode, opts.vars || {});
    const body = renderTemplate(opts.body || '', opts.vars || {});
    const targets = rule ? resolveTargets(rule, opts) : (opts.assigneeIds || (opts.actorId ? [opts.actorId] : []));
    for (const uid of [...new Set(targets)]) {
      if (!uid) continue;
      if (!rule || rule.inapp_enabled) {
        q.run(
          `INSERT INTO notifications (user_id, event_code, channel, title, body, entity_type, entity_id)
           VALUES (?,?,?,?,?,?,?)`,
          uid, eventCode, 'inapp', title, body, opts.entityType || null, opts.entityId ?? null
        );
      }
      if (rule && rule.email_enabled) deliverEmail(uid, title, body);
    }
  } catch (e) {
    console.error(`[notify:${eventCode}] failed:`, e.message);
  }
}

const EVENTS = {
  DOC_REGISTERED: ['Document registered', '{docNumber} "{docTitle}" was registered by {userName}.'],
  NUMBER_ALLOCATED: ['Document number allocated', 'Number {docNumber} was allocated ({seriesKey}).'],
  REVIEW_ASSIGNED: ['Review assigned', 'You are assigned to review {docNumber} Rev {revision} — due {dueDate}.'],
  REVIEW_COMPLETED: ['Review completed', '{docNumber} review completed by {userName} with outcome: {outcome}.'],
  ENDORSEMENT_ASSIGNED: ['Endorsement requested', 'Endorsement requested for {docNumber} Rev {revision}.'],
  ENDORSEMENT_COMPLETED: ['Endorsement completed', '{docNumber} endorsement: {outcome} ({userName}).'],
  APPROVAL_REQUESTED: ['Approval requested', 'Your approval is requested for {docNumber} Rev {revision}.'],
  APPROVAL_COMPLETED: ['Approval completed', '{docNumber} Rev {revision} approval outcome: {outcome}.'],
  REJECTED: ['Rejected', '{docNumber} was rejected by {userName}. Reason: {reason}'],
  DOC_REFERRED: ['Referred to contractor', '{docNumber} has been referred back to the contractor.'],
  REVISION_CREATED: ['Revision created', 'New revision {revision} created for {docNumber}.'],
  SUPERSEDED: ['Revision superseded', '{docNumber} Rev {oldRev} superseded by Rev {newRev}.'],
  TRANSMITTAL_ISSUED: ['Transmittal issued', 'Transmittal {trnNumber} issued to your organization.'],
  ACK_RECEIVED: ['Acknowledgement received', 'Transmittal {trnNumber} acknowledged by {orgName}.'],
  CORRESPONDENCE_NEW: ['New correspondence', '{corrNumber}: {subject}'],
  MEMO_ISSUED: ['Memo issued', 'Memo {memoNumber}: {subject}'],
  RESOLUTION_ASSIGNED: ['Resolution action assigned', 'Resolution {resNumber} assigned to you — due {dueDate}.'],
  DEADLINE_APPROACHING: ['Deadline approaching', '{entityLabel} due on {dueDate}.'],
  DEADLINE_EXCEEDED: ['Deadline exceeded', '{entityLabel} is overdue (due {dueDate}).'],
  ESCALATION: ['Escalation', '{entityLabel} escalated.'],
  ARCHIVED: ['Archived', '{entityLabel} archived.']
};

/** Seed default notification rules */
function seedRules() {
  for (const [code, [desc]] of Object.entries(EVENTS)) {
    q.run(
      `INSERT INTO notification_rules (event_code, description, inapp_enabled, email_enabled, target_mode)
       VALUES (?,?,1,0,'assignee') ON CONFLICT (event_code) DO NOTHING`, code, desc
    );
  }
}

module.exports = { notify, seedRules, EVENTS };
