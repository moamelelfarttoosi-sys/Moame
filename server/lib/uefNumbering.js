'use strict';
const { q } = require('../db');
const { badRequest, conflict } = require('./http');
const { assertCode } = require('./codes');

/**
 * UEF Dual Document Numbering Engine.
 *  CORPORATE: UEF-DEP-SEC-DDD-EEEE   (e.g. UEF-PO-DC-PD-0001)  — numeric revisions 00,01,02...
 *  PROJECT:   UEF-PRID-SS-CCC-DDD-EEEE (e.g. UEF-3120-01-PIP-DWG-0001) — alpha revisions A..V, X final
 * Series isolation: sequence runs independently per unique series key.
 * Allocated numbers are locked forever — never reused, even when cancelled/voided.
 */

const pad4 = n => String(n).padStart(4, '0');

function seriesKey(scheme, { department, section, docType, prid, ss, discipline }) {
  return scheme === 'CORPORATE'
    ? `C|${department}|${section}|${docType}`
    : `P|${prid}|${ss}|${discipline}|${docType}`;
}

/** Atomic allocation: check series -> generate next sequence -> lock. */
function allocateNumber({ scheme, department, section, docType, prid, ss, discipline }, userId) {
  if (!['CORPORATE', 'PROJECT'].includes(scheme)) throw badRequest('scheme must be CORPORATE or PROJECT');
  if (scheme === 'CORPORATE') {
    assertCode('DEPARTMENT', department, { allowEmpty: false });
    assertCode('SECTION', section, { allowEmpty: false });
  } else {
    if (!prid || !/^\d{3,6}$/.test(String(prid))) throw badRequest('PRID required for project numbers (3-6 digits, e.g. 3120)');
    if (!ss || !/^\d{1,2}$/.test(String(ss))) throw badRequest('Service Order / Sub-Serial (SS) required (e.g. 01)');
    assertCode('DISCIPLINE', discipline, { allowEmpty: false });
  }
  assertCode('DOCTYPE', docType, { allowEmpty: false });

  const key = seriesKey(scheme, { department, section, docType, prid, ss, discipline });
  q.exec('BEGIN IMMEDIATE');
  try {
    q.run(
      `INSERT INTO uef_series (series_key, scheme, prid, ss, department, section, discipline, doc_type, last_seq)
       VALUES (?,?,?,?,?,?,?,?,0)
       ON CONFLICT (series_key) DO NOTHING`,
      key, scheme, prid || null, ss || null, department || null, section || null, discipline || null, docType
    );
    const row = q.get(`SELECT last_seq FROM uef_series WHERE series_key=?`, key);
    const seq = row.last_seq + 1;
    q.run(`UPDATE uef_series SET last_seq=? WHERE series_key=?`, seq, key);

    const number = scheme === 'CORPORATE'
      ? ['UEF', department, section, docType, pad4(seq)].join('-')
      : ['UEF', prid, ss, discipline, docType, pad4(seq)].join('-');

    // global duplicate guard (belt & braces — sequences are per-series)
    const dup = q.get(`SELECT id FROM number_allocations WHERE generated_number=?`, number)
      || q.get(`SELECT id FROM documents WHERE doc_number=? COLLATE NOCASE`, number);
    if (dup) { throw conflict(`Generated number already exists: ${number}`); }
    q.exec('COMMIT');
    return { number, sequence: seq, seriesKey: key };
  } catch (e) {
    q.exec('ROLLBACK');
    throw e;
  }
}

/** Gap control: detect missing/duplicate/reserved/cancelled/unused numbers per series. */
function gapCheck(seriesKeyFilter) {
  const series = seriesKeyFilter
    ? q.all(`SELECT * FROM uef_series WHERE series_key=?`, seriesKeyFilter)
    : q.all(`SELECT * FROM uef_series ORDER BY series_key`);
  const report = [];
  for (const s of series) {
    const allocs = q.all(
      `SELECT request_number, generated_number, sequence, decision, status, proposed_title
       FROM number_allocations WHERE series_key=? AND generated_number IS NOT NULL ORDER BY sequence`, s.series_key);
    const bySeq = new Map();
    const duplicates = [];
    for (const a of allocs) {
      if (bySeq.has(a.sequence)) duplicates.push({ sequence: a.sequence, numbers: [bySeq.get(a.sequence).generated_number, a.generated_number] });
      bySeq.set(a.sequence, a);
    }
    // numbers issued into DCR
    const issued = new Set(q.all(
      `SELECT allocation_id FROM documents WHERE allocation_id IS NOT NULL AND deleted_at IS NULL`).map(d => d.allocation_id));
    const missing = [];
    for (let i = 1; i <= s.last_seq; i++) {
      if (!bySeq.has(i)) missing.push({ sequence: i, note: 'unexplained gap — requires Document Control explanation' });
    }
    const unused = allocs
      .filter(a => !issued.has(a.id) && ['allocated', 'cancelled'].includes(a.decision))
      .map(a => ({ number: a.generated_number, decision: a.decision, note: a.decision === 'cancelled' ? 'cancelled — number locked, never reused' : 'allocated but not yet issued' }));
    report.push({
      series_key: s.series_key, scheme: s.scheme, last_seq: s.last_seq,
      allocated_count: allocs.length,
      missing_gaps: missing,
      duplicates,
      unused_locked: unused,
      healthy: missing.length === 0 && duplicates.length === 0
    });
  }
  return report;
}

/** Revision code per scheme. CORPORATE: 00,01,02.. | PROJECT: A..V then X (final). */
function nextRevisionCode(scheme, currentCode) {
  if (scheme === 'CORPORATE') {
    const n = parseInt(currentCode, 10);
    if (isNaN(n)) return '00';
    const next = n + 1;
    if (next > 99) throw badRequest('Corporate revision limit reached (99)');
    return String(next).padStart(2, '0');
  }
  // PROJECT: legacy numeric ('0','1',...) -> start at A
  if (!/^[A-Z]$/.test(String(currentCode).toUpperCase())) return 'A';
  const cur = String(currentCode).toUpperCase();
  if (cur === 'X') throw badRequest('Rev X is final documentation — no further revisions');
  if (cur === 'V') return 'X'; // X reserved for final documentation
  const next = String.fromCharCode(cur.charCodeAt(0) + 1);
  if (next === 'W') return 'X'; // W skipped, X reserved for final
  return next;
}

/** Detect scheme from a UEF-format document number. */
function schemeFromNumber(docNumber) {
  const parts = String(docNumber || '').split('-');
  if (parts.length === 5 && parts[0].toUpperCase() === 'UEF') return 'CORPORATE';
  if (parts.length === 6 && parts[0].toUpperCase() === 'UEF') return 'PROJECT';
  return null;
}

module.exports = { allocateNumber, gapCheck, nextRevisionCode, seriesKey, schemeFromNumber };
