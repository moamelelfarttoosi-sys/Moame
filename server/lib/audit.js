'use strict';
const { q } = require('../db');

/**
 * Append an audit record. Never throws into request flow; audit failure is logged.
 * Immutable at DB level via triggers.
 */
function audit({ user, action, entityType, entityId, prev, next, ip, sessionId, details }) {
  try {
    q.run(
      `INSERT INTO audit_logs (user_id, username, action, entity_type, entity_id, prev_value, new_value, ip, session_id, details)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      user ? user.id : null,
      user ? (user.full_name || user.username || `user-${user.id}`) : 'system',
      action,
      entityType,
      entityId == null ? null : Number(entityId),
      prev == null ? null : JSON.stringify(prev),
      next == null ? null : JSON.stringify(next),
      ip || null,
      sessionId || null,
      details || null
    );
  } catch (e) {
    console.error('[audit] failed:', e.message);
  }
}

module.exports = { audit };
