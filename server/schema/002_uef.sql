-- ============================================================
-- IDMS — Migration 002: UEF Document Control Integration
-- Controlled Code Registry, Dual Numbering, Allocation Log,
-- DCR extension, TDR/MDR/VDR/SOP registers, DDM, Correction Log,
-- Correspondence SLA
-- ============================================================

-- ---------- CONTROLLED CODE REGISTRY ----------
CREATE TABLE controlled_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code_set TEXT NOT NULL CHECK (code_set IN ('DEPARTMENT','SECTION','DISCIPLINE','DOCTYPE','ORIGINATOR','CLASS','LANGUAGE')),
  code TEXT NOT NULL,
  description TEXT NOT NULL,
  lifecycle TEXT NOT NULL DEFAULT 'active' CHECK (lifecycle IN ('active','inactive','retired')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by INTEGER REFERENCES users(id),
  UNIQUE (code_set, code)
);
CREATE INDEX idx_codes_set ON controlled_codes(code_set, lifecycle);

-- ---------- UEF NUMBERING SERIES (isolation per scheme+segments) ----------
CREATE TABLE uef_series (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  series_key TEXT NOT NULL UNIQUE,        -- C|DEP|SEC|DOCTYPE  or  P|PRID|SS|DISC|DOCTYPE
  scheme TEXT NOT NULL CHECK (scheme IN ('CORPORATE','PROJECT')),
  prid TEXT, ss TEXT, department TEXT, section TEXT, discipline TEXT, doc_type TEXT,
  last_seq INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------- NUMBER ALLOCATION LOG ----------
CREATE TABLE number_allocations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_number TEXT NOT NULL UNIQUE,    -- NAL-YYYY-NNNN
  request_date TEXT NOT NULL DEFAULT (date('now')),
  requesting_department TEXT,
  owner_user_id INTEGER REFERENCES users(id),
  proposed_title TEXT NOT NULL,
  system TEXT,
  prid TEXT,
  so_po TEXT,
  discipline TEXT,
  doc_type TEXT,
  scheme TEXT CHECK (scheme IN ('CORPORATE','PROJECT')),
  department TEXT,
  section TEXT,
  ss TEXT,
  sequence INTEGER,
  generated_number TEXT UNIQUE,
  series_key TEXT,
  gap_check TEXT,
  decision TEXT NOT NULL DEFAULT 'pending' CHECK (decision IN ('pending','allocated','rejected','cancelled','issued')),
  allocation_date TEXT,
  allocated_by INTEGER REFERENCES users(id),
  status TEXT,
  remarks TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_alloc_series ON number_allocations(series_key);
CREATE INDEX idx_alloc_number ON number_allocations(generated_number);

-- ---------- DCR EXTENSION FIELDS ----------
ALTER TABLE documents ADD COLUMN entry_number INTEGER;
ALTER TABLE documents ADD COLUMN register_type TEXT NOT NULL DEFAULT 'DCR';
ALTER TABLE documents ADD COLUMN prid TEXT;
ALTER TABLE documents ADD COLUMN so_po TEXT;
ALTER TABLE documents ADD COLUMN owner_user_id INTEGER REFERENCES users(id);
ALTER TABLE documents ADD COLUMN class_code TEXT;
ALTER TABLE documents ADD COLUMN pages_sheets INTEGER;
ALTER TABLE documents ADD COLUMN supersedes_document_id INTEGER REFERENCES documents(id);
ALTER TABLE documents ADD COLUMN archive_location TEXT;
ALTER TABLE documents ADD COLUMN department_code TEXT;
ALTER TABLE documents ADD COLUMN section_code TEXT;
ALTER TABLE documents ADD COLUMN originator_code TEXT;
ALTER TABLE documents ADD COLUMN numbering_scheme TEXT;
ALTER TABLE documents ADD COLUMN allocation_id INTEGER REFERENCES number_allocations(id);
CREATE UNIQUE INDEX idx_docs_entry ON documents(entry_number);
CREATE INDEX idx_docs_register ON documents(register_type);
CREATE INDEX idx_docs_alloc ON documents(allocation_id);

-- Backfill entry numbers for existing records
UPDATE documents SET entry_number = (SELECT COUNT(*) FROM documents d2 WHERE d2.id <= documents.id);

-- ---------- REGISTER EXTENSIONS ----------
CREATE TABLE register_tdr (
  document_id INTEGER PRIMARY KEY REFERENCES documents(id),
  s_n INTEGER,
  typical TEXT NOT NULL DEFAULT 'Typical' CHECK (typical IN ('Typical','Non-Typical')),
  planned_revision TEXT,
  approval_code TEXT,
  date_submitted TEXT,
  date_approved TEXT,
  transmittal_ref TEXT,
  sheets INTEGER
);
CREATE TABLE register_mdr (
  document_id INTEGER PRIMARY KEY REFERENCES documents(id),
  deliverable_category TEXT,
  planned_revision TEXT,
  approval_code TEXT,
  date_submitted TEXT,
  date_approved TEXT,
  transmittal_ref TEXT
);
CREATE TABLE register_vdr (
  document_id INTEGER PRIMARY KEY REFERENCES documents(id),
  vendor_doc_number TEXT NOT NULL,
  vendor_org_id INTEGER REFERENCES organizations(id),
  po_number TEXT,
  mr_number TEXT,
  system_area TEXT,
  mrb_included INTEGER NOT NULL DEFAULT 0,
  approval_code TEXT,
  date_submitted TEXT,
  transmittal_ref TEXT
);
CREATE TABLE register_sop (
  document_id INTEGER PRIMARY KEY REFERENCES documents(id),
  section_code TEXT,
  owner_user_id INTEGER REFERENCES users(id),
  issue_date TEXT,
  approving_order TEXT,
  review_interval_months INTEGER NOT NULL DEFAULT 12 CHECK (review_interval_months BETWEEN 1 AND 24),
  next_review_due TEXT,
  linked_forms TEXT
);

-- ---------- DDM — DOCUMENT DISTRIBUTION MATRIX (workflow routing source) ----------
CREATE TABLE ddm_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  discipline_code TEXT NOT NULL DEFAULT '*',
  doc_type_code TEXT NOT NULL DEFAULT '*',
  class_code TEXT NOT NULL DEFAULT '*',
  originator_code TEXT NOT NULL DEFAULT '*',
  reviewer1_user_id INTEGER REFERENCES users(id),
  reviewer2_user_id INTEGER REFERENCES users(id),
  endorser_user_id INTEGER REFERENCES users(id),
  approver_user_id INTEGER REFERENCES users(id),
  approver_role_code TEXT NOT NULL DEFAULT 'APPROVER',
  copy_to TEXT NOT NULL DEFAULT '[]',     -- JSON user ids
  business_process_level TEXT,
  purpose_id INTEGER REFERENCES purposes(id),
  is_active INTEGER NOT NULL DEFAULT 1,
  remarks TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_ddm_match ON ddm_rules(discipline_code, doc_type_code, class_code, originator_code);

-- ---------- CORRECTION / CHANGE LOG (immutable) ----------
CREATE TABLE correction_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  correction_number TEXT NOT NULL UNIQUE,
  corrected_at TEXT NOT NULL DEFAULT (datetime('now')),
  user_id INTEGER NOT NULL REFERENCES users(id),
  register TEXT NOT NULL,
  record_id INTEGER NOT NULL,
  field_name TEXT NOT NULL,
  previous_value TEXT,
  corrected_value TEXT,
  reason TEXT NOT NULL,
  authorization_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_corrlog_record ON correction_log(register, record_id);
CREATE TRIGGER correction_log_no_update BEFORE UPDATE ON correction_log
BEGIN SELECT RAISE(ABORT, 'correction_log is append-only'); END;
CREATE TRIGGER correction_log_no_delete BEFORE DELETE ON correction_log
BEGIN SELECT RAISE(ABORT, 'correction_log is append-only'); END;

-- ---------- CORRESPONDENCE SLA FIELDS ----------
ALTER TABLE correspondence ADD COLUMN entry_number INTEGER;
ALTER TABLE correspondence ADD COLUMN counterparty_code TEXT;
ALTER TABLE correspondence ADD COLUMN counterparty_ref TEXT;
ALTER TABLE correspondence ADD COLUMN letter_date TEXT;
ALTER TABLE correspondence ADD COLUMN language_code TEXT NOT NULL DEFAULT 'EN';
ALTER TABLE correspondence ADD COLUMN responsible_dept_code TEXT;
ALTER TABLE correspondence ADD COLUMN focal_point_user_id INTEGER REFERENCES users(id);
ALTER TABLE correspondence ADD COLUMN reply_days_allowed INTEGER;
ALTER TABLE correspondence ADD COLUMN reply_due_date TEXT;
ALTER TABLE correspondence ADD COLUMN reply_reference TEXT;
ALTER TABLE correspondence ADD COLUMN days_overdue INTEGER NOT NULL DEFAULT 0;
ALTER TABLE correspondence ADD COLUMN contractual_notice INTEGER;
ALTER TABLE correspondence ADD COLUMN clause TEXT;
ALTER TABLE correspondence ADD COLUMN archive_box TEXT;
ALTER TABLE correspondence ADD COLUMN urgency TEXT NOT NULL DEFAULT 'normal';
CREATE UNIQUE INDEX idx_corr_entry ON correspondence(entry_number);
CREATE INDEX idx_corr_due ON correspondence(reply_due_date);
UPDATE correspondence SET entry_number = (SELECT COUNT(*) FROM correspondence c2 WHERE c2.id <= correspondence.id);

-- ---------- PERMISSIONS ----------
INSERT INTO permissions (code, description, domain) VALUES
  ('number.allocate','Allocate controlled document numbers','Numbering'),
  ('codes.manage','Manage controlled code registry','Codes'),
  ('ddm.manage','Manage DDM workflow routing rules','Workflow'),
  ('correction.record','Record controlled corrections','Governance')
  ON CONFLICT(code) DO NOTHING;
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
  SELECT (SELECT id FROM roles WHERE code='DCC'), id FROM permissions WHERE code IN ('number.allocate','correction.record');
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
  SELECT (SELECT id FROM roles WHERE code='ADMIN'), id FROM permissions WHERE code IN ('number.allocate','codes.manage','ddm.manage','correction.record');

-- ---------- CONTROLLED CODE CATALOGUE ----------
INSERT INTO controlled_codes (code_set, code, description, sort_order) VALUES
  ('DEPARTMENT','PO','Project Organization',1),('DEPARTMENT','OP','Operations',2),
  ('DEPARTMENT','EN','Engineering',3),('DEPARTMENT','DW','Drilling & Wells',4),
  ('DEPARTMENT','SU','Subsurface',5),('DEPARTMENT','CP','Contracts & Procurement',6),
  ('DEPARTMENT','PJ','Projects',7),('DEPARTMENT','QA','Quality Assurance',8),
  ('DEPARTMENT','HS','Health, Safety & Environment',9),('DEPARTMENT','SC','Supply Chain',10),
  ('SECTION','GN','General',1),('SECTION','DC','Document Control',2),('SECTION','TR','Training',3),
  ('SECTION','AD','Administration',4),('SECTION','MC','Materials & Contracts',5),
  ('SECTION','PR','Procurement',6),('SECTION','CON','Contracts',7),('SECTION','PRC','Process',8),
  ('SECTION','PLA','Planning',9),('SECTION','CST','Cost Control',10),
  ('DISCIPLINE','ADM','Administration',1),('DISCIPLINE','ARC','Architecture',2),
  ('DISCIPLINE','CIV','Civil / Structural',3),('DISCIPLINE','CON','Construction',4),
  ('DISCIPLINE','CP','Cathodic Protection',5),('DISCIPLINE','CST','Cost',6),
  ('DISCIPLINE','DCA','Document Control & Archive',7),('DISCIPLINE','DRL','Drilling',8),
  ('DISCIPLINE','ELE','Electrical',9),('DISCIPLINE','ENV','Environment',10),
  ('DISCIPLINE','GEN','General',11),('DISCIPLINE','GEO','Geology',12),
  ('DISCIPLINE','HSE','Health & Safety',13),('DISCIPLINE','INSTR','Instrumentation',14),
  ('DISCIPLINE','MEC','Mechanical',15),('DISCIPLINE','PIP','Piping',16),
  ('DISCIPLINE','PROC','Process',17),('DISCIPLINE','QA','Quality Assurance',18),
  ('DISCIPLINE','SUR','Survey',19),('DISCIPLINE','TEL','Telecommunications',20),
  ('DOCTYPE','ACT','Activity Report',1),('DOCTYPE','AGR','Agreement',2),
  ('DOCTYPE','AMD','Amendment',3),('DOCTYPE','AUD','Audit Document',4),
  ('DOCTYPE','BID','Bid Document',5),('DOCTYPE','BOD','Basis of Design',6),
  ('DOCTYPE','BOM','Bill of Materials',7),('DOCTYPE','CAL','Calculation',8),
  ('DOCTYPE','CAT','Catalogue',9),('DOCTYPE','CBE','Cause & Effect',10),
  ('DOCTYPE','CERT','Certificate',11),('DOCTYPE','CHK','Checklist',12),
  ('DOCTYPE','COR','Correspondence',13),('DOCTYPE','DWG','Drawing',14),
  ('DOCTYPE','ECN','Engineering Change Notice',15),('DOCTYPE','FORM','Form',16),
  ('DOCTYPE','HSE','HSE Document',17),('DOCTYPE','INS','Instruction',18),
  ('DOCTYPE','LTR','Letter',19),('DOCTYPE','MAN','Manual',20),
  ('DOCTYPE','MEM','Memorandum',21),('DOCTYPE','MIN','Minutes of Meeting',22),
  ('DOCTYPE','NOTE','Note',23),('DOCTYPE','PHIL','Philosophy',24),
  ('DOCTYPE','PLAN','Plan',25),('DOCTYPE','PROC','Procedure',26),
  ('DOCTYPE','PRG','Programme',27),('DOCTYPE','QA','Quality Assurance Document',28),
  ('DOCTYPE','QCP','Quality Control Procedure',29),('DOCTYPE','REP','Report',30),
  ('DOCTYPE','RPT','Technical Report',31),('DOCTYPE','SCH','Schedule',32),
  ('DOCTYPE','SOP','Standard Operating Procedure',33),('DOCTYPE','SPEC','Specification',34),
  ('DOCTYPE','STD','Standard',35),('DOCTYPE','TBE','Tender / Bid Evaluation',36),
  ('DOCTYPE','VDR','Vendor Document Requirement',37),
  ('ORIGINATOR','BOC','Back-to-Back Operator Company',1),
  ('ORIGINATOR','MOO','Ministry of Oil',2),('ORIGINATOR','UEG','UEG Partner Company',3),
  ('ORIGINATOR','UEF','UEF (Company)',4),('ORIGINATOR','CONTRACTOR','Contractor',5),
  ('ORIGINATOR','VENDOR','Vendor',6),('ORIGINATOR','CONSULTANT','Consultant',7),
  ('CLASS','1','Class 1 — Safety Critical',1),('CLASS','2','Class 2 — Major Capital',2),
  ('CLASS','3','Class 3 — Standard',3),('CLASS','NA','Not Classified',4),
  ('LANGUAGE','EN','English',1),('LANGUAGE','AR','Arabic',2);

-- ---------- CORRESPONDENCE SLA RULES (configurable, not hard-coded) ----------
INSERT INTO sla_rules (code, entity_type, priority, days, escalate_after_days) VALUES
  ('SLA-CORR-BOC','CORRESPONDENCE_SLA','BOC',7,2),
  ('SLA-CORR-MOO','CORRESPONDENCE_SLA','MOO',7,2),
  ('SLA-CORR-UEG','CORRESPONDENCE_SLA','UEG',7,2),
  ('SLA-CORR-CONTRACTOR','CORRESPONDENCE_SLA','CONTRACTOR',10,3),
  ('SLA-CORR-VENDOR','CORRESPONDENCE_SLA','VENDOR',10,3),
  ('SLA-CORR-URGENT','CORRESPONDENCE_SLA','URGENT',3,1);

-- ---------- DDM SAMPLE ROUTING RULES ----------
INSERT INTO ddm_rules (discipline_code, doc_type_code, class_code, originator_code, business_process_level, remarks) VALUES
  ('PIP','DWG','*','CONTRACTOR','Project Execution','Piping drawings — contractor submissions'),
  ('MEC','DWG','*','CONTRACTOR','Project Execution','Mechanical drawings'),
  ('ELE','*','*','CONTRACTOR','Project Execution','Electrical documents'),
  ('*','SOP','*','UEF','Corporate Governance','Corporate SOPs'),
  ('*','PROC','*','UEF','Corporate Governance','Corporate procedures'),
  ('*','*','*','BOC','Contractual','BOC correspondence-linked documents');
