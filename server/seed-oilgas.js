'use strict';
/* Seed: Mansuriya Gas Expansion Phase 2 — a large oil & gas project in the
 * FEED (early) stage. Realistic deliverables per industry FEED practice:
 * PFDs, H&MB, plot plans, line lists, HAZID/HAZOP, SIL, F&G/ESD philosophies,
 * load lists, instrument index, cost estimate, risk register, VDR vendor docs.
 * Idempotent: skips if project 4210 already exists. */
const { q } = require('./db');
const { allocateNumber } = require('./lib/uefNumbering');
const { storeFile } = require('./lib/storage');
const { startWorkflow, completeWfStep } = require('./lib/workflow');
const { notify } = require('./lib/notify');

if (q.get(`SELECT id FROM projects WHERE code='4210'`)) {
  console.log('[seed-oilgas] Project 4210 already present — skipping.');
  process.exit(0);
}

console.log('[seed-oilgas] Seeding Mansuriya Gas Expansion Phase 2 (FEED) ...');

// ---------------- handles ----------------
const S = c => q.get(`SELECT id FROM statuses WHERE code=?`, c).id;
const org = code => q.get(`SELECT * FROM organizations WHERE code=?`, code);
const dep = code => q.get(`SELECT id FROM departments WHERE code=?`, code);
const disc = code => q.get(`SELECT id FROM disciplines WHERE code=?`, code);
const dtype = code => q.get(`SELECT id FROM document_types WHERE code=?`, code);
const pur = code => q.get(`SELECT id FROM purposes WHERE code=?`, code);
const U = n => q.get(`SELECT id FROM users WHERE username=?`, n);

const dcc = U('dcc'), reviewer = U('reviewer'), endorser = U('achuplin'),
      approver = U('approver'), pm = U('pm'), admin = U('admin'), contractor = U('contractor1');

// ensure operational doc types exist (registry codes -> FK table)
for (const [c, n] of [['BOD', 'Basis of Design Document'], ['SCH', 'Schedule'],
  ['QCP', 'Quality Control Procedure'], ['PROC', 'Procedure']]) {
  q.run(`INSERT OR IGNORE INTO document_types (code,name,requires_review,requires_endorsement,requires_approval,numbering_rule_id)
         VALUES (?,?,1,1,1,(SELECT id FROM numbering_rules WHERE code='DOC-DEFAULT'))`, c, n);
}

// ensure FEED disciplines exist in the FK table
for (const [c, n] of [['PIP', 'Piping'], ['ELE', 'Electrical'], ['HSE', 'Health, Safety & Environment'],
  ['DCA', 'Document Control & Archive'], ['QA', 'Quality Assurance'], ['ADM', 'Administration'],
  ['MEC', 'Mechanical']]) {
  q.run('INSERT OR IGNORE INTO disciplines (code,name) VALUES (?,?)', c, n);
}

// ---------------- organizations ----------------
const orgIns = (code, name, type, contact) => {
  q.run(`INSERT OR IGNORE INTO organizations (code,name,org_type,contact_name,contact_email) VALUES (?,?,?,?,?)`,
    code, name, type, contact || null, contact ? `${String(contact).toLowerCase().replace(/\s+/g, '.')}@example.com` : null);
  return org(code);
};
orgIns('DELTA', 'Delta Engineering International (FEED Consultant)', 'Consultant', 'FEED Project Manager');
orgIns('OEM-COMP', 'Meridian Turbomachinery Works', 'Vendor', 'Sales Engineer');
orgIns('OEM-VALVE', 'Valveworks Gulf FZE', 'Vendor', 'Applications Engineer');
orgIns('OEM-INSTR', 'Nordic Instrument Systems', 'Vendor', 'Proposal Manager');

const luk = org('LUK'), epc1 = org('EPC1'), delta = org('DELTA');

// ---------------- project & contracts ----------------
q.run(`INSERT OR IGNORE INTO projects (code,name,customer_org_id,lifecycle_stage,status) VALUES ('4210','Mansuriya Gas Field Expansion Phase 2 (MGP-2)',?,'FEED','Active')`, luk.id);
const proj = q.get(`SELECT * FROM projects WHERE code='4210'`);
if (!q.get(`SELECT id FROM contracts WHERE number='RL-26-0410-777'`)) {
  q.run(`INSERT INTO contracts (number,title,project_id,customer_org_id,contractor_org_id,status)
         VALUES ('RL-26-0410-777','FEED Engineering Services - MGP-2 Central Processing Facility',?,?,?,'Active')`,
    proj.id, luk.id, delta.id);
}
if (!q.get(`SELECT id FROM contracts WHERE number='RL-26-0410-780'`)) {
  q.run(`INSERT INTO contracts (number,title,project_id,customer_org_id,contractor_org_id,status)
         VALUES ('RL-26-0410-780','EPC Invitation-to-Tender Support - MGP-2',?,?,?,'Active')`,
    proj.id, luk.id, epc1.id);
}
const feedContract = q.get(`SELECT id FROM contracts WHERE number='RL-26-0410-777'`).id;

// ---------------- helpers ----------------
function sampleFile(name, lines) {
  return storeFile(Buffer.from(lines.join('\n'), 'utf8'),
    name.replace(/[^\w.-]+/g, '_'), 'text/plain', dcc.id);
}
const nextEntry = () => q.get(`SELECT COALESCE(MAX(entry_number),0)+1 AS n FROM documents`).n;

function addDoc(o) {
  // 1) allocation request row
  const rn = 'NAL-2026-' + String((q.get(`SELECT COUNT(*) c FROM number_allocations WHERE request_number LIKE 'NAL-2026-%'`).c) + 1).padStart(4, '0');
  const scheme = o.corporate ? 'CORPORATE' : 'PROJECT';
  allocationId = Number(q.run(
    `INSERT INTO number_allocations (request_number,proposed_title,scheme,department,section,prid,so_po,ss,discipline,doc_type,created_by)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    rn, o.title, scheme,
    o.corporate ? o.dept : null, o.corporate ? o.section : null,
    o.corporate ? null : '4210', o.corporate ? null : (o.so || '01'), o.corporate ? null : (o.so || '01'),
    o.corporate ? null : o.disc, o.dt, dcc.id).lastInsertRowid);

  // 2) allocate + lock
  const { number, sequence, seriesKey } = allocateNumber(
    o.corporate
      ? { scheme: 'CORPORATE', department: o.dept, section: o.section, docType: o.dt }
      : { scheme: 'PROJECT', prid: '4210', ss: o.so || '01', discipline: o.disc, docType: o.dt },
    dcc.id);
  q.run(`UPDATE number_allocations SET series_key=?, sequence=?, decision='issued', allocation_date=date('now'),
          allocated_by=?, status='Issued (seed)' WHERE id=?`, seriesKey, sequence, dcc.id, allocationId);

  // 3) file
  const fileId = storeFile(Buffer.from([
    o.title, 'Document No: ' + number, 'Project: Mansuriya Gas Field Expansion Phase 2 (FEED)',
    'Status: ' + o.status, '',
    'Demonstration deliverable generated for the IDMS FEED dataset.'].concat(o.lines || []).join('\n'), 'utf8'),
    (number + '_' + o.title).replace(/[^\w.-]+/g, '_').slice(0, 80) + '.txt', 'text/plain', dcc.id);

  // 4) document row
  const bindParams = [
    number, o.title, o.direction || 'incoming', dtype(o.dt).id,
    q.get(`SELECT id FROM categories WHERE code='ENG'`).id,
    proj.id, o.contractId || feedContract, disc(o.disc).id, dep(o.dep || 'EPC').id,
    o.originatorOrg || delta.id, luk.id, epc1.id,
    o.area || 'CPF-1', o.system || null, 'FEED',
    pur(o.purpose || 'APR').id, S('REG'), o.extStatus ? S(o.extStatus) : null,
    scheme, allocationId, nextEntry(),
    o.register || 'TDR', '4210', o.so || '01', o.klass || '2',
    o.sheets || 10, null, null,
    o.depCode || 'EN', o.sectionCode || null, o.originatorCode || 'CONTRACTOR',
    o.owner || pm.id,
    endorser.id, dcc.id, reviewer.id, approver.id,
    o.docDate || '2026-07-15',
    o.status !== 'DFT' ? (o.docDate || '2026-07-15') : null,
    ['APP', 'URV', 'PEND', 'PAP'].includes(o.status) ? (o.docDate || '2026-07-15') : null,
    o.reviewDue || null, o.keywords || null,
    q.get(`SELECT id FROM retention_rules WHERE code='PERM'`).id,
    dcc.id];
  const bad = bindParams.findIndex(p => p === undefined);
  if (bad >= 0) { console.error(`[seed-oilgas] UNDEFINED param ${bad + 1} for "${o.title}"`); throw new Error('bind failure'); }

  const ins = q.run(
    `INSERT INTO documents (doc_number,title,direction,doc_type_id,category_id,project_id,contract_id,
      discipline_id,department_id,originator_org_id,customer_org_id,contractor_org_id,area,system,phase,
      purpose_id,internal_status_id,external_status_id,numbering_scheme,allocation_id,entry_number,
      register_type,prid,so_po,class_code,pages_sheets,supersedes_document_id,archive_location,
      department_code,section_code,originator_code,owner_user_id,
      endorser_user_id,dcc_user_id,reviewer_user_id,approver_user_id,
      document_date,receipt_date,accept_date,review_due_date,keywords,retention_rule_id,
      created_by,registered_at,created_at)
     VALUES (${Array(43).fill('?').join(',')},datetime('now'),datetime('now'))`,
    ...bindParams);
  const docId = Number(ins.lastInsertRowid);

  // 5) revision + version
  const revCode = scheme === 'CORPORATE' ? '00' : 'A';
  const rev = q.run(
    `INSERT INTO document_revisions (document_id,revision_code,revision_reason,revision_date,file_id,
      author_user_id,reviewer_user_id,endorser_user_id,approver_user_id,status_id,is_current,approval_date,created_by)
     VALUES (?,?,?,?,?,?,?,?,?,?,1,?,?)`,
    docId, revCode, o.reason || 'FEED issue', o.docDate || '2026-07-15', fileId,
    contractor.id, reviewer.id, endorser.id, approver.id, S(o.status),
    o.status === 'APP' ? (o.approvedOn || '2026-08-05') : null, dcc.id);
  const revId = Number(rev.lastInsertRowid);
  q.run(`INSERT INTO document_versions (revision_id,version_no,file_id,comment,uploaded_by) VALUES (?,1,?,?,?)`,
    revId, fileId, 'FEED issue', contractor.id);
  q.run(`UPDATE documents SET current_revision_id=? WHERE id=?`, revId, docId);

  // 6) register extensions
  if (o.register === 'MDR') {
    q.run(`INSERT OR REPLACE INTO register_mdr (document_id,deliverable_category,planned_revision,approval_code,date_submitted,date_approved,transmittal_ref)
           VALUES (?,?,?,?,?,?,?)`,
      docId, o.category || 'Project Management', 'B', o.status === 'APP' ? 'AC-' + (100 + docId) : null,
      o.docDate || '2026-07-15', o.status === 'APP' ? (o.approvedOn || '2026-08-05') : null, o.trn || null);
  } else if (o.register === 'VDR') {
    q.run(`INSERT OR REPLACE INTO register_vdr (document_id,vendor_doc_number,vendor_org_id,po_number,mr_number,system_area,mrb_included,approval_code,date_submitted,transmittal_ref)
           VALUES (?,?,?,?,?,?,?,?,?,?)`,
      docId, o.vendorDocNo, o.vendorOrg, o.po || 'PO-4500-8812', o.mr || 'MR-0311', o.system || 'CPF-1',
      0, null, o.docDate || '2026-07-15', o.trn || null);
} else if (o.register === 'SOP') {
    const interval = o.interval || 24;
    q.run(`INSERT OR REPLACE INTO register_sop (document_id,section_code,owner_user_id,issue_date,approving_order,review_interval_months,next_review_due,linked_forms)
           VALUES (?,?,?,?,?,?,date(?, '+${interval} month'),?)`,
      docId, o.sectionCode || 'DC', o.owner || admin.id, o.issueDate || '2026-06-01',
      o.order || 'Corporate Order 2026-07', interval, o.issueDate || '2026-06-01', null);
  }
  return { docId, number, revId };
}
let allocationId = null;

// ---------------- deliverables ----------------
const D = [];
const T = (title, disc, dt, status, extra = {}) => D.push(Object.assign({ title, disc, dt, status }, extra));

T('Project Design Basis & Basis of Design (BOD)', 'PROC', 'BOD', 'APP', { approvedOn: '2026-08-01', keywords: 'design basis,FEED', sheets: 120 });
T('Block Flow Diagrams (BFD) - Overall Facility', 'PROC', 'DWG', 'APP', { approvedOn: '2026-08-01', sheets: 8 });
T('Process Flow Diagrams (PFDs) - Train 1 & 2', 'PROC', 'DWG', 'URV', { reviewDue: '2026-09-02', sheets: 24, lines: ['Rev A issued for design (IFD).'] });
T('Heat & Material Balance - Whole Plant', 'PROC', 'CAL', 'APP', { approvedOn: '2026-08-03', sheets: 64 });
T('Utility Flow Diagrams (UFDs)', 'PROC', 'DWG', 'REG', { sheets: 18 });
T('Flare & Relief Loads Study', 'PROC', 'RPT', 'URV', { reviewDue: '2026-09-05', lines: ['Worst-case relief scenarios for CPF-1.'] });
T('PSV Sizing Report', 'PROC', 'CAL', 'PEND', { sheets: 40 });
T('Process Simulation Model Report (HYSYS)', 'PROC', 'RPT', 'DFT');
T('Chemical Consumption Summary', 'PROC', 'RPT', 'DFT');
T('Overall Plot Plan & Equipment Layout', 'PIP', 'DWG', 'APP', { approvedOn: '2026-08-02', sheets: 6 });
T('Piping Material Specifications (PMS) - Sour Service', 'PIP', 'SPEC', 'APP', { approvedOn: '2026-08-04' });
T('Piping Line List - CPF-1', 'PIP', 'RPT', 'URV', { reviewDue: '2026-09-04', sheets: 90 });
T('Tie-In List & Tie-In Location Plans', 'PIP', 'RPT', 'REG');
T('Piping Routing & Stress Design Philosophy', 'PIP', 'SPEC', 'APP', { approvedOn: '2026-08-04' });
T('Mechanical Equipment List (MEL)', 'MEC', 'RPT', 'APP', { approvedOn: '2026-08-05' });
T('Sales Gas Compressor - Process Datasheets', 'MEC', 'SPEC', 'PAP', { sheets: 22 });
T('Three-Phase Separator Sizing Calculations', 'MEC', 'CAL', 'APP', { approvedOn: '2026-08-06' });
T('Pressure Vessel Datasheets (Trains 1-2)', 'MEC', 'SPEC', 'URV', { reviewDue: '2026-09-06' });
T('Centrifugal Pump Datasheets - Utilities', 'MEC', 'SPEC', 'REG');
T('Electrical Load List & Power Balance', 'ELE', 'RPT', 'URV', { reviewDue: '2026-09-08' });
T('Single Line Diagrams (SLDs) - 33kV/11kV/0.4kV', 'ELE', 'DWG', 'PEND', { sheets: 14 });
T('Hazardous Area Classification Drawings', 'ELE', 'DWG', 'URV', { reviewDue: '2026-09-09' });
T('Power Generation & Distribution Philosophy', 'ELE', 'SPEC', 'APP', { approvedOn: '2026-08-07' });
T('Cable Routing & Grounding Philosophy', 'ELE', 'SPEC', 'REG');
T('Instrument Index - CPF-1', 'INSTR', 'RPT', 'URV', { reviewDue: '2026-09-10', sheets: 70 });
T('DCS I/O List', 'INSTR', 'RPT', 'REG');
T('Cause & Effect Matrix (ESD/F&G)', 'INSTR', 'RPT', 'PAP', { sheets: 55 });
T('Safety Instrumented System (SIS) Philosophy', 'INSTR', 'SPEC', 'URV', { reviewDue: '2026-09-11' });
T('Control & Operating Philosophy (DCS/SCADA)', 'INSTR', 'SPEC', 'APP', { approvedOn: '2026-08-08' });
T('HAZID Study Report - Concept Screening', 'HSE', 'RPT', 'APP', { approvedOn: '2026-07-28' });
T('HAZOP Study Report - CPF-1 (IFD P&IDs)', 'HSE', 'RPT', 'URV', { reviewDue: '2026-09-03', lines: ['HAZOP workshops completed 12-16 Aug 2026; actions tracked in resolution register.'] });
T('SIL Assessment & LOPA Report', 'HSE', 'RPT', 'DFT');
T('Fire & Gas Detection Philosophy', 'HSE', 'SPEC', 'PEND');
T('Emergency Shutdown (ESD) Philosophy', 'HSE', 'SPEC', 'APP', { approvedOn: '2026-08-08' });
T('Quantitative Risk Assessment (QRA) - Basis', 'HSE', 'RPT', 'DFT');
T('FEED Execution Plan', 'DCA', 'PLAN', 'APP', { register: 'MDR', category: 'Project Execution', approvedOn: '2026-07-20' });
T('Project Schedule (Level 2) - FEED to FID', 'DCA', 'SCH', 'APP', { register: 'MDR', category: 'Planning', approvedOn: '2026-07-20' });
T('Class 3 Capital Cost Estimate (+/-15%)', 'DCA', 'CAL', 'URV', { register: 'MDR', category: 'Cost Control', reviewDue: '2026-09-12' });
T('Project Risk Register', 'DCA', 'RPT', 'APP', { register: 'MDR', category: 'Risk Management', approvedOn: '2026-07-22' });
T('Long-Lead Items (LLI) Register', 'DCA', 'RPT', 'REG', { register: 'MDR', category: 'Procurement' });
T('Procurement Plan for Long-Lead Equipment', 'DCA', 'PLAN', 'DFT', { register: 'MDR', category: 'Procurement' });
T('Quality Assurance / Quality Control Plan', 'QA', 'QCP', 'URV', { register: 'MDR', category: 'QA/QC', reviewDue: '2026-09-14' });
T('HSE Management Plan - FEED Phase', 'HSE', 'PLAN', 'PAP', { register: 'MDR', category: 'HSE' });
T('Project Organization Chart', 'ADM', 'DWG', 'APP', { register: 'MDR', category: 'Project Execution', approvedOn: '2026-07-18' });
T('Sales Gas Compressor - Vendor Technical Offer', 'MEC', 'SPEC', 'REG', { register: 'VDR', vendorDocNo: 'MTW-TDO-4210-001', vendorOrg: org('OEM-COMP').id, po: 'PO-4500-8812', mr: 'MR-0311' });
T('Turbine Flow Meters - Vendor Datasheets', 'INSTR', 'SPEC', 'REG', { register: 'VDR', vendorDocNo: 'NIS-TDS-8842', vendorOrg: org('OEM-INSTR').id, po: 'PO-4500-8815', mr: 'MR-0314' });
T('Large-Bore Trunnion Ball Valves - GA Drawings', 'MEC', 'DWG', 'REG', { register: 'VDR', vendorDocNo: 'VWG-GA-2026-114', vendorOrg: org('OEM-VALVE').id, po: 'PO-4500-8820', mr: 'MR-0319' });
T('Document Numbering & Allocation Procedure', 'DCA', 'SOP', 'APP', { register: 'SOP', corporate: true, dept: 'PO', section: 'DC', dt: 'SOP', interval: 24 });
  T('Management of Change (MOC) Procedure', 'DCA', 'PROC', 'APP', { register: 'SOP', corporate: true, dept: 'PO', section: 'GN', dt: 'PROC', interval: 24 });
  T('HAZOP Facilitation & Close-out Guideline', 'HSE', 'PROC', 'APP', { register: 'SOP', corporate: true, dept: 'HS', section: 'GN', dt: 'PROC', interval: 12 });

const created = {};
for (const o of D) created[o.title] = addDoc(o);

// ---------------- live workflow tasks ----------------
for (const L of [created['Process Flow Diagrams (PFDs) - Train 1 & 2'],
                 created['HAZOP Study Report - CPF-1 (IFD P&IDs)']]) {
  const doc = q.get(`SELECT * FROM documents WHERE id=?`, L.docId);
  startWorkflow('DOC-TECH-APPROVAL', doc, L.revId, {
    startedBy: dcc.id, assignments: { technical_review: reviewer.id },
    approvalMode: 'sequential', reviewDueDate: '2026-09-05'
  });
}
{
  const L = created['Sales Gas Compressor - Process Datasheets'];
  const doc = q.get(`SELECT * FROM documents WHERE id=?`, L.docId);
  startWorkflow('DOC-TECH-APPROVAL', doc, L.revId, {
    startedBy: dcc.id, assignments: { technical_review: reviewer.id }, approvalMode: 'sequential'
  });
  const review = q.get(`SELECT * FROM reviews WHERE document_id=? ORDER BY id DESC LIMIT 1`, L.docId);
  q.run(`UPDATE reviews SET status='approved', completed_at=datetime('now') WHERE id=?`, review.id);
  completeWfStep(review.wf_step_id, 'completed', 'Datasheets verified against process basis.', reviewer.id);
  const endr = q.get(`SELECT * FROM endorsements WHERE document_id=? ORDER BY id DESC LIMIT 1`, L.docId);
  q.run(`UPDATE endorsements SET status='endorsed', acted_at=datetime('now') WHERE id=?`, endr.id);
  completeWfStep(endr.wf_step_id, 'completed', 'Endorsed for approval.', endorser.id);
}

// ---------------- transmittals ----------------
const trnOut = (number, subject, docs, status, ack) => {
  const t = q.run(
    `INSERT INTO transmittals (trn_number,direction,subject,sender_user_id,sender_org_id,recipient_org_id,
       recipient_contact,purpose_id,trn_date,response_required,response_due_date,status,acknowledged_at,created_by)
     VALUES (?,'outgoing',?,?,?,?,?,?,date('now'),1,date('now','+10 day'),?,?,?)`,
    number, subject, dcc.id, epc1.id, luk.id, 'doccontrol@uef-petroleum.example.com',
    pur('APR').id, status, ack ? '2026-08-10 09:30:00' : null, dcc.id);
  const tid = Number(t.lastInsertRowid);
  for (const L of docs) {
    q.run(`INSERT INTO transmittal_items (transmittal_id,document_id,revision_id,item_action) VALUES (?,?,?,'issue')`,
      tid, L.docId, L.revId);
    q.run(`UPDATE documents SET transmittal_ref=? WHERE id=?`, number, L.docId);
  }
  const ackTime = ack ? '2026-08-10 09:30:00' : null;
  const ackUser = ack ? reviewer.id : null;
  const distStatus = status === 'issued' ? 'sent' : 'acknowledged';
  q.run(`INSERT INTO distributions (transmittal_id,recipient_user_id,recipient_org_id,copy_type,status,sent_at,acknowledged_at,acknowledged_by)
         VALUES (?,NULL,?,?,?,datetime('now'),?,?)`,
    tid, luk.id, 'Electronic', distStatus, ackTime, ackUser);
  notify('TRANSMITTAL_ISSUED', { assigneeIds: [contractor.id, dcc.id], entityType: 'TRANSMITTAL', entityId: tid,
    title: 'Transmittal issued', body: number + ' - ' + subject, vars: { trnNumber: number } });
};
trnOut('TRN-2026-9001', 'FEED Process Deliverables - Batch 1 (IFD)',
  [created['Project Design Basis & Basis of Design (BOD)'],
   created['Block Flow Diagrams (BFD) - Overall Facility'],
   created['Heat & Material Balance - Whole Plant'],
   created['Overall Plot Plan & Equipment Layout']], 'acknowledged', true);
trnOut('TRN-2026-9002', 'HAZOP Package - IFD P&IDs + Agendas',
  [created['HAZOP Study Report - CPF-1 (IFD P&IDs)'], created['Cause & Effect Matrix (ESD/F&G)']], 'issued', false);
trnOut('TRN-2026-9003', 'Safety Philosophies - F&G / ESD',
  [created['Emergency Shutdown (ESD) Philosophy'], created['Power Generation & Distribution Philosophy']], 'issued', false);
{
  const t = q.run(
    `INSERT INTO transmittals (trn_number,direction,subject,sender_user_id,sender_org_id,recipient_org_id,
       recipient_contact,purpose_id,trn_date,response_required,response_due_date,status,created_by)
     VALUES ('TRN-2026-9100','incoming','Weekly Progress Transmittal - FEED Wk33',?,?,?,NULL,?,date('now'),0,NULL,'issued',?)`,
    reviewer.id, delta.id, epc1.id, pur('INF').id, dcc.id);
  const tid = Number(t.lastInsertRowid);
  for (const L of [created['Tie-In List & Tie-In Location Plans'], created['DCS I/O List']]) {
    q.run(`INSERT INTO transmittal_items (transmittal_id,document_id,revision_id,item_action) VALUES (?,?,?,'info')`, tid, L.docId, L.revId);
  }
  q.run(`INSERT INTO distributions (transmittal_id, recipient_user_id, recipient_org_id, copy_type, status, sent_at, acknowledged_at, acknowledged_by)
         VALUES (?,NULL,?,?,?,datetime('now'),NULL,NULL)`,
    tid, luk.id, 'Electronic', 'sent');
}

// ---------------- correspondence ----------------
const corrIns = (n, subject, ref, date, opts = {}) => {
  const corrNum = 'IN-2026-' + String(900 + n).padStart(4, '0');
  const due = opts.due || '2026-09-10';
  const body = opts.body || 'Please review and respond within the contractual period.';
  q.run(
    `INSERT INTO correspondence
       (corr_number,direction,subject,corr_type,sender_org_id,sender_name,recipient_org_id,
        corr_date,received_date,response_required,response_due_date,assigned_user_id,body,created_by,
        entry_number,counterparty_code,counterparty_ref,letter_date,language_code,responsible_dept_code,
        focal_point_user_id,reply_days_allowed,reply_due_date,reply_reference,
        contractual_notice,clause,archive_box,urgency,days_overdue)
     VALUES
       (?,'incoming',?,'Letter',?,?,?,  ?,?,1,?,?,?,  ?,?,?,?,  ?,?,?,?,  ?,?,?,?,  ?,?,?,?)`,
    corrNum, subject, delta.id, 'Delta Engineering International', luk.id,
    date, date, due, dcc.id, body, dcc.id,
    n, ref, ref, date, 'EN', dcc.id, dcc.id,
    7, due, ref, opts.notice ? 1 : 0, opts.box || null, opts.box || null,
    opts.urgent ? 'urgent' : 'normal', opts.overdue ? 20 : 0);
};
corrIns(1, 'FEED Kick-off Notice - MGP-2 Central Processing Facility', 'DEL/PM/2026/0412', '2026-07-02', { overdue: true, notice: true, box: 'BOX-FEED-01', due: '2026-07-09', body: 'Formal notice of FEED commencement with integrated project schedule.' });
corrIns(2, 'Environmental Baseline Data Request - Air Quality & Noise', 'DEL/ENV/2026/0088', '2026-07-20', { urgent: true, overdue: true, notice: true, due: '2026-07-27', body: 'Urgent: baseline datasets required to close HAZID actions.' });
corrIns(3, 'HAZOP Workshop Logistics & Attendance Confirmation', 'DEL/SAF/2026/0231', '2026-08-08');
corrIns(4, 'Plot Plan Comments Consolidation - Round 2', 'DEL/PIP/2026/0512', '2026-08-18');
q.run(`INSERT INTO correspondence (corr_number,direction,subject,corr_type,sender_org_id,recipient_org_id,corr_date,response_required,assigned_user_id,status,body,created_by,entry_number,counterparty_code,language_code,reply_days_allowed,reply_due_date,urgency)
       VALUES ('OUT-2026-0450','outgoing','Consolidated Review Comments - PFDs Rev A','Email',?,?,?,?,?,'closed','Please incorporate Track-1 comments and resubmit as Rev B.',?,501,'CONTRACTOR','EN',10,'2026-09-01','normal')`,
  luk.id, delta.id, '2026-08-20', 0, dcc.id, dcc.id);

// ---------------- resolutions (FEED gate actions) ----------------
const resIns = (days, subject, decision, responsible, due, status, action) => {
  const num = 'RES-2026-' + String(400 + (q.get(`SELECT COUNT(*) c FROM resolutions`).c) + 1).padStart(3, '0');
  q.run(`INSERT INTO resolutions (resolution_number,resolution_date,meeting_ref,subject,decision,responsible_user_id,
          department_id,action_required,due_date,priority,status,created_by)
         VALUES (?,date('now','-${days} day'),'FEED Gate-1 Review - MGP-2',?,?,?,?,?,?,?,?,?)`,
    num, subject, decision, responsible, dep('EPC').id, action, due, 'High', status, pm.id);
};
resIns(30, 'Close HAZID actions prior to HAZOP start', 'All HAZID Category-1 actions to be closed and evidence-packaged.', reviewer.id, '2026-08-01', 'escalated', 'Provide closure matrix with drawing references.');
resIns(15, 'Freeze PFDs for IFD issue', 'PFDs Rev B to be issued for design after H&MB convergence sign-off.', reviewer.id, '2026-09-02', 'in_progress', 'Obtain process lead sign-off and reissue via transmittal.');
resIns(10, 'Long-lead compressor ITT package release', 'Release ITT for sales gas compressors with purchase-ready datasheets.', approver.id, '2026-09-20', 'open', 'Attach final datasheets and evaluation criteria.');
resIns(5, 'Class 3 estimate basis alignment with PMT', 'Align estimating basis (quantities, unit rates, escalation) with PMT controls.', pm.id, '2026-09-25', 'open', 'Circulate estimate basis memorandum.');

notify('REVIEW_ASSIGNED', { assigneeIds: [reviewer.id], entityType: 'DOCUMENT',
  entityId: created['Process Flow Diagrams (PFDs) - Train 1 & 2'].docId,
  title: 'Review assigned', body: 'PFDs Rev A awaiting your technical review.', vars: { docNumber: 'PFDs Rev A' } });

console.log('[seed-oilgas] Done:',
  q.get(`SELECT COUNT(*) c FROM documents WHERE project_id=?`, proj.id).c, 'documents,',
  q.get(`SELECT COUNT(*) c FROM number_allocations a JOIN uef_series s ON s.series_key=a.series_key WHERE s.series_key LIKE 'P|4210|%'`).c, 'allocations,',
  q.get(`SELECT COUNT(*) c FROM transmittals WHERE trn_number LIKE 'TRN-2026-9%'`).c, 'transmittals.');
