'use strict';
const express = require('express');
const { q } = require('../db');
const { ah, ok, badRequest, notFound, conflict, pagination } = require('../lib/http');
const { requireAuth, requirePerm, scopeFilterFor, assertCanSeeDocument } = require('../lib/auth');
const { audit } = require('../lib/audit');
const { nextNumber } = require('../lib/numbering');
const { transition, statusByCode } = require('../lib/statuses');
const { storeFile } = require('../lib/storage');
const { notify } = require('../lib/notify');
const { assertCode } = require('../lib/codes');
const { nextRevisionCode, schemeFromNumber } = require('../lib/uefNumbering');
const { resolveRouting, resolveApproverIds } = require('../lib/ddm');

const router = express.Router();
router.use(requireAuth);

const DOC_FIELDS = [
  'title', 'direction', 'doc_type_id', 'category_id', 'project_id', 'contract_id', 'discipline_id',
  'department_id', 'originator_org_id', 'customer_org_id', 'contractor_org_id', 'location', 'area',
  'system', 'package', 'work_package', 'phase', 'purpose_id', 'confidentiality', 'security_classification',
  'keywords', 'remarks', 'retention_rule_id', 'parent_document_id', 'endorser_user_id', 'dcc_user_id',
  'reviewer_user_id', 'approver_user_id', 'transmittal_ref', 'correspondence_ref',
  'document_date', 'receipt_date', 'accept_date', 'due_date', 'review_due_date',
  // UEF DCR extension fields
  'register_type', 'prid', 'so_po', 'owner_user_id', 'class_code', 'pages_sheets',
  'supersedes_document_id', 'archive_location', 'department_code', 'section_code',
  'originator_code', 'numbering_scheme', 'allocation_id'
];
const REGISTER_TYPES = ['DCR', 'TDR', 'MDR', 'VDR', 'SOP'];

function docAggregate(id) {
  const d = q.get(
    `SELECT d.*,
            t.code AS doc_type_code, t.name AS doc_type_name,
            p.code AS project_code, p.name AS project_name,
            c.number AS contract_number,
            disc.code AS discipline_code, disc.name AS discipline_name,
            ist.code AS internal_status_code, ist.name AS internal_status_name, ist.color AS internal_status_color,
            est.code AS external_status_code, est.name AS external_status_name,
            pur.code AS purpose_code, pur.name AS purpose_name,
            cat.code AS category_code,
            oo.name AS originator_org_name, co.name AS customer_org_name, ko.name AS contractor_org_name,
            rr.code AS retention_code,
            uc.username AS created_by_username,
            ow.full_name AS owner_name
     FROM documents d
     JOIN document_types t ON t.id=d.doc_type_id
     LEFT JOIN projects p ON p.id=d.project_id
     LEFT JOIN contracts c ON c.id=d.contract_id
     LEFT JOIN disciplines disc ON disc.id=d.discipline_id
     JOIN statuses ist ON ist.id=d.internal_status_id
     LEFT JOIN statuses est ON est.id=d.external_status_id
     LEFT JOIN purposes pur ON pur.id=d.purpose_id
     LEFT JOIN categories cat ON cat.id=d.category_id
     LEFT JOIN organizations oo ON oo.id=d.originator_org_id
     LEFT JOIN organizations co ON co.id=d.customer_org_id
     LEFT JOIN organizations ko ON ko.id=d.contractor_org_id
     LEFT JOIN retention_rules rr ON rr.id=d.retention_rule_id
     LEFT JOIN users uc ON uc.id=d.created_by
     LEFT JOIN users ow ON ow.id=d.owner_user_id
     WHERE d.id=? AND d.deleted_at IS NULL`, id);
  return d;
}

// ---------------- Register document ----------------
router.post('/', requirePerm('document.create'), ah(async (req, res) => {
  const b = req.body || {};
  for (const f of ['title', 'doc_type_id']) {
    if (!b[f]) throw badRequest(`Mandatory field missing: ${f}`);
  }
  if (typeof b.title !== 'string' || !b.title.trim()) throw badRequest('title must be a non-empty string');
  if (b.title.length > 500) throw badRequest('title exceeds 500 characters');
  if (b.pages_sheets !== undefined && b.pages_sheets !== '' &&
      (!Number.isInteger(Number(b.pages_sheets)) || Number(b.pages_sheets) < 0)) {
    throw badRequest('Pages/Sheets must be a non-negative integer');
  }
  if (b.confidentiality !== undefined &&
      !['Public', 'Internal', 'Confidential', 'Strictly Confidential'].includes(b.confidentiality)) {
    throw badRequest('confidentiality must be Public, Internal, Confidential or Strictly Confidential');
  }
  let docType = q.get(`SELECT * FROM document_types WHERE id=? AND is_active=1`, b.doc_type_id);
  if (!docType) {
    // Resolve controlled_codes DOCTYPE ID → old document_types record by code
    const ccType = q.get(`SELECT code FROM controlled_codes WHERE id=? AND code_set='DOCTYPE' AND lifecycle='active'`, b.doc_type_id);
    if (ccType) docType = q.get(`SELECT * FROM document_types WHERE code=? AND is_active=1`, ccType.code);
  }
  if (!docType) throw badRequest('Invalid document type');
  b.doc_type_id = docType.id;
  // Support project_id (legacy) or prid (Project Register code)
  let projectRecord = null;
  if (b.project_id) {
    projectRecord = q.get(`SELECT id, code FROM projects WHERE id=?`, b.project_id);
  }
  if (!projectRecord && b.prid) {
    projectRecord = q.get(`SELECT id, code FROM projects WHERE code=?`, String(b.prid).trim());
    if (projectRecord) b.project_id = projectRecord.id;
  }
  if (!projectRecord) throw badRequest('project_id or prid is required');
  if (!['incoming', 'outgoing', 'internal'].includes(b.direction || 'internal')) throw badRequest('Invalid direction');
  if (b.register_type && !REGISTER_TYPES.includes(String(b.register_type).toUpperCase())) {
    throw badRequest('register_type must be DCR, TDR, MDR, VDR or SOP');
  }
  // UEF controlled-code validation — invalid codes are rejected, never silently accepted
  assertCode('CLASS', b.class_code);
  assertCode('DEPARTMENT', b.department_code);
  assertCode('SECTION', b.section_code);
  assertCode('ORIGINATOR', b.originator_code);
  if (b.supersedes_document_id && !q.get(`SELECT id FROM documents WHERE id=? AND deleted_at IS NULL`, b.supersedes_document_id)) {
    throw badRequest('Supersedes document not found');
  }

  // Resolve controlled_codes IDs → old table records by code (FK constraint)
  if (b.discipline_id) {
    const oldDisc = q.get(`SELECT id FROM disciplines WHERE id=?`, b.discipline_id);
    if (!oldDisc) {
      const ccDisc = q.get(`SELECT code FROM controlled_codes WHERE id=? AND code_set='DISCIPLINE'`, b.discipline_id);
      if (ccDisc) {
        const resolved = q.get(`SELECT id FROM disciplines WHERE code=?`, ccDisc.code);
        if (resolved) b.discipline_id = resolved.id; else b.discipline_id = null;
      }
    }
  }
  if (b.department_id) {
    const oldDept = q.get(`SELECT id FROM departments WHERE id=?`, b.department_id);
    if (!oldDept) {
      const ccDept = q.get(`SELECT code FROM controlled_codes WHERE id=? AND code_set='DEPARTMENT'`, b.department_id);
      if (ccDept) {
        const resolved = q.get(`SELECT id FROM departments WHERE code=?`, ccDept.code);
        if (resolved) b.department_id = resolved.id; else b.department_id = null;
      }
    }
  }

  // Document number: provided, allocated, or generated by configurable engine
  let docNumber = String(b.doc_number || '').trim();
  let allocation = null;
  // An allocation_id must always resolve to a locked, unissued allocation whose
  // generated number matches — regardless of the number's format.
  if (b.allocation_id) {
    allocation = q.get(`SELECT * FROM number_allocations WHERE id=?`, Number(b.allocation_id));
    if (!allocation) throw badRequest('Allocation not found');
    if (!allocation.generated_number) throw badRequest('Allocation has no generated number — allocate it first');
    if (docNumber && docNumber !== allocation.generated_number) {
      throw badRequest(`Allocation ${allocation.request_number} issued number ${allocation.generated_number}, not ${docNumber}`);
    }
    docNumber = allocation.generated_number;
    if (allocation.decision === 'issued') throw conflict('Allocation already issued to another document');
    if (allocation.decision !== 'allocated') throw badRequest(`Allocation is ${allocation.decision} — cannot register`);
  }
  if (docNumber) {
    if (q.get(`SELECT id FROM documents WHERE doc_number=? COLLATE NOCASE`, docNumber)) {
      throw conflict(`Duplicate document number: ${docNumber}`);
    }
    // UEF numbers must come from the allocation log — users never self-assign
    if (/^UEF-/i.test(docNumber) && !allocation) {
      throw badRequest('UEF document numbers must be allocated via the Number Allocation module (allocation_id required)');
    }
  } else {
    const ctx = {
      projectCode: projectRecord.code,
      disciplineCode: b.discipline_id ? q.get(`SELECT code FROM disciplines WHERE id=?`, b.discipline_id)?.code : '',
      docTypeCode: docType.code,
      categoryCode: b.category_id ? q.get(`SELECT code FROM categories WHERE id=?`, b.category_id)?.code : '',
      orgCode: b.originator_org_id ? q.get(`SELECT code FROM organizations WHERE id=?`, b.originator_org_id)?.code : '',
      system: b.system, area: b.area, package: b.package
    };
    docNumber = nextNumber(docType.numbering_rule_id || 'DOC-DEFAULT', ctx, req.user.id, 'DOCUMENT');
    if (q.get(`SELECT id FROM documents WHERE doc_number=? COLLATE NOCASE`, docNumber)) {
      throw conflict(`Generated number collides: ${docNumber}`); // duplicate prevention
    }
  }

  // numbering scheme: allocation > explicit > detected from number > register default
  const scheme = (allocation && allocation.scheme)
    || (b.numbering_scheme && ['CORPORATE', 'PROJECT'].includes(b.numbering_scheme) ? b.numbering_scheme : null)
    || schemeFromNumber(docNumber)
    || (String(b.register_type || '').toUpperCase() === 'SOP' || String(b.register_type || '').toUpperCase() === 'MDR' ? 'CORPORATE' : 'PROJECT');

  const regStatus = statusByCode('REG');
  const vals = {};
  for (const f of DOC_FIELDS) if (b[f] !== undefined && b[f] !== '') vals[f] = b[f];
  vals.title = String(b.title).trim();
  vals.direction = b.direction || 'internal';

  const r = q.tx(() => {
    const entryNumber = (q.get(`SELECT COALESCE(MAX(entry_number),0)+1 AS n FROM documents`).n);
    const valKeys = Object.keys(vals);
    const colList = [...valKeys, 'doc_number', 'internal_status_id', 'dcc_user_id', 'created_by', 'registered_at', 'entry_number', 'numbering_scheme'];
    const placeholders = [...valKeys.map(() => '?'), '?', '?', '?', '?', "datetime('now')", '?', '?'];
    const ins = q.run(
      `INSERT INTO documents (${colList.join(',')}) VALUES (${placeholders.join(',')})`,
      ...valKeys.map(k => vals[k]), docNumber, regStatus.id,
      vals.dcc_user_id || req.user.id, req.user.id, entryNumber, scheme
    );
    const docId = Number(ins.lastInsertRowid);

    // lock the allocation to this document (number never reused)
    if (allocation) {
      q.run(`UPDATE number_allocations SET decision='issued', status='Issued to DCR entry '||? WHERE id=?`, String(docId), allocation.id);
    }

    // register extension record
    const rt = String(b.register_type || 'DCR').toUpperCase();
    if (rt === 'TDR') {
      q.run(`INSERT OR REPLACE INTO register_tdr (document_id, s_n, typical, planned_revision, sheets) VALUES (?,?,?,?,?)`,
        docId, b.s_n || null, ['Typical', 'Non-Typical'].includes(b.typical) ? b.typical : 'Typical',
        b.planned_revision || null, b.sheets || null);
    } else if (rt === 'MDR') {
      q.run(`INSERT OR REPLACE INTO register_mdr (document_id, deliverable_category, planned_revision) VALUES (?,?,?)`,
        docId, b.deliverable_category || null, b.planned_revision || null);
    } else if (rt === 'VDR') {
      q.run(`INSERT OR REPLACE INTO register_vdr (document_id, vendor_doc_number, vendor_org_id, po_number, mr_number, system_area, mrb_included) VALUES (?,?,?,?,?,?,?)`,
        docId, b.vendor_doc_number || docNumber, b.vendor_org_id || null, b.po_number || null,
        b.mr_number || null, b.system_area || null, b.mrb_included ? 1 : 0);
    } else if (rt === 'SOP') {
      if (b.review_interval_months !== undefined && (!Number.isInteger(Number(b.review_interval_months)) || Number(b.review_interval_months) < 1 || Number(b.review_interval_months) > 24)) {
        throw badRequest('Review interval must be 1-24 months (maximum 24 per control model)');
      }
      const interval = Number(b.review_interval_months || 12);
      q.run(`INSERT OR REPLACE INTO register_sop (document_id, section_code, owner_user_id, issue_date, approving_order, review_interval_months, next_review_due, linked_forms)
             VALUES (?,?,?,?,?,?,date(?, '+${interval} month'),?)`,
        docId, b.section_code || null, b.owner_user_id || null, b.issue_date || null,
        b.approving_order || null, interval, b.issue_date || null, b.linked_forms || null);
    }

    // initial revision — code per scheme (CORPORATE: 00,01… | PROJECT: A,B… per UEF §15)
    const revCode = b.revision_code || (scheme === 'CORPORATE' ? '00' : 'A');
    q.run(
      `INSERT INTO document_revisions (document_id, revision_code, revision_date, author_user_id, reviewer_user_id,
        endorser_user_id, approver_user_id, status_id, is_current, created_by)
       VALUES (?,?,?,?,?,?,?,(SELECT id FROM statuses WHERE code='DFT'),1,?)`,
      docId, revCode, b.document_date || null,
      vals.author_user_id || req.user.id,
      vals.reviewer_user_id || b.reviewer_user_id || null,
      vals.endorser_user_id || b.endorser_user_id || null,
      vals.approver_user_id || b.approver_user_id || null,
      req.user.id
    );
    return docId;
  });

  const doc = docAggregate(r);
  audit({ user: req.user, action: 'CREATE', entityType: 'DOCUMENT', entityId: r, next: doc });
  notify('DOC_REGISTERED', {
    assigneeIds: [req.user.id], entityType: 'DOCUMENT', entityId: r,
    title: 'Document registered',
    body: `${docNumber} "${doc.title}" registered.`,
    vars: { docNumber, docTitle: doc.title, userName: req.user.full_name }
  });
  res.status(201).json({ data: doc });
}));

// ---------------- List / filter registers ----------------
router.get('/', ah(async (req, res) => {
  const { page, pageSize, limit, offset } = pagination(req.query);
  const where = [`d.deleted_at IS NULL`];
  const params = [];
  const addEq = (col, val) => { if (val) { where.push(`d.${col}=?`); params.push(val); } };
  addEq('direction', req.query.direction);
  addEq('project_id', req.query.project_id);
  addEq('prid', req.query.prid);
  addEq('contract_id', req.query.contract_id);
  addEq('discipline_id', req.query.discipline_id);
  addEq('doc_type_id', req.query.doc_type_id);
  addEq('purpose_id', req.query.purpose_id);
  addEq('internal_status_id', req.query.internal_status_id);
  addEq('external_status_id', req.query.external_status_id);
  addEq('contractor_org_id', req.query.contractor_org_id);
  addEq('originator_org_id', req.query.organization_id);
  if (req.query.status_code) { where.push(`ist.code IN (SELECT code FROM statuses WHERE code=?)`); params.push(req.query.status_code); }
  if (req.query.search) {
    where.push('(d.doc_number LIKE ? OR d.title LIKE ?)');
    params.push(`%${req.query.search}%`, `%${req.query.search}%`);
  }
  const seg = scopeFilterFor(req.user);
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const sortWhitelist = {
    doc_number: 'd.doc_number', title: 'd.title', receipt_date: 'd.receipt_date',
    registered_at: 'd.registered_at', updated_at: 'd.updated_at', due_date: 'd.due_date'
  };
  const sortCol = sortWhitelist[req.query.sort_by] || 'd.registered_at';
  const sortDir = req.query.sort_dir === 'asc' ? 'ASC' : 'DESC';

  const rows = q.all(
    `SELECT d.id, d.doc_number, d.title, d.receipt_date, d.accept_date, d.due_date, d.register_type, d.prid, d.so_po, d.class_code,
            (SELECT r.revision_code FROM document_revisions r WHERE r.document_id=d.id AND r.is_current=1 ORDER BY r.id DESC LIMIT 1) AS revision_label,
            ist.code AS internal_status_code, est.code AS external_status_code,
            t.code AS doc_type_code, disc.code AS discipline_code,
            p.code AS project_code, c.number AS contract_number,
            co.name AS customer_name, ko.name AS contractor_name,
            ru.full_name AS reviewer_name, eu.full_name AS endorser_name, au.full_name AS approver_name,
            du.username AS dcc_name, d.updated_at
     FROM documents d
     JOIN statuses ist ON ist.id=d.internal_status_id
     LEFT JOIN statuses est ON est.id=d.external_status_id
     JOIN document_types t ON t.id=d.doc_type_id
     LEFT JOIN disciplines disc ON disc.id=d.discipline_id
     LEFT JOIN projects p ON p.id=d.project_id
     LEFT JOIN contracts c ON c.id=d.contract_id
     LEFT JOIN organizations co ON co.id=d.customer_org_id
     LEFT JOIN organizations ko ON ko.id=d.contractor_org_id
     LEFT JOIN users ru ON ru.id=d.reviewer_user_id
     LEFT JOIN users eu ON eu.id=d.endorser_user_id
     LEFT JOIN users au ON au.id=d.approver_user_id
     LEFT JOIN users du ON du.id=d.dcc_user_id
     ${w} ${seg.sql}
     ORDER BY ${sortCol} ${sortDir}, d.id DESC
     LIMIT ? OFFSET ?`, ...params, ...seg.params, limit, offset);

  const total = q.get(
    `SELECT COUNT(*) c FROM documents d JOIN statuses ist ON ist.id=d.internal_status_id ${w} ${seg.sql}`,
    ...params, ...seg.params).c;

  ok(res, rows, { page, pageSize, total });
}));

router.get('/:id', ah(async (req, res) => {
  const doc = docAggregate(Number(req.params.id));
  if (!doc) throw notFound('Document not found');
  assertCanSeeDocument(req.user, doc);
  audit({ user: req.user, action: 'VIEW', entityType: 'DOCUMENT', entityId: doc.id });
  ok(res, buildDocumentDetail(doc));
}));

function buildDocumentDetail(doc) {
  const revisions = q.all(
    `SELECT r.*, s.name AS status_name, s.code AS status_code,
            f.original_name AS file_name, f.size_bytes, f.mime_type,
            ua.full_name AS author_name, ur.full_name AS reviewer_name, ue.full_name AS endorser_name, ua2.full_name AS approver_name
     FROM document_revisions r
     JOIN statuses s ON s.id=r.status_id
     LEFT JOIN files f ON f.id=r.file_id
     LEFT JOIN users ua ON ua.id=r.author_user_id
     LEFT JOIN users ur ON ur.id=r.reviewer_user_id
     LEFT JOIN users ue ON ue.id=r.endorser_user_id
     LEFT JOIN users ua2 ON ua2.id=r.approver_user_id
     WHERE r.document_id=? ORDER BY r.id DESC`, doc.id);
  for (const rev of revisions) {
    rev.versions = q.all(
      `SELECT v.*, f.original_name, f.size_bytes, f.mime_type, u.full_name AS uploaded_by_name
       FROM document_versions v JOIN files f ON f.id=v.file_id JOIN users u ON u.id=v.uploaded_by
       WHERE v.revision_id=? ORDER BY v.version_no DESC`, rev.id);
  }
  const workflow = q.all(
    `SELECT i.id AS instance_id, i.status, i.outcome, i.started_at, i.completed_at, wv.version_no, w.code AS workflow_code,
            i.current_step_no
     FROM workflow_instances i
     JOIN workflow_versions wv ON wv.id=i.workflow_version_id
     JOIN workflows w ON w.id=wv.workflow_id
     WHERE i.entity_type='DOCUMENT' AND i.entity_id=? ORDER BY i.id DESC`, doc.id);
  for (const inst of workflow) {
    inst.steps = q.all(
      `SELECT s.*, u.full_name AS acted_by_name FROM workflow_instance_steps s
       LEFT JOIN users u ON u.id=s.acted_by WHERE s.instance_id=? ORDER BY s.seq_no, s.id`, inst.instance_id);
  }

  return {
    ...doc,
    revisions,
    workflow,
    reviews: q.all(
      `SELECT r.*, u.full_name AS reviewer_name, ab.full_name AS assigned_by_name
       FROM reviews r JOIN users u ON u.id=r.reviewer_user_id JOIN users ab ON ab.id=r.assigned_by
       WHERE r.document_id=? ORDER BY r.id DESC`, doc.id),
    review_comments: q.all(
      `SELECT rc.*, u.full_name AS user_name FROM review_comments rc
       JOIN reviews r ON r.id=rc.review_id JOIN users u ON u.id=rc.user_id
       WHERE r.document_id=? ORDER BY rc.id DESC`, doc.id),
    endorsements: q.all(
      `SELECT e.*, u.full_name AS endorser_name FROM endorsements e JOIN users u ON u.id=e.endorser_user_id
       WHERE e.document_id=? ORDER BY e.id DESC`, doc.id),
    approvals: q.all(
      `SELECT a.*, ab.full_name AS initiated_by_name FROM approvals a JOIN users ab ON ab.id=a.initiated_by
       WHERE a.document_id=? ORDER BY a.id DESC`, doc.id).map(a => ({
        ...a,
        steps: q.all(
          `SELECT st.*, u.full_name AS approver_name FROM approval_steps st LEFT JOIN users u ON u.id=st.approver_user_id
           WHERE st.approval_id=? ORDER BY st.seq_no`, a.id)
      })),
    transmittals: q.all(
      `SELECT DISTINCT t.id, t.trn_number, t.subject, t.status, t.trn_date
       FROM transmittals t JOIN transmittal_items ti ON ti.transmittal_id=t.id
       WHERE ti.document_id=? ORDER BY t.id DESC`, doc.id),
    attachments: q.all(
      `SELECT a.id, f.original_name, f.size_bytes, f.mime_type, f.id AS file_id, a.uploaded_at, u.full_name AS uploaded_by_name
       FROM attachments a JOIN files f ON f.id=a.file_id JOIN users u ON u.id=a.uploaded_by
       WHERE a.entity_type='DOCUMENT' AND a.entity_id=?`, doc.id),
    related: q.all(
      `SELECT * FROM related_records WHERE entity_type='DOCUMENT' AND entity_id=?`, doc.id),
    correspondence_links: q.all(
      `SELECT cl.correspondence_id, c.corr_number, c.subject, c.status FROM correspondence_links cl
       JOIN correspondence c ON c.id=cl.correspondence_id WHERE cl.entity_type='DOCUMENT' AND cl.entity_id=?`, doc.id),
    // UEF register extension + lineage
    register: (() => {
      const rt = doc.register_type || 'DCR';
      const map = { TDR: 'register_tdr', MDR: 'register_mdr', VDR: 'register_vdr', SOP: 'register_sop' };
      if (!map[rt]) return null;
      return q.get(`SELECT * FROM ${map[rt]} WHERE document_id=?`, doc.id) || { document_id: doc.id };
    })(),
    supersedes: doc.supersedes_document_id ? q.get(
      `SELECT id, doc_number, title FROM documents WHERE id=?`, doc.supersedes_document_id) : null,
    superseded_by: q.all(
      `SELECT id, doc_number, title FROM documents WHERE supersedes_document_id=? AND deleted_at IS NULL`, doc.id),
    allocation: doc.allocation_id ? q.get(
      `SELECT id, request_number, generated_number, scheme, series_key, decision FROM number_allocations WHERE id=?`, doc.allocation_id) : null,
    corrections: q.all(
      `SELECT cl.*, u.full_name AS user_name FROM correction_log cl LEFT JOIN users u ON u.id=cl.user_id
       WHERE cl.register='DOCUMENTS' AND cl.record_id=? ORDER BY cl.id DESC`, doc.id)
  };
}

// ---------------- Update metadata ----------------
router.put('/:id', requirePerm('document.edit'), ah(async (req, res) => {
  const id = Number(req.params.id);
  const prev = docAggregate(id);
  if (!prev) throw notFound('Document not found');
  if (prev.archive_status === 'archived') throw badRequest('Archived documents are read-only');
  const sets = [], params = [];
  for (const f of DOC_FIELDS) {
    // register_type is immutable after creation (data-integrity rule)
    if (f === 'register_type') continue;
    if (req.body[f] !== undefined) { sets.push(`${f}=?`); params.push(req.body[f]); }
  }
  if (!sets.length) throw badRequest('No metadata fields to update');
  sets.push(`updated_at=datetime('now')`);
  params.push(id);
  q.run(`UPDATE documents SET ${sets.join(',')} WHERE id=?`, ...params);
  const doc = docAggregate(id);
  audit({ user: req.user, action: 'EDIT', entityType: 'DOCUMENT', entityId: id, prev, next: doc });
  ok(res, doc);
}));

// ---------------- Status change (controlled transitions) ----------------
router.post('/:id/status', requirePerm('document.status'), ah(async (req, res) => {
  const id = Number(req.params.id);
  const doc = docAggregate(id);
  if (!doc) throw notFound('Document not found');
  assertCanSeeDocument(req.user, doc);
  const target = q.get(`SELECT * FROM statuses WHERE id=? OR code=?`, req.body.to_status_id || 0, req.body.to_status_code || '');
  if (!target) throw badRequest('Unknown target status');
  // explicit column selection; 'both'-scope statuses default to internal unless told otherwise
  const useExternal = target.scope === 'external' || req.body.status_column === 'external';
  if (useExternal) {
    transition({
      table: 'documents', idColumn: 'id', statusColumn: 'external_status_id',
      entityType: 'DOCUMENT', entityId: id, toStatusId: target.id, user: { ...req.user },
      reason: req.body.reason, comment: req.body.comment
    });
  } else {
    transition({
      table: 'documents', idColumn: 'id', statusColumn: 'internal_status_id',
      entityType: 'DOCUMENT', entityId: id, toStatusId: target.id, user: { ...req.user },
      reason: req.body.reason, comment: req.body.comment
    });
  }
  ok(res, docAggregate(id));
}));

// ---------------- Submit current draft revision into review workflow ----------------
router.post('/:id/submit-review', requirePerm('document.status'), ah(async (req, res) => {
  const id = Number(req.params.id);
  const doc = docAggregate(id);
  if (!doc) throw notFound('Document not found');
  const dt = q.get(`SELECT * FROM document_types WHERE id=?`, doc.doc_type_id);

  const rev = q.get(
    `SELECT * FROM document_revisions WHERE document_id=? ORDER BY id DESC LIMIT 1`, id);
  if (!rev) throw badRequest('No revision available');

  const revStatus = q.get(`SELECT code FROM statuses WHERE id=?`, rev.status_id).code;
  if (!['DFT', 'REG', 'REJ'].includes(revStatus)) {
    throw badRequest(`Revision is not in a submittable state (${revStatus})`);
  }
  if (dt.requires_review && !q.get(`SELECT 1 x FROM users WHERE role_id IN (SELECT id FROM roles WHERE code='REVIEWER') AND is_active=1`)) {
    throw badRequest('No active reviewer configured');
  }

  // DDM routing engine: resolve reviewer/endorser/approver from the distribution matrix
  const disciplineCode = doc.discipline_id ? q.get(`SELECT code FROM disciplines WHERE id=?`, doc.discipline_id)?.code : '*';
  const docTypeCode = q.get(`SELECT code FROM document_types WHERE id=?`, doc.doc_type_id)?.code || '*';
  const routing = resolveRouting({
    discipline: disciplineCode || '*', docType: docTypeCode,
    klass: doc.class_code || '*', originator: doc.originator_code || '*'
  });
  const assignments = { ...(req.body.assignments || {}) };
  let copyTo = [];
  if (routing) {
    if (!assignments.technical_review && routing.reviewer1) assignments.technical_review = routing.reviewer1;
    if (!assignments.technical_review && routing.reviewer2) assignments.technical_review = routing.reviewer2;
    copyTo = routing.copy_to || [];
  }

  const { startWorkflow } = require('../lib/workflow');
  const instanceId = startWorkflow('DOC-TECH-APPROVAL', doc, rev.id, {
    startedBy: req.user.id,
    assignments,
    approvers: (req.body.approvers && req.body.approvers.length)
      ? req.body.approvers
      : resolveApproverIds(routing, doc.approver_user_id), // mandatory approver — never bypassable
    approvalMode: req.body.approval_mode || 'sequential',
    reviewDueDate: req.body.review_due_date || null
  });

  // notify copy recipients from the DDM
  if (copyTo.length) {
    notify('TASK_ASSIGNED', {
      assigneeIds: copyTo, entityType: 'DOCUMENT', entityId: id,
      title: 'DDM copy distribution', body: `${doc.doc_number} entered review — you are a copy recipient per the DDM.`
    });
  }

  audit({
    user: req.user, action: 'SUBMIT_REVIEW', entityType: 'DOCUMENT', entityId: id,
    next: { instanceId, revision: rev.revision_code, assignments: req.body.assignments || {} }
  });
  ok(res, { instance_id: instanceId, revision: rev.revision_code });
}));

// ---------------- Upload new version into an open revision ----------------
router.post('/:id/revisions/:revId/versions', requirePerm('document.edit'), ah(async (req, res) => {
  const docId = Number(req.params.id);
  const revId = Number(req.params.revId);
  const doc = docAggregate(docId);
  if (!doc) throw notFound('Document not found');
  const rev = q.get(`SELECT * FROM document_revisions WHERE id=? AND document_id=?`, revId, docId);
  if (!rev) throw notFound('Revision not found');
  const revStatus = q.get(`SELECT code FROM statuses WHERE id=?`, rev.status_id).code;
  if (['APP', 'SUP', 'ARC'].includes(revStatus)) {
    throw badRequest('Approved/superseded revisions are immutable â€” create a new revision instead');
  }

  let buffer, name, mime;
  if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
    if (!req.file) throw badRequest('file field required');
    buffer = req.file.buffer; name = req.file.originalname; mime = req.file.mimetype;
  } else {
    const { filename, mime_type, data_base64 } = req.body || {};
    if (!data_base64) throw badRequest('data_base64 required (JSON upload) or use multipart form field "file"');
    buffer = Buffer.from(data_base64, 'base64'); name = filename; mime = mime_type;
  }
  if (!buffer || !buffer.length) throw badRequest('Empty file');

  const fileId = storeFile(buffer, name, mime, req.user.id);
  const lastV = q.get(`SELECT MAX(version_no) m FROM document_versions WHERE revision_id=?`, revId).m || 0;
  q.run(
    `INSERT INTO document_versions (revision_id, version_no, file_id, comment, uploaded_by) VALUES (?,?,?,?,?)`,
    revId, lastV + 1, fileId, (req.body && req.body.comment) || null, req.user.id
  );
  audit({ user: req.user, action: 'UPLOAD', entityType: 'DOCUMENT', entityId: docId, next: { version_no: lastV + 1, fileId, name } });
  ok(res, { revision_id: revId, version_no: lastV + 1, file_id: fileId }, {});
}));
// multipart support
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });
router.post('/:id/revisions/:revId/versions/multipart', requirePerm('document.edit'), upload.single('file'), ah(async (req, res) => {
  req.headers['content-type'] = 'multipart/form-data';
  const docId = Number(req.params.id);
  const revId = Number(req.params.revId);
  if (!req.file) throw badRequest('file required');
  const doc = docAggregate(docId);
  if (!doc) throw notFound('Document not found');
  const rev = q.get(`SELECT * FROM document_revisions WHERE id=? AND document_id=?`, revId, docId);
  if (!rev) throw notFound('Revision not found');
  const revStatus = q.get(`SELECT code FROM statuses WHERE id=?`, rev.status_id).code;
  if (['APP', 'SUP', 'ARC'].includes(revStatus)) throw badRequest('Approved revisions are immutable â€” create a new revision');
  const fileId = storeFile(req.file.buffer, req.file.originalname, req.file.mimetype, req.user.id);
  const lastV = q.get(`SELECT MAX(version_no) m FROM document_versions WHERE revision_id=?`, revId).m || 0;
  q.run(`INSERT INTO document_versions (revision_id, version_no, file_id, comment, uploaded_by) VALUES (?,?,?,?,?)`,
    revId, lastV + 1, fileId, req.body.comment || null, req.user.id);
  audit({ user: req.user, action: 'UPLOAD', entityType: 'DOCUMENT', entityId: docId, next: { version_no: lastV + 1, fileId } });
  ok(res, { revision_id: revId, version_no: lastV + 1, file_id: fileId });
}));

// ---------------- New revision of approved document ----------------
router.post('/:id/revisions', requirePerm('document.revise'), ah(async (req, res) => {
  const id = Number(req.params.id);
  const doc = docAggregate(id);
  if (!doc) throw notFound('Document not found');
  const cur = q.get(`SELECT * FROM document_revisions WHERE document_id=? AND is_current=1 ORDER BY id DESC LIMIT 1`, id);
  if (!cur) throw notFound('No current revision');
  const curStatus = q.get(`SELECT code FROM statuses WHERE id=?`, cur.status_id).code;
  if (curStatus !== 'APP') throw badRequest('New revisions can only be raised from the current APPROVED revision');

  // revision scheme determined by the document-number series (never mixed)
  const scheme = doc.numbering_scheme || schemeFromNumber(doc.doc_number) || 'PROJECT';
  let next;
  try {
    next = nextRevisionCode(scheme, cur.revision_code);
  } catch (e) { throw badRequest(e.message); }
  if (q.get(`SELECT id FROM document_revisions WHERE document_id=? AND revision_code=?`, id, next)) {
    throw conflict(`Revision ${next} already exists`);
  }
  const reason = req.body.revision_reason || '';
  const r = q.run(
    `INSERT INTO document_revisions (document_id, revision_code, revision_reason, revision_date, author_user_id,
       reviewer_user_id, endorser_user_id, approver_user_id, status_id, created_by)
     VALUES (?,?,?,?,?,?,?,?,(SELECT id FROM statuses WHERE code='DFT'),?)`,
    id, next, reason, req.body.revision_date || null,
    req.body.author_user_id || req.user.id,
    req.body.reviewer_user_id || doc.reviewer_user_id,
    req.body.endorser_user_id || doc.endorser_user_id,
    req.body.approver_user_id || doc.approver_user_id,
    req.user.id
  );
  const revId = Number(r.lastInsertRowid);

  transition({
    table: 'document_revisions', idColumn: 'id', statusColumn: 'status_id',
    entityType: 'DOCUMENT_REVISION', entityId: revId, toStatusId: statusByCode('DFT').id,
    user: { ...req.user }, reason: 'New revision drafted'
  });
  transition({
    table: 'documents', idColumn: 'id', statusColumn: 'internal_status_id',
    entityType: 'DOCUMENT', entityId: id, toStatusId: statusByCode('DFT').id,
    user: { ...req.user }, reason: `Revision ${next} in preparation`
  });
  audit({ user: req.user, action: 'REVISION_CREATE', entityType: 'DOCUMENT', entityId: id, next: { revision: next, reason, scheme } });
  notify('REVISION_CREATED', {
    assigneeIds: [doc.dcc_user_id].filter(Boolean), entityType: 'DOCUMENT', entityId: id,
    title: 'Revision created', body: `Rev ${next} created for ${doc.doc_number}.`,
    vars: { docNumber: doc.doc_number, revision: next }
  });
  ok(res, q.get(`SELECT * FROM document_revisions WHERE id=?`, revId));
}));

// ---------------- Related records & attachments ----------------
router.post('/:id/related', requirePerm('document.edit'), ah(async (req, res) => {
  const { related_type, related_id, link_note } = req.body;
  if (!related_type || !related_id) throw badRequest('related_type and related_id required');
  try {
    q.run(`INSERT INTO related_records (entity_type, entity_id, related_type, related_id, link_note, created_by)
           VALUES ('DOCUMENT',?,?,?,?,?)`, Number(req.params.id), related_type, related_id, link_note || null, req.user.id);
  } catch (e) { if (String(e.message).includes('UNIQUE')) throw conflict('Link already exists'); throw e; }
  audit({ user: req.user, action: 'LINK', entityType: 'DOCUMENT', entityId: Number(req.params.id), next: { related_type, related_id } });
  res.status(201).json({ data: { linked: true } });
}));

router.post('/:id/attachments', upload.single('file'), requirePerm('document.edit'), ah(async (req, res) => {
  if (!req.file) throw badRequest('file required');
  const fileId = storeFile(req.file.buffer, req.file.originalname, req.file.mimetype, req.user.id);
  q.run(`INSERT INTO attachments (entity_type, entity_id, file_id, uploaded_by) VALUES ('DOCUMENT',?,?,?)`,
    Number(req.params.id), fileId, req.user.id);
  audit({ user: req.user, action: 'UPLOAD', entityType: 'DOCUMENT_ATTACHMENT', entityId: Number(req.params.id), next: { fileId } });
  res.status(201).json({ data: { file_id: fileId, original_name: req.file.originalname } });
}));

module.exports = router;
