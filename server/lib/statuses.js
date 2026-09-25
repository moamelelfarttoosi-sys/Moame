'use strict';
const { q } = require('../db');
const { badRequest, forbidden } = require('./http');
const { audit } = require('./audit');

/** Configurable status engine with transition rules + mandatory audit trail. */

function statusById(id) { return q.get(`SELECT * FROM statuses WHERE id=?`, id); }
function statusByCode(code) { return q.get(`SELECT * FROM statuses WHERE code=?`, code); }

/**
 * Validate + apply a status transition on any entity having *_status_id column.
 * Records previous/new value, reason, comment, workflow reference into audit_logs.
 */
function transition({ table, idColumn, statusColumn, entityType, entityId, toStatusId, user, reason, comment, workflowRef, extraSet }) {
  const row = q.get(`SELECT * FROM ${table} WHERE ${idColumn} = ?`, entityId);
  if (!row) throw badRequest(`${entityType} ${entityId} not found`);
  const fromId = row[statusColumn];

  if (fromId === toStatusId) return row;
  const tr = q.get(
    `SELECT t.* FROM status_transitions t
     WHERE t.from_status_id IS ? AND t.to_status_id = ?`, fromId, toStatusId
  );
  if (!tr && fromId != null) {
    throw badRequest(`Invalid status transition ${fromId} -> ${toStatusId}: not configured`);
  }
  if (tr) {
    const roles = JSON.parse(tr.allowed_roles || '[]');
    if (roles.length && !roles.includes(user.role_code)) {
      throw forbidden(`Role '${user.role_code}' may not perform this status transition`);
    }
    if (tr.reason_required && !reason) throw badRequest('Reason is required for this status transition');
  }

  const setExtra = extraSet ? `, ${extraSet}` : '';
  q.run(`UPDATE ${table} SET ${statusColumn} = ?, updated_at = datetime('now')${setExtra} WHERE ${idColumn} = ?`,
    toStatusId, entityId);

  audit({
    user,
    action: 'STATUS_CHANGE',
    entityType, entityId,
    prev: { [statusColumn]: fromId },
    next: { [statusColumn]: toStatusId },
    details: JSON.stringify({ reason: reason || null, comment: comment || null, workflowRef: workflowRef || null })
  });
  return q.get(`SELECT * FROM ${table} WHERE ${idColumn} = ?`, entityId);
}

function listTransitions(fromStatusId, roleCode) {
  return q.all(
    `SELECT s.* FROM status_transitions t JOIN statuses s ON s.id = t.to_status_id
     WHERE t.from_status_id IS ?
       AND (t.allowed_roles IN ('[]','') OR t.allowed_roles LIKE ?)`,
    fromStatusId, `%"${roleCode}"%`
  );
}

module.exports = { transition, statusById, statusByCode, listTransitions };
