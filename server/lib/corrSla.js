'use strict';
const { q } = require('../db');

/**
 * Correspondence SLA engine — configurable response periods.
 * Stored in sla_rules (entity_type='CORRESPONDENCE_SLA', priority=party code).
 * Control model: BOC/MOO/UEG = 7 days, Contractors/Vendors = 10 days, Urgent = 3 days.
 * Values are configuration, never hard-coded.
 */
function slaDaysFor(counterpartyCode, urgency) {
  if (String(urgency || '').toLowerCase() === 'urgent') {
    const urgent = q.get(
      `SELECT days FROM sla_rules WHERE entity_type='CORRESPONDENCE_SLA' AND priority='URGENT' AND is_active=1`);
    if (urgent) return urgent.days;
  }
  const rule = q.get(
    `SELECT days FROM sla_rules WHERE entity_type='CORRESPONDENCE_SLA' AND priority=? AND is_active=1`,
    String(counterpartyCode || '').toUpperCase());
  if (rule) return rule.days;
  const fallback = q.get(
    `SELECT days FROM sla_rules WHERE entity_type='CORRESPONDENCE_SLA' AND priority='CONTRACTOR' AND is_active=1`);
  return fallback ? fallback.days : 10;
}

function addDays(dateStr, days) {
  const d = new Date(String(dateStr || '').slice(0, 10) + 'T00:00:00Z');
  if (isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() + Number(days));
  return d.toISOString().slice(0, 10);
}

/** Compute reply_due_date + persist. Returns {reply_days_allowed, reply_due_date}. */
function applySla({ counterparty_code, urgency, received_date, corr_date }) {
  const days = slaDaysFor(counterparty_code, urgency);
  const base = received_date || corr_date || new Date().toISOString().slice(0, 10);
  return { reply_days_allowed: days, reply_due_date: addDays(base, days) };
}

/** Days overdue for open correspondence (computed live). */
function overdueExpr() {
  return `CASE WHEN status NOT IN ('responded','closed') AND reply_due_date IS NOT NULL
             THEN CAST(MAX(0, julianday('now') - julianday(reply_due_date)) AS INTEGER)
             ELSE 0 END`;
}

module.exports = { slaDaysFor, addDays, applySla, overdueExpr };
