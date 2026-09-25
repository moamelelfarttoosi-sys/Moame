'use strict';
const { q } = require('../db');
const { badRequest, conflict } = require('./http');

/**
 * Controlled Code Registry — validation & governance.
 * A code that does not exist in the registry is invalid unless explicitly free-text.
 * Codes are never deleted: active -> inactive -> retired.
 */
const CODE_SETS = ['DEPARTMENT', 'SECTION', 'DISCIPLINE', 'DOCTYPE', 'ORIGINATOR', 'CLASS', 'LANGUAGE', 'PROJECT'];

function getCode(codeSet, code) {
  return q.get(`SELECT * FROM controlled_codes WHERE code_set=? AND code=?`, codeSet, String(code || '').trim());
}

/** Throws when code is provided but not present+active in the registry. */
function assertCode(codeSet, code, { allowEmpty = true } = {}) {
  if (code == null || String(code).trim() === '') {
    if (allowEmpty) return null;
    throw badRequest(`${codeSet} code is required`);
  }
  const row = getCode(codeSet, code);
  if (!row) throw badRequest(`Invalid ${codeSet} code: "${code}" — not in controlled code registry`);
  if (row.lifecycle !== 'active') {
    throw badRequest(`${codeSet} code "${code}" is ${row.lifecycle} and may not be used on new records`);
  }
  return row;
}

function listCodes(codeSet, { includeInactive = false } = {}) {
  const where = includeInactive ? 'WHERE code_set=?' : 'WHERE code_set=? AND lifecycle=\'active\'';
  return q.all(`SELECT * FROM controlled_codes ${where} ORDER BY sort_order, code`, codeSet);
}

/** Governance transitions: active -> inactive -> retired only. Never delete. */
function setLifecycle(id, lifecycle, userId) {
  const row = q.get(`SELECT * FROM controlled_codes WHERE id=?`, id);
  if (!row) throw badRequest('Code not found');
  const allowed = { active: ['inactive'], inactive: ['active', 'retired'], retired: [] };
  if (!allowed[row.lifecycle].includes(lifecycle)) {
    throw badRequest(`Cannot change lifecycle from '${row.lifecycle}' to '${lifecycle}' (allowed: ${allowed[row.lifecycle].join(', ') || 'none — retired is final'})`);
  }
  if (lifecycle === 'inactive') {
    // block deactivation while any active document still uses the code
    const colMap = { DEPARTMENT: 'department_code', SECTION: 'section_code', DISCIPLINE: null, DOCTYPE: null, ORIGINATOR: 'originator_code', CLASS: 'class_code', LANGUAGE: null };
    const col = colMap[row.code_set];
    if (col) {
      const used = q.get(`SELECT COUNT(*) c FROM documents WHERE ${col}=? AND deleted_at IS NULL`, row.code).c;
      if (used > 0) throw badRequest(`Code "${row.code}" is used by ${used} active document(s) — resolve usage before deactivating`);
    }
  }
  q.run(`UPDATE controlled_codes SET lifecycle=?, updated_at=datetime('now'), updated_by=? WHERE id=?`, lifecycle, userId, id);
  return q.get(`SELECT * FROM controlled_codes WHERE id=?`, id);
}

module.exports = { CODE_SETS, getCode, assertCode, listCodes, setLifecycle };
