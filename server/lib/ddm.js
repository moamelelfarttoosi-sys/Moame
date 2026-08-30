'use strict';
const { q } = require('../db');
const { badRequest } = require('./http');

/**
 * Document Distribution Matrix — workflow-routing engine.
 * Resolves reviewer(s), endorser, approver and copy recipients for a document
 * from configured DDM rules. Mandatory approvers must not be bypassable.
 * Matching: most specific active rule wins (exact match on each axis, '*' wildcard).
 */
function scoreRule(rule, { discipline, docType, klass, originator }) {
  let score = 0;
  const axis = (ruleVal, val) => {
    if (ruleVal === '*') return 0;
    if (String(ruleVal).toUpperCase() === String(val || '').toUpperCase()) return 1;
    return -1; // disqualify
  };
  score += axis(rule.discipline_code, discipline);
  score += axis(rule.doc_type_code, docType);
  score += axis(rule.class_code, klass);
  score += axis(rule.originator_code, originator);
  return score; // -1 => no match
}

function resolveRouting({ discipline, docType, klass, originator }) {
  const rules = q.all(`SELECT * FROM ddm_rules WHERE is_active=1`);
  let best = null, bestScore = -Infinity;
  for (const r of rules) {
    const s = scoreRule(r, { discipline, docType, klass, originator });
    if (s < 0) continue;
    if (s > bestScore) { best = r; bestScore = s; }
  }
  if (!best) return null;
  return {
    rule_id: best.id,
    reviewer1: best.reviewer1_user_id,
    reviewer2: best.reviewer2_user_id,
    endorser: best.endorser_user_id,
    approver: best.approver_user_id,
    approver_role: best.approver_role_code || 'APPROVER',
    copy_to: JSON.parse(best.copy_to || '[]'),
    business_process_level: best.business_process_level
  };
}

/** Resolve approver: DDM approver -> role users. Throws when unresolvable (mandatory). */
function resolveApproverIds(routing, docApproverId) {
  if (docApproverId) return [Number(docApproverId)];
  if (routing && routing.approver) return [routing.approver];
  const role = routing ? routing.approver_role : 'APPROVER';
  const users = q.all(
    `SELECT id FROM users WHERE is_active=1 AND role_id IN (SELECT id FROM roles WHERE code=?) ORDER BY id`, role);
  if (!users.length) throw badRequest(`DDM routing requires an approver — no active user with role '${role}' available (approver is mandatory)`);
  return users.map(u => u.id);
}

module.exports = { resolveRouting, resolveApproverIds };
