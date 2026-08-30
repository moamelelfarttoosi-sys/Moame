'use strict';
const { q } = require('../db');

/**
 * Configurable numbering engine.
 * Pattern = JSON array of components, e.g.
 *   [{type:'token',value:'YEAR'}, {type:'literal',value:'-'}, {type:'token',value:'PROJECT'}, ...]
 * Tokens: YEAR PROJECT CONTRACT DOCTYPE DISCIPLINE CATEGORY ORG SYSTEM AREA PACKAGE SEQ REV
 * Sequence scopes: RULE | RULE_YEAR | RULE_YEAR_PROJECT | RULE_PROJECT
 * If the pattern contains literal separators equal to rule.separator they are authoritative;
 * empty resolved tokens are skipped cleanly.
 */

const pad = (n, len) => String(n).padStart(len || 4, '0');
const clean = s => String(s == null ? '' : s).replace(/[^A-Za-z0-9_-]/g, '').toUpperCase();

function loadRule(ruleRef) {
  let rule;
  if (typeof ruleRef === 'number') rule = q.get(`SELECT * FROM numbering_rules WHERE id=? AND is_active=1`, ruleRef);
  else rule = q.get(`SELECT * FROM numbering_rules WHERE code=? AND is_active=1`, ruleRef);
  if (!rule) throw new Error(`Numbering rule not found or inactive: ${ruleRef}`);
  return rule;
}

function resolveToken(token, ctx, seqStr) {
  switch (token) {
    case 'YEAR': return String(ctx.year || new Date().getFullYear());
    case 'PROJECT': return clean(ctx.projectCode);
    case 'CONTRACT': return clean(ctx.contractNumber);
    case 'DOCTYPE': return clean(ctx.docTypeCode);
    case 'DISCIPLINE': return clean(ctx.disciplineCode);
    case 'CATEGORY': return clean(ctx.categoryCode);
    case 'ORG': return clean(ctx.orgCode);
    case 'SYSTEM': return clean(ctx.system);
    case 'AREA': return clean(ctx.area);
    case 'PACKAGE': return clean(ctx.package);
    case 'SEQ': return seqStr;
    case 'REV': return clean(ctx.revision) || '0';
    default: throw new Error(`Unknown numbering token: ${token}`);
  }
}

function buildNumber(comps, rule, ctx, seqStr) {
  const hasSepLit = comps.some(c => c.type === 'literal' && String(c.value) === rule.separator);
  let out = '';
  let pending = false;
  const push = v => {
    if (!v) return;
    const useSep = hasSepLit ? pending : !!out;
    out = out ? out + (useSep ? rule.separator : '') + v : v;
    pending = false;
  };
  for (const c of comps) {
    if (c.type === 'literal') {
      if (String(c.value) === rule.separator) { pending = true; continue; }
      push(String(c.value));
    } else {
      const val = resolveToken(c.value, ctx, seqStr);
      if (!val) { pending = true; continue; }
      push(val);
    }
  }
  return out;
}

/** Generate next number atomically (concurrency-safe sequence increment). */
function nextNumber(ruleRef, ctx = {}, userId = null, entityType = null) {
  const rule = loadRule(ruleRef);
  const comps = JSON.parse(rule.pattern);
  const year = String(new Date().getFullYear());

  let scopeKey;
  switch (rule.sequence_scope) {
    case 'RULE': scopeKey = 'ALL'; break;
    case 'RULE_YEAR': scopeKey = year; break;
    case 'RULE_YEAR_PROJECT': scopeKey = `${year}|${ctx.projectCode || '-'}`; break;
    case 'RULE_PROJECT': scopeKey = `${ctx.projectCode || '-'}`; break;
    default: scopeKey = year;
  }

  q.exec('BEGIN IMMEDIATE');
  try {
    q.run(
      `INSERT INTO numbering_sequences (rule_id, scope_key, last_value) VALUES (?,?,0)
       ON CONFLICT (rule_id, scope_key) DO NOTHING`, rule.id, scopeKey
    );
    const row = q.get(`SELECT last_value FROM numbering_sequences WHERE rule_id=? AND scope_key=?`, rule.id, scopeKey);
    const nextVal = row.last_value + 1;
    q.run(`UPDATE numbering_sequences SET last_value=? WHERE rule_id=? AND scope_key=?`, nextVal, rule.id, scopeKey);

    const number = buildNumber(comps, rule, { ...ctx, year }, pad(nextVal, rule.sequence_length));

    q.run(
      `INSERT INTO numbering_history (rule_id, generated_number, entity_type, generated_by)
       VALUES (?,?,?,?)`,
      rule.id, number, entityType || rule.entity_type, userId
    );
    q.exec('COMMIT');
    return number;
  } catch (e) {
    q.exec('ROLLBACK');
    throw e;
  }
}

/** Preview without consuming the sequence */
function previewNumber(ruleRef, ctx = {}) {
  const rule = loadRule(ruleRef);
  const comps = JSON.parse(rule.pattern);
  const row = q.get(
    `SELECT last_value FROM numbering_sequences WHERE rule_id=? AND scope_key LIKE '%'||?||'%' ORDER BY scope_key LIMIT 1`,
    rule.id, String(ctx.projectCode || '-')
  );
  const seqStr = pad((row ? row.last_value : 0) + 1, rule.sequence_length);
  return buildNumber(comps, rule, { ...ctx, year: String(new Date().getFullYear()) }, seqStr);
}

module.exports = { nextNumber, previewNumber, loadRule };
