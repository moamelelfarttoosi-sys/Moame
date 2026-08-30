'use strict';
/* Seed realistic demonstration data. Idempotent: skips if already seeded. */
const crypto = require('crypto');
const { q, migrate } = require('./db');
const { hashPassword } = require('./lib/passwords');
const { notify, seedRules } = require('./lib/notify');
const { nextNumber } = require('./lib/numbering');
const { startWorkflow, completeWfStep } = require('./lib/workflow');
const { finalizeApprovedRevision } = require('./lib/revisionControl');

migrate();

if (q.get(`SELECT COUNT(*) c FROM users`).c > 0) {
  console.log('[seed] Database already seeded — skipping.');
  process.exit(0);
}

console.log('[seed] Seeding IDMS demonstration database ...');

// ---------------- Roles ----------------
const ROLES = [
  ['ADMIN', 'Administrator', 'Full system configuration'],
  ['DCC', 'Document Controller', 'Registration, metadata verification, tracking, transmittals, register maintenance'],
  ['REVIEWER', 'Reviewer', 'Technical review and comments'],
  ['ENDORSER', 'Endorser', 'Technical endorsement'],
  ['APPROVER', 'Approver', 'Formal approval authority'],
  ['PM', 'Project Manager', 'Project-level visibility and management'],
  ['DEPT_MANAGER', 'Department Manager', 'Department oversight and escalation'],
  ['CONTRACTOR', 'Contractor / External User', 'Controlled submission and document receipt'],
  ['READONLY', 'Read-only User', 'Search and view according to permissions']
];
for (const [code, name, desc] of ROLES) {
  q.run(`INSERT OR IGNORE INTO roles (code, name, description) VALUES (?,?,?)`, code, name, desc);
}

// ---------------- Permissions ----------------
const PERMISSIONS = [
  // domain, code, description
  ['Documents', 'document.create', 'Register documents'],
  ['Documents', 'document.edit', 'Edit document metadata / upload versions'],
  ['Documents', 'document.status', 'Perform controlled status changes / submit workflows'],
  ['Documents', 'document.revise', 'Create new revisions'],
  ['Reviews', 'review.perform', 'Perform technical reviews'],
  ['Endorsements', 'endorsement.perform', 'Perform technical endorsements'],
  ['Approvals', 'approval.perform', 'Act as formal approver'],
  ['Transmittals', 'transmittal.create', 'Create transmittals'],
  ['Transmittals', 'transmittal.issue', 'Issue/close transmittals'],
  ['Correspondence', 'correspondence.create', 'Register correspondence'],
  ['Memos', 'memo.create', 'Create office memos'],
  ['Resolutions', 'resolution.create', 'Create resolutions and actions'],
  ['Reports', 'report.view', 'View reports and registers'],
  ['Reports', 'report.export', 'Export reports/search results'],
  ['Audit', 'audit.view', 'View audit trail'],
  ['Administration', 'admin.manage', 'Full administration'],
  ['Archive', 'archive.manage', 'Archive controlled records'],
  ['Numbering', 'number.allocate', 'Allocate controlled document numbers'],
  ['Codes', 'codes.manage', 'Manage controlled code registry'],
  ['Workflow', 'ddm.manage', 'Manage DDM routing rules'],
  ['Governance', 'correction.record', 'Record controlled corrections']
];
for (const [domain, code, description] of PERMISSIONS) {
  q.run(`INSERT OR IGNORE INTO permissions (domain, code, description) VALUES (?,?,?)`, domain, code, description);
}
const roleId = {};
for (const r of q.all(`SELECT id, code FROM roles`)) roleId[r.code] = r.id;
const permId = {};
for (const p of q.all(`SELECT id, code FROM permissions`)) permId[p.code] = p.id;

const ROLE_PERMS = {
  ADMIN: PERMISSIONS.map(p => p[1]),
  DCC: ['document.create', 'document.edit', 'document.status', 'document.revise',
    'transmittal.create', 'transmittal.issue', 'correspondence.create', 'memo.create', 'resolution.create',
    'report.view', 'report.export', 'audit.view', 'number.allocate', 'correction.record', 'archive.manage'],
  REVIEWER: ['review.perform', 'report.view'],
  ENDORSER: ['endorsement.perform', 'report.view'],
  APPROVER: ['approval.perform', 'report.view'],
  PM: ['resolution.create', 'report.view', 'report.export'],
  DEPT_MANAGER: ['resolution.create', 'report.view'],
  CONTRACTOR: ['document.create'],
  READONLY: ['report.view']
};
for (const [rc, codes] of Object.entries(ROLE_PERMS)) {
  for (const c of codes) {
    q.run(`INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?,?)`, roleId[rc], permId[c]);
  }
}

// ---------------- Statuses ----------------
const STATUSES = [
  // code, name, scope, phase, color, initial, terminal
  ['DFT', 'Draft', 'both', 'Preparation', '#94a3b8', 0, 0],
  ['REG', 'Registered', 'both', 'Registration', '#2563eb', 1, 0],
  ['2PK', '2-Package Check', 'internal', 'Review', '#0891b2', 0, 0],
  ['URV', 'Under Review', 'internal', 'Review', '#f59e0b', 0, 0],
  ['PEND', 'Pending Endorsement', 'internal', 'Endorsement', '#8b5cf6', 0, 0],
  ['END', 'Endorsed', 'internal', 'Endorsement', '#6366f1', 0, 0],
  ['PAP', 'Pending Approval', 'internal', 'Approval', '#d97706', 0, 0],
  ['APP', 'Approved', 'both', 'Approval', '#16a34a', 0, 0],
  ['REJ', 'Rejected', 'both', 'Review', '#dc2626', 0, 0],
  ['RTC', 'Referred to Contractor', 'both', 'Issuance', '#ca8a04', 0, 0],
  ['IFR', 'Issued for Review', 'both', 'Issuance', '#0ea5e9', 0, 0],
  ['IFA', 'Issued for Approval', 'both', 'Issuance', '#0284c7', 0, 0],
  ['IFC', 'Issued for Construction', 'both', 'Issuance', '#0369a1', 0, 0],
  ['AB', 'As-Built', 'both', 'Closure', '#059669', 0, 0],
  ['SUP', 'Superseded', 'both', 'Supersession', '#7c3aed', 0, 0],
  ['CLS', 'Closed', 'both', 'Closure', '#475569', 0, 1],
  ['ARC', 'Archived', 'both', 'Archive', '#334155', 0, 1]
];
for (const s of STATUSES) {
  q.run(`INSERT OR IGNORE INTO statuses (code,name,scope,phase,color,is_initial,is_terminal) VALUES (?,?,?,?,?,?,?)`, ...s);
}
const stId = {};
for (const s of q.all(`SELECT id, code FROM statuses`)) stId[s.code] = s.id;

// Configured transitions (from NULL => initial registration)
const TRANSITIONS = [
  [null, 'REG'], [null, 'DFT'],
  ['DFT', 'REG'], ['DFT', 'URV'],
  ['REG', '2PK'], ['REG', 'URV'], ['REG', 'CLS'], ['REG', 'DFT'],
  ['2PK', 'URV'], ['2PK', 'REG'],
  ['URV', 'PEND'], ['URV', 'REJ'], ['URV', 'REG'],
  ['PEND', 'PAP'], ['PEND', 'REJ'], ['PEND', 'REG'], ['PEND', 'END'],
  ['END', 'PAP'],
  ['PAP', 'APP'], ['PAP', 'REJ'], ['PAP', 'REG'],
  ['REJ', 'DFT'], ['REJ', 'REG'], ['REJ', 'SUP'],
  ['APP', 'SUP'], ['APP', 'IFC'], ['APP', 'AB'], ['APP', 'IFA'], ['APP', 'CLS'],
  ['APP', 'DFT'],
  ['IFA', 'APP'], ['IFA', 'RTC'],
  ['IFR', 'APP'], ['IFR', 'RTC'],
  ['IFC', 'AB'], ['AB', 'CLS'], ['AB', 'SUP'],
  ['RTC', 'APP'], ['RTC', 'IFA'], ['RTC', 'SUP'], ['RTC', 'URV'],
  ['SUP', 'ARC'], ['SUP', 'CLS'], ['CLS', 'ARC']
];
for (const [from, to] of TRANSITIONS) {
  q.run(`INSERT OR IGNORE INTO status_transitions (from_status_id, to_status_id, allowed_roles) VALUES (?,?, '[]')`,
    from ? stId[from] : null, stId[to]);
}

// ---------------- Numbering rules ----------------
q.run(`INSERT INTO numbering_rules (code,name,entity_type,pattern,sequence_length,sequence_scope,revision_style,separator)
       VALUES ('DOC-DEFAULT','Standard Engineering Document Number','DOCUMENT',?,6,'RULE_YEAR_PROJECT','numeric0','-')`,
  JSON.stringify([
    { type: 'token', value: 'YEAR' }, { type: 'literal', value: '-' },
    { type: 'token', value: 'PROJECT' }, { type: 'literal', value: '-' },
    { type: 'token', value: 'DISCIPLINE' }, { type: 'literal', value: '-' },
    { type: 'token', value: 'SYSTEM' }, { type: 'literal', value: '-' },
    { type: 'token', value: 'AREA' }, { type: 'literal', value: '-' },
    { type: 'token', value: 'DOCTYPE' }, { type: 'literal', value: '-' },
    { type: 'token', value: 'SEQ' }
  ]));
q.run(`INSERT INTO numbering_rules (code,name,entity_type,pattern,sequence_length,sequence_scope,revision_style,separator)
       VALUES ('TRN-DEFAULT','Transmittal Number','TRANSMITTAL',?,4,'RULE_YEAR','numeric0','-')`,
  JSON.stringify([{ type: 'literal', value: 'TRN' }, { type: 'token', value: 'YEAR' }, { type: 'token', value: 'SEQ' }]));
q.run(`INSERT INTO numbering_rules (code,name,entity_type,pattern,sequence_length,sequence_scope,revision_style,separator)
       VALUES ('CORR-IN','Incoming Correspondence','CORRESPONDENCE',?,4,'RULE_YEAR','numeric0','-')`,
  JSON.stringify([{ type: 'literal', value: 'IN' }, { type: 'token', value: 'YEAR' }, { type: 'token', value: 'SEQ' }]));
q.run(`INSERT INTO numbering_rules (code,name,entity_type,pattern,sequence_length,sequence_scope,revision_style,separator)
       VALUES ('CORR-OUT','Outgoing Correspondence','CORRESPONDENCE',?,4,'RULE_YEAR','numeric0','-')`,
  JSON.stringify([{ type: 'literal', value: 'OUT' }, { type: 'token', value: 'YEAR' }, { type: 'token', value: 'SEQ' }]));
q.run(`INSERT INTO numbering_rules (code,name,entity_type,pattern,sequence_length,sequence_scope,revision_style,separator)
       VALUES ('MEMO-DEFAULT','Office Memo','MEMO',?,4,'RULE_YEAR','numeric0','-')`,
  JSON.stringify([{ type: 'literal', value: 'MEMO' }, { type: 'token', value: 'YEAR' }, { type: 'token', value: 'SEQ' }]));
q.run(`INSERT INTO numbering_rules (code,name,entity_type,pattern,sequence_length,sequence_scope,revision_style,separator)
       VALUES ('RES-DEFAULT','Resolution / Decision','RESOLUTION',?,3,'RULE_YEAR','numeric0','-')`,
  JSON.stringify([{ type: 'literal', value: 'RES' }, { type: 'token', value: 'YEAR' }, { type: 'token', value: 'SEQ' }]));

const ruleIds = {};
for (const r of q.all(`SELECT id, code FROM numbering_rules`)) ruleIds[r.code] = r.id;

// ---------------- Taxonomy ----------------
const orgIns = (code, name, type, contact) =>
  q.run(`INSERT INTO organizations (code,name,org_type,contact_name,contact_email) VALUES (?,?,?,?,?)`,
    code, name, type, contact || null, contact ? `${String(contact).toLowerCase().replace(/\s+/g, '.')}@example.com` : null);
orgIns('LUK', 'Lukoil-Permian Safety Services (Dev.) Ltd.', 'Operator');
orgIns('EPC1', 'Demo EPC Contractor LLC', 'Contractor');
orgIns('SUB7', 'SubSeven Subcontractor Ltd.', 'Subcontractor');
orgIns('VEN4', 'Vendor Four Instruments Inc.', 'Vendor');
orgIns('CONS2', 'Consulting Partners Group', 'Consultant');

const depIns = (code, name) => q.run(`INSERT INTO departments (code,name) VALUES (?,?)`, code, name);
depIns('OCTG', 'OCTG'); depIns('CT', 'Coiled Tubing'); depIns('WC', 'Well Completion'); depIns('EPC', 'EPC Projects'); depIns('GEN', 'General Services');

q.run(`INSERT INTO projects (code,name,customer_org_id,lifecycle_stage,status) VALUES ('0150','Well Completion Campaign — Permian Basin',(SELECT id FROM organizations WHERE code='LUK'),'Execution','Active')`);
q.run(`INSERT INTO projects (code,name,customer_org_id,lifecycle_stage,status) VALUES ('0200','Gas Processing Plant Revamp',(SELECT id FROM organizations WHERE code='LUK'),'Detailed Design','Active')`);

q.run(`INSERT INTO contracts (number,title,project_id,customer_org_id,contractor_org_id,status)
       SELECT 'RL-19-0934-253','Engineering, Procurement & Construction Support Services',p.id,o.id,e.id,'Active'
       FROM projects p, organizations o, organizations e WHERE p.code='0150' AND o.code='LUK' AND e.code='EPC1'`);
q.run(`INSERT INTO contracts (number,title,project_id,customer_org_id,contractor_org_id,status)
       SELECT 'RL-20-0455-001','Front-End Engineering Services',p.id,o.id,e.id,'Active'
       FROM projects p, organizations o, organizations e WHERE p.code='0200' AND o.code='LUK' AND e.code='CONS2'`);

const discIns = (code, name) => q.run(`INSERT INTO disciplines (code,name) VALUES (?,?)`, code, name);
discIns('CVT', 'Control & Automation'); discIns('PROC', 'Process'); discIns('MECH', 'Mechanical');
discIns('ST', 'Civil / Structural'); discIns('ELEC', 'Electrical'); discIns('INSTR', 'Instrumentation'); discIns('SAFE', 'HSE & Safety');

const dtIns = (code, name, rr, rv = 1, re = 1, ra = 1) =>
  q.run(`INSERT INTO document_types (code,name,requires_review,requires_endorsement,requires_approval,numbering_rule_id) VALUES (?,?,?,?,?,?)`,
    code, name, rv, re, ra, ruleIds[rr]);
dtIns('SP', 'Study / Special Report', 'DOC-DEFAULT');
dtIns('SOP', 'Standard Operating Procedure', 'DOC-DEFAULT');
dtIns('PLAN', 'Plan', 'DOC-DEFAULT');
dtIns('SPEC', 'Specification', 'DOC-DEFAULT');
dtIns('DWG', 'Drawing', 'DOC-DEFAULT');
dtIns('RPT', 'Technical Report', 'DOC-DEFAULT');
dtIns('CAL', 'Calculation Note', 'DOC-DEFAULT');
dtIns('PROC-D', 'Procedure Document', 'DOC-DEFAULT');

const catIns = (code, name) => q.run(`INSERT INTO categories (code,name) VALUES (?,?)`, code, name);
catIns('ENG', 'Engineering'); catIns('QA', 'QA/QC'); catIns('OPS', 'Operations'); catIns('COM', 'Commissioning');

const purIns = (code, name) => q.run(`INSERT INTO purposes (code,name) VALUES (?,?)`, code, name);
purIns('APR', 'For Approval'); purIns('REV', 'For Review'); purIns('CON', 'For Construction'); purIns('ASB', 'As-Built'); purIns('INF', 'For Information');

const retIns = (code, name, years) => q.run(`INSERT INTO retention_rules (code,name,retention_years,description) VALUES (?,?,?,?)`,
  code, name, years, `${years}-year retention class`);
retIns('R5', 'Short-term retention', 5); retIns('R10', 'Standard retention', 10); retIns('PERM', 'Permanent record', 99);

// ---------------- Workflow template ----------------
q.run(`INSERT INTO workflows (code,name,description,entity_type) VALUES ('DOC-TECH-APPROVAL','Technical Document Review & Approval','DCC -> Reviewer -> Endorser -> Approver','DOCUMENT')`);
const wfId = q.get(`SELECT id FROM workflows WHERE code='DOC-TECH-APPROVAL'`).id;
q.run(`INSERT INTO workflow_versions (workflow_id,version_no,definition) VALUES (?,1,?)`, wfId, JSON.stringify({
  steps: [
    { key: 'technical_review', name: 'Technical Review', type: 'review', assignee_type: 'role', assignee_value: 'REVIEWER', deadline_hours: 72 },
    { key: 'technical_endorsement', name: 'Technical Endorsement', type: 'endorsement', assignee_type: 'role', assignee_value: 'ENDORSER', deadline_hours: 48 },
    { key: 'formal_approval', name: 'Formal Approval', type: 'approval', assignee_type: 'role', assignee_value: 'APPROVER', deadline_hours: 72 }
  ]
}));

// ---------------- Users ----------------
const PW = hashPassword('Password123!');
const uIns = (username, full_name, email, role, deptCode, orgCode, phone) =>
  Number(q.run(
    `INSERT INTO users (username,email,full_name,password_hash,role_id,department_id,organization_id,phone)
     VALUES (?,?,?,?,
       (SELECT id FROM roles WHERE code=?),
       (SELECT id FROM departments WHERE code=?),
       (SELECT id FROM organizations WHERE code=?), ?)`,
    username, email, full_name, PW, role, deptCode, orgCode, phone || null).lastInsertRowid);

const admin = uIns('admin', 'System Administrator', 'admin@idms.local', 'ADMIN', 'GEN', 'LUK');
const dcc = uIns('dcc', 'Demo DCC User', 'dcc@idms.local', 'DCC', 'EPC', 'EPC1');
const reviewer = uIns('reviewer', 'Demo Reviewer', 'reviewer@idms.local', 'REVIEWER', 'WC', 'EPC1');
const endorser = uIns('achuplin', 'Andrei Chuplin', 'andrei.chuplin@example.com', 'ENDORser'.toUpperCase(), 'INSTR', 'LUK');
const approver = uIns('approver', 'Demo Approver', 'approver@idms.local', 'APPROVER', 'EPC', 'LUK');
const pm = uIns('pm', 'Demo Project Manager', 'pm@idms.local', 'PM', 'EPC', 'LUK');
const deptmgr = uIns('deptmgr', 'Demo Department Manager', 'deptmgr@idms.local', 'DEPT_MANAGER', 'WC', 'EPC1');
const contractor = uIns('contractor1', 'Demo Contractor User', 'contractor@example.com', 'CONTRACTOR', 'EPC', 'EPC1');
const viewer = uIns('viewer', 'Demo Read-only User', 'viewer@idms.local', 'READONLY', 'GEN', 'LUK');

// ---------------- Notification rules ----------------
seedRules();
// enable email outbox for key events (demo)
for (const ev of ['REVIEW_ASSIGNED', 'APPROVAL_REQUESTED', 'TRANSMITTAL_ISSUED']) {
  q.run(`UPDATE notification_rules SET email_enabled=1 WHERE event_code=?`, ev);
}

// ---------------- SLA rules ----------------
q.run(`INSERT INTO sla_rules (code,entity_type,days,escalate_after_days) VALUES ('SLA-REV','REVIEW',3,1)`);
q.run(`INSERT INTO sla_rules (code,entity_type,days,escalate_after_days) VALUES ('SLA-END','ENDORSEMENT',2,1)`);
q.run(`INSERT INTO sla_rules (code,entity_type,days,escalate_after_days) VALUES ('SLA-APPR','APPROVAL',3,1)`);
q.run(`INSERT INTO sla_rules (code,entity_type,days,escalate_after_days) VALUES ('SLA-RES','RESOLUTION',14,7)`);

// ---------------- System configuration ----------------
const cfg = (k, v, d) => q.run(`INSERT INTO configurations (key,value,description) VALUES (?,?,?)`, k, v, d);
cfg('company.name', 'Lukoil-Permian Safety Services (Dev.) Ltd.', 'Displayed organization');
cfg('doccontrol.email', 'dcc@idms.local', 'Document control contact');
cfg('search.default_page_size', '25', 'Default search page size');
cfg('archive.auto_after_status', 'SUP,CLS', 'Statuses that make documents archivable');
cfg('session.timeout_hours', '12', 'Session lifetime');

// ---------------- File helper ----------------
const { storeFile } = require('./lib/storage');
function sampleFile(name, lines) {
  const buf = Buffer.from(lines.join('\n'), 'utf8');
  return storeFile(buf, name.endsWith('.pdf') ? name.replace('.pdf', '.txt') : name,
    'text/plain', admin);
}

const proj150 = q.get(`SELECT * FROM projects WHERE code='0150'`);
const proj200 = q.get(`SELECT * FROM projects WHERE code='0200'`);
const contract253 = q.get(`SELECT * FROM contracts WHERE number='RL-19-0934-253'`);
const luk = q.get(`SELECT * FROM organizations WHERE code='LUK'`);
const epc1 = q.get(`SELECT * FROM organizations WHERE code='EPC1'`);

function insertDocument({ number, title, direction, typeId, projectId, contractId, disciplineId, departmentId,
  originatorId, customerId, contractorId, area, system, pkg, phase, purposeCode, statusCode, extStatusCode,
  keywords, remarks, retentionCode, confidentiality, receiptDate, acceptDate, dueDate, reviewDueDate }) {
  const r = q.run(
    `INSERT INTO documents (doc_number,title,direction,doc_type_id,category_id,project_id,contract_id,discipline_id,
      department_id,originator_org_id,customer_org_id,contractor_org_id,area,system,package,phase,purpose_id,
      internal_status_id,external_status_id,keywords,remarks,retention_rule_id,confidentiality,
      receipt_date,accept_date,due_date,review_due_date,endorser_user_id,dcc_user_id,reviewer_user_id,approver_user_id,
      created_by,registered_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))`,
    number, title, direction || 'incoming',
    typeId, q.get(`SELECT id FROM categories WHERE code=?`, 'ENG').id,
    projectId, contractId || null, disciplineId || null, departmentId || null,
    originatorId || null, customerId || null, contractorId || null,
    area || null, system || null, pkg || null, phase || 'Detailed Design',
    purposeCode ? q.get(`SELECT id FROM purposes WHERE code=?`, purposeCode).id : null,
    stId[statusCode], extStatusCode ? stId[extStatusCode] : null,
    keywords || null, remarks || null,
    retentionCode ? q.get(`SELECT id FROM retention_rules WHERE code=?`, retentionCode).id : null,
    confidentiality || 'Internal',
    receiptDate || null, acceptDate || null, dueDate || null, reviewDueDate || null,
    endorser, dcc, reviewer, approver,
    dcc);
  return Number(r.lastInsertRowid);
}

function insertRevision(docId, code, { status = 'DFT', fileId = null, reason = null } = {}) {
  // only one current revision per document — demote any existing one first
  q.run(`UPDATE document_revisions SET is_current=0 WHERE document_id=?`, docId);
  const r = q.run(
    `INSERT INTO document_revisions (document_id,revision_code,revision_reason,revision_date,file_id,
      author_user_id,reviewer_user_id,endorser_user_id,approver_user_id,status_id,is_current,created_by)
     VALUES (?,?,?,?,?,?,?,?,?,?,1,?)`,
    docId, code, reason, q.today(), fileId, contractor, reviewer, endorser, approver, stId[status], dcc);
  return Number(r.lastInsertRowid);
}

// ============================================================
// DEMONSTRATION DATA
// ============================================================

// --- 1) The specified example document ---
const spType = q.get(`SELECT id FROM document_types WHERE code='SP'`).id;
const cvt = q.get(`SELECT id FROM disciplines WHERE code='CVT'`).id;
const d1 = insertDocument({
  number: '2018-0150-CVT-ST-ZSI-04-SP-0001A',
  title: 'ALARM Instrumentation Report (CPI)',
  direction: 'incoming', typeId: spType, projectId: proj150.id, contractId: contract253.id,
  disciplineId: cvt, departmentId: q.get(`SELECT id FROM departments WHERE code='WC'`).id,
  originatorId: epc1.id, customerId: luk.id, contractorId: epc1.id,
  system: 'ST', area: 'ZSI', pkg: '04', phase: 'Detailed Design',
  purposeCode: 'APR', statusCode: '2PK', extStatusCode: 'RTC',
  keywords: 'alarm, instrumentation, CPI, safety', remarks: 'Contractor resubmission after 2-pack verification.',
  retentionCode: 'R10', receiptDate: '2020-10-16', acceptDate: '2020-10-19'
});
{
  const f1 = sampleFile('ALARM_Instrumentation_Report_CPI.txt', [
    'ALARM INSTRUMENTATION REPORT (CPI)',
    'Document No: 2018-0150-CVT-ST-ZSI-04-SP-0001A Rev 0',
    'Customer: Lukoil-Permian Safety Services (Dev.) Ltd.',
    'Contract: RL-19-0934-253',
    '',
    '1. Purpose',
    'This report summarizes the alarm rationalization study for Zone Separation Interface (ZSI-04).',
    '',
    '2. Findings',
    'A total of 142 alarms were reviewed; 31 were classified as nuisance and recommended for suppression.',
    '',
    '3. Recommendations',
    'Revise alarm setpoints per Table 7-2; implement operator response tracking.'
  ]);
  const rev1 = insertRevision(d1, '0', { status: 'APP', fileId: f1 });
  q.run(`INSERT INTO document_versions (revision_id,version_no,file_id,comment,uploaded_by) VALUES (?,?,?,?,?)`,
    rev1, 1, f1, 'Initial submission', contractor);
  q.run(`UPDATE document_revisions SET approval_date='2020-11-02' WHERE id=?`, rev1);
  q.run(`UPDATE documents SET current_revision_id=?, archive_status='eligible' WHERE id=?`, rev1, d1);
  q.run(`INSERT INTO related_records (entity_type,entity_id,related_type,related_id,link_note,created_by) VALUES ('DOCUMENT',?,'DOCUMENT',?,'Supersedes draft issue',?)`,
    d1, d1, dcc);
}

// --- 2) Under review (live review task for reviewer) ---
const n2 = nextNumber('DOC-DEFAULT', {
  projectCode: '0150', disciplineCode: 'INSTR', system: 'ESD', area: 'Z01', docTypeCode: 'SPEC'
}, dcc, 'DOCUMENT');
const specType = q.get(`SELECT id FROM document_types WHERE code='SPEC'`).id;
const instr = q.get(`SELECT id FROM disciplines WHERE code='INSTR'`).id;
const d2 = insertDocument({
  number: n2, title: 'Emergency Shutdown Valve Specifications (Revamp)',
  direction: 'incoming', typeId: specType, projectId: proj150.id, contractId: contract253.id,
  disciplineId: instr, originatorId: epc1.id, customerId: luk.id, contractorId: epc1.id,
  system: 'ESD', area: 'Z01', purposeCode: 'APR', statusCode: 'REG',
  retentionCode: 'R10', receiptDate: q.today(), reviewDueDate: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10)
});
{
  const f2 = sampleFile(`${n2}_rev0.txt`, ['EMERGENCY SHUTDOWN VALVE SPECIFICATIONS', 'Generated demonstration document.']);
  const rev2 = insertRevision(d2, '0', { status: 'URV', fileId: f2 });
  q.run(`INSERT INTO document_versions (revision_id,version_no,file_id,comment,uploaded_by) VALUES (?,?,?,?,?)`,
    rev2, 1, f2, 'Contractor submission for approval', contractor);
  q.run(`UPDATE documents SET current_revision_id=? WHERE id=?`, rev2, d2);
  startWorkflow('DOC-TECH-APPROVAL', { id: d2, doc_number: n2, endorser_user_id: endorser, approver_user_id: approver },
    rev2, { startedBy: dcc, assignments: { technical_review: reviewer }, reviewDueDate: q.get(`SELECT review_due_date x FROM documents WHERE id=?`, d2).x });
}

// --- 3) Pending approval (reviewed + endorsed) ---
const n3 = nextNumber('DOC-DEFAULT', { projectCode: '0200', disciplineCode: 'PROC', system: 'SEP', area: 'AREA100', docTypeCode: 'CAL' }, dcc, 'DOCUMENT');
const calType = q.get(`SELECT id FROM document_types WHERE code='CAL'`).id;
const proc = q.get(`SELECT id FROM disciplines WHERE code='PROC'`).id;
const d3 = insertDocument({
  number: n3, title: 'Separator Sizing Calculation Note',
  direction: 'outgoing', typeId: calType, projectId: proj200.id,
  contractId: q.get(`SELECT id FROM contracts WHERE number='RL-20-0455-001'`).id,
  disciplineId: proc, originatorId: luk.id, customerId: luk.id, contractorId: epc1.id,
  system: 'SEP', area: 'AREA100', purposeCode: 'APR', statusCode: 'REG',
  retentionCode: 'PERM', receiptDate: q.today()
});
{
  const f3 = sampleFile(`${n3}_rev0.txt`, ['SEPARATOR SIZING CALCULATION NOTE', 'Two-phase vertical separator sizing per GPSA.']);
  const rev3 = insertRevision(d3, '0', { status: 'PAP', fileId: f3 });
  q.run(`INSERT INTO document_versions (revision_id,version_no,file_id,uploaded_by) VALUES (?,?,?,?)`,
    rev3, 1, f3, dcc);
  q.run(`UPDATE documents SET current_revision_id=? WHERE id=?`, rev3, d3);
  const inst = startWorkflow('DOC-TECH-APPROVAL', { id: d3, doc_number: n3, endorser_user_id: endorser, approver_user_id: approver },
    rev3, { startedBy: dcc, assignments: { technical_review: reviewer } });
  // complete review + endorsement programmatically (real engine calls)
  const review = q.get(`SELECT * FROM reviews WHERE document_id=? ORDER BY id DESC LIMIT 1`, d3);
  q.run(`UPDATE reviews SET status='approved', completed_at=datetime('now') WHERE id=?`, review.id);
  completeWfStep(review.wf_step_id, 'completed', 'Reviewed — calculations verified.', reviewer);
  const endr = q.get(`SELECT * FROM endorsements WHERE document_id=? ORDER BY id DESC LIMIT 1`, d3);
  q.run(`UPDATE endorsements SET status='endorsed', acted_at=datetime('now') WHERE id=?`, endr.id);
  completeWfStep(endr.wf_step_id, 'completed', 'Technically sound. Endorsed.', endorser);
}

// --- 4) Approved + issued transmittal with acknowledgement ---
const n4 = nextNumber('DOC-DEFAULT', { projectCode: '0150', disciplineCode: 'MECH', system: 'CTU', area: 'WELLHEAD', docTypeCode: 'PROC-D' }, dcc, 'DOCUMENT');
const procType = q.get(`SELECT id FROM document_types WHERE code='PROC-D'`).id;
const mech = q.get(`SELECT id FROM disciplines WHERE code='MECH'`).id;
const ctDept = q.get(`SELECT id FROM departments WHERE code='CT'`).id;
const d4 = insertDocument({
  number: n4, title: 'Coiled Tubing Intervention Procedure — Well P-07',
  direction: 'outgoing', typeId: procType, projectId: proj150.id, contractId: contract253.id,
  disciplineId: mech, departmentId: ctDept, originatorId: luk.id, customerId: luk.id, contractorId: epc1.id,
  system: 'CTU', area: 'WELLHEAD', phase: 'Execution', purposeCode: 'CON', statusCode: 'APP',
  retentionCode: 'R5', acceptDate: q.today()
});
let rev4;
{
  const f4 = sampleFile(`${n4}_rev0.txt`, ['COILED TUBING INTERVENTION PROCEDURE', 'Well P-07 clean-out programme.']);
  rev4 = insertRevision(d4, '0', { status: 'APP', fileId: f4 });
  q.run(`INSERT INTO document_versions (revision_id,version_no,file_id,uploaded_by) VALUES (?,?,?,?)`, rev4, 1, f4, dcc);
  q.run(`UPDATE documents SET current_revision_id=? WHERE id=?`, rev4, d4);
  finalizeApprovedRevision({ documentId: d4, revisionId: rev4, actor: { id: approver } });
}

const trnNo = nextNumber('TRN-DEFAULT', {}, dcc, 'TRANSMITTAL');
{
  const t = q.run(
    `INSERT INTO transmittals (trn_number,direction,subject,sender_user_id,sender_org_id,recipient_org_id,
       recipient_contact,purpose_id,trn_date,response_required,response_due_date,status,acknowledged_at,created_by)
     VALUES (?,'outgoing','Issued for Construction — CT Intervention Package',?,?,?,?,
       (SELECT id FROM purposes WHERE code='CON'),date('now'),1,date('now','+7 day'),'issued',datetime('now'),?)`,
    trnNo, dcc, luk.id, epc1.id, 'contracts@demoepc.example.com', dcc);
  const tid = Number(t.lastInsertRowid);
  q.run(`INSERT INTO transmittal_items (transmittal_id,document_id,revision_id,item_action) VALUES (?,?,?,'issue')`, tid, d4, rev4);
  q.run(`INSERT INTO distributions (transmittal_id,recipient_org_id,copy_type,status,sent_at,acknowledged_at,acknowledged_by)
         VALUES (?,?,'Electronic','sent',datetime('now'),NULL,NULL)`, tid, epc1.id);
  q.run(`UPDATE documents SET transmittal_ref=? WHERE id=?`, trnNo, d4);
  notify('TRANSMITTAL_ISSUED', {
    assigneeIds: [contractor], entityType: 'TRANSMITTAL', entityId: tid,
    title: 'Transmittal issued', body: `${trnNo} issued to your organization.`,
    vars: { trnNumber: trnNo }
  });
}

// --- 5) Superseded revision history on a fifth document ---
const n5 = nextNumber('DOC-DEFAULT', { projectCode: '0150', disciplineCode: 'SAFE', system: 'HSE', area: 'CAMPSOUTH', docTypeCode: 'RPT' }, dcc, 'DOCUMENT');
const rptType = q.get(`SELECT id FROM document_types WHERE code='RPT'`).id;
const safe = q.get(`SELECT id FROM disciplines WHERE code='SAFE'`).id;
const d5 = insertDocument({
  number: n5, title: 'Site Safety Plan — South Camp Facilities',
  direction: 'outgoing', typeId: rptType, projectId: proj150.id, contractId: contract253.id,
  disciplineId: safe, originatorId: luk.id, customerId: luk.id, contractorId: epc1.id,
  area: 'CAMPSOUTH', purposeCode: 'APR', statusCode: 'APP', retentionCode: 'PERM'
});
{
  const fA = sampleFile(`${n5}_rev0.txt`, ['SITE SAFETY PLAN', 'Revision 0 baseline.']);
  const fB = sampleFile(`${n5}_revA.txt`, ['SITE SAFETY PLAN', 'Revision A incorporates HSE committee comments.']);
  const r0 = insertRevision(d5, '0', { status: 'SUP', fileId: fA, reason: 'Baseline issue' });
  q.run(`INSERT INTO document_versions (revision_id,version_no,file_id,uploaded_by) VALUES (?,?,?,?)`, r0, 1, fA, dcc);
  const rA = insertRevision(d5, 'A', { status: 'APP', fileId: fB, reason: 'Incorporate comments' });
  q.run(`INSERT INTO document_versions (revision_id,version_no,file_id,uploaded_by) VALUES (?,?,?,?)`, rA, 1, fB, dcc);
  q.run(`UPDATE document_revisions SET superseded_by_revision_id=?, approval_date=date('now') WHERE id=?`, rA, r0);
  q.run(`UPDATE documents SET current_revision_id=? WHERE id=?`, rA, d5);
}

// --- 6) Correspondence ---
{
  const cin = nextNumber('CORR-IN', {}, dcc, 'CORRESPONDENCE');
  const cout = nextNumber('CORR-OUT', {}, dcc, 'CORRESPONDENCE');
  q.run(
    `INSERT INTO correspondence (corr_number,direction,subject,corr_type,sender_org_id,sender_name,recipient_org_id,
      corr_date,received_date,response_required,response_due_date,assigned_user_id,status,body,created_by)
     VALUES (?,'incoming','Submission of ALARM Instrumentation Report (CPI)','Letter',?,?,?,?,date(?),1,date('now','+5 day'),?,'in_progress',
       'Please find enclosed report 2018-0150-CVT-ST-ZSI-04-SP-0001A for review and acceptance.',?)`,
    cin, epc1.id, 'Demo EPC Contractor LLC', luk.id, q.today(), '2020-10-16', dcc, dcc);
  const cinId = q.get(`SELECT id FROM correspondence WHERE corr_number=?`, cin).id;
  q.run(`INSERT INTO correspondence_links (correspondence_id,entity_type,entity_id) VALUES (?,'DOCUMENT',?)`, cinId, d1);
  q.run(`UPDATE documents SET correspondence_ref=? WHERE id=?`, cin, d1);

  q.run(
    `INSERT INTO correspondence (corr_number,direction,subject,corr_type,sender_org_id,recipient_org_id,
      corr_date,response_required,assigned_user_id,status,body,created_by)
     VALUES (?,'outgoing','Request for Revised Alarm Setpoint Tables','Email',?,?,?,0,?,'closed',
       'Kindly revise Table 7-2 alarm setpoints and resubmit.',?)`,
    cout, luk.id, epc1.id, q.today(), dcc, dcc);
  const coutId = q.get(`SELECT id FROM correspondence WHERE corr_number=?`, cout).id;
  q.run(`INSERT INTO correspondence_links (correspondence_id,entity_type,entity_id) VALUES (?,'DOCUMENT',?)`, coutId, d1);
}

// --- 7) Office memo ---
{
  const mno = nextNumber('MEMO-DEFAULT', {}, admin, 'MEMO');
  q.run(`INSERT INTO memos (memo_number,subject,from_user_id,to_users,cc_users,department_id,memo_date,priority,body,status,created_by,issued_at)
         VALUES (?,?,?,?,?,?,?,?,?,'issued',?,datetime('now'))`,
    mno, 'Document Control Operating Procedures Update',
    admin, JSON.stringify([dcc, reviewer, approver]), JSON.stringify([pm]),
    q.get(`SELECT id FROM departments WHERE code='GEN'`).id, q.today(), 'Normal',
    'Effective immediately: all incoming contractor submissions must be registered within one business day of receipt. Transmittal acknowledgements are mandatory before closure.',
    admin);
}

// --- 8) Resolutions (one open, one overdue->escalated) ---
{
  const r1no = nextNumber('RES-DEFAULT', {}, pm, 'RESOLUTION');
  q.run(`INSERT INTO resolutions (resolution_number,resolution_date,meeting_ref,subject,decision,responsible_user_id,
           department_id,action_required,due_date,priority,status,created_by)
         VALUES (?,date('now','+21 day'),'Weekly Progress Meeting #42','Alarm management platform selection',
           'Adopt vendor-neutral alarm rationalization toolchain across Project 0150.',
           ?,?,?,date('now','+10 day'),'High','open',?)`,
    r1no, reviewer, q.get(`SELECT id FROM departments WHERE code='INSTR'`)?.id || null,
    'Evaluate shortlisted tools and present comparative analysis.', pm);

  const r2no = nextNumber('RES-DEFAULT', {}, pm, 'RESOLUTION');
  const rid2 = Number(q.run(
    `INSERT INTO resolutions (resolution_number,resolution_date,meeting_ref,subject,decision,responsible_user_id,
       department_id,action_required,due_date,priority,status,created_by)
     VALUES (?,date('now','-40 day'),'Kick-off Meeting #01','Legacy register migration',
       'Migrate legacy Excel register into IDMS with metadata validation report.',
       ?,?,?,date('now','-10 day'),'Urgent','escalated',?)`,
    r2no, dcc, q.get(`SELECT id FROM departments WHERE code='EPC'`).id,
    'Complete migration workbook and submit for QA sampling.', pm).lastInsertRowid);
  q.run(`INSERT INTO resolution_comments (resolution_id,user_id,comment) VALUES (?,?,?)`,
    rid2, dcc, 'Migration 80% complete — awaiting contractor metadata extracts.');
}

console.log('[seed] Done.');
console.log(`
============================================================
 IDMS demonstration database ready.

 URL:        http://localhost:8088
 Accounts (password for all): Password123!
 ------------------------------------------------------------
 admin        Administrator
 dcc          Demo DCC User          (Document Controller)
 reviewer     Demo Reviewer          (has live review task)
 achuplin     Andrei Chuplin         (Endorser)
 approver     Demo Approver          (pending approvals)
 pm           Demo Project Manager
 deptmgr      Demo Department Manager
 contractor1  Demo Contractor User   (can acknowledge TRN)
 viewer       Demo Read-only User
============================================================
`);
