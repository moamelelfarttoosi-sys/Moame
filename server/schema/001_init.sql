-- ============================================================
-- IDMS — Enterprise Integrated Document Management System
-- Migration 001: initial schema (SQLite)
-- ============================================================

PRAGMA foreign_keys = ON;

-- ---------- SECURITY ----------
CREATE TABLE roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  is_system INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  domain TEXT NOT NULL
);

CREATE TABLE role_permissions (
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  full_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role_id INTEGER NOT NULL REFERENCES roles(id),
  department_id INTEGER REFERENCES departments(id),
  organization_id INTEGER REFERENCES organizations(id),
  phone TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  mfa_secret TEXT,                       -- TOTP secret; MFA required when set
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,                   -- jti
  user_id INTEGER NOT NULL REFERENCES users(id),
  ip TEXT,
  user_agent TEXT,
  issued_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  revoked_at TEXT
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

CREATE TABLE user_projects (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, project_id)
);

-- ---------- ORGANISATION MASTER DATA ----------
CREATE TABLE organizations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  org_type TEXT NOT NULL CHECK (org_type IN ('Operator','Contractor','Subcontractor','Vendor','Consultant','Partner','Internal')),
  contact_name TEXT,
  contact_email TEXT,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  manager_user_id INTEGER REFERENCES users(id),
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  customer_org_id INTEGER REFERENCES organizations(id),
  lifecycle_stage TEXT NOT NULL DEFAULT 'Execution'
    CHECK (lifecycle_stage IN ('Feasibility','FEED','Detailed Design','Execution','Commissioning','Operations','Closed')),
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','On Hold','Closed')),
  archive_trigger_stage TEXT NOT NULL DEFAULT 'Closed',
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE contracts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  project_id INTEGER NOT NULL REFERENCES projects(id),
  customer_org_id INTEGER REFERENCES organizations(id),
  contractor_org_id INTEGER REFERENCES organizations(id),
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Draft','Active','Suspended','Completed','Terminated')),
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE disciplines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE document_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  requires_review INTEGER NOT NULL DEFAULT 1,
  requires_endorsement INTEGER NOT NULL DEFAULT 1,
  requires_approval INTEGER NOT NULL DEFAULT 1,
  numbering_rule_id INTEGER,             -- FK added after numbering_rules exists
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE purposes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE retention_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  retention_years INTEGER NOT NULL,
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 1
);

-- ---------- STATUS ENGINE ----------
CREATE TABLE statuses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'both' CHECK (scope IN ('internal','external','both')),
  phase TEXT,                            -- Registration/Review/Endorsement/Approval/Issuance/Closure/Archive
  color TEXT NOT NULL DEFAULT '#64748b',
  is_initial INTEGER NOT NULL DEFAULT 0,
  is_terminal INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE status_transitions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_status_id INTEGER REFERENCES statuses(id),
  to_status_id INTEGER NOT NULL REFERENCES statuses(id),
  allowed_roles TEXT NOT NULL DEFAULT '[]',   -- JSON array of role codes; [] = any authenticated permitted role
  reason_required INTEGER NOT NULL DEFAULT 0,
  UNIQUE (from_status_id, to_status_id)
);

-- ---------- NUMBERING ENGINE ----------
CREATE TABLE numbering_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  entity_type TEXT NOT NULL DEFAULT 'DOCUMENT',   -- DOCUMENT | TRANSMITTAL | CORRESPONDENCE | MEMO | RESOLUTION
  pattern TEXT NOT NULL,                 -- JSON array of components
  sequence_length INTEGER NOT NULL DEFAULT 4,
  sequence_scope TEXT NOT NULL DEFAULT 'RULE_YEAR_PROJECT', -- RULE | RULE_YEAR | RULE_YEAR_PROJECT | RULE_PROJECT
  reset_yearly INTEGER NOT NULL DEFAULT 0,
  revision_style TEXT NOT NULL DEFAULT 'numeric0',          -- numeric0 (0,1,2..) | alpha (A,B..)
  separator TEXT NOT NULL DEFAULT '-',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE numbering_sequences (
  rule_id INTEGER NOT NULL REFERENCES numbering_rules(id),
  scope_key TEXT NOT NULL,
  last_value INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (rule_id, scope_key)
);

CREATE TABLE numbering_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_id INTEGER NOT NULL REFERENCES numbering_rules(id),
  generated_number TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id INTEGER,
  generated_by INTEGER REFERENCES users(id),
  generated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_numhist_number ON numbering_history(generated_number);

-- ---------- WORKFLOW ENGINE ----------
CREATE TABLE workflows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  entity_type TEXT NOT NULL DEFAULT 'DOCUMENT',
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE workflow_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_id INTEGER NOT NULL REFERENCES workflows(id),
  version_no INTEGER NOT NULL DEFAULT 1,
  definition TEXT NOT NULL,              -- JSON steps[]
  is_active INTEGER NOT NULL DEFAULT 1,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (workflow_id, version_no)
);

CREATE TABLE workflow_instances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_version_id INTEGER NOT NULL REFERENCES workflow_versions(id),
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  current_step_no INTEGER,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','rejected','cancelled')),
  outcome TEXT,
  started_by INTEGER REFERENCES users(id),
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);
CREATE INDEX idx_wfinst_entity ON workflow_instances(entity_type, entity_id);

CREATE TABLE workflow_instance_steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  instance_id INTEGER NOT NULL REFERENCES workflow_instances(id),
  seq_no INTEGER NOT NULL,
  step_key TEXT NOT NULL,
  name TEXT NOT NULL,
  step_type TEXT NOT NULL CHECK (step_type IN ('task','review','endorsement','approval','notification')),
  assignee_type TEXT NOT NULL DEFAULT 'role' CHECK (assignee_type IN ('user','role')),
  assignee_value TEXT NOT NULL,          -- username or role code
  parallel_group TEXT,                   -- same group runs in parallel; step completes when all done
  deadline_hours INTEGER,
  condition_json TEXT,                   -- optional routing condition {field,op,value}
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','completed','rejected','skipped')),
  acted_by INTEGER REFERENCES users(id),
  acted_at TEXT,
  comments TEXT,
  deadline_at TEXT
);
CREATE INDEX idx_wfsteps_inst ON workflow_instance_steps(instance_id);

-- ---------- FILES / STORAGE ----------
CREATE TABLE files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sha256 TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  storage_path TEXT NOT NULL,            -- relative path under storage/files
  uploaded_by INTEGER REFERENCES users(id),
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_files_sha ON files(sha256);

-- ---------- DOCUMENTS ----------
CREATE TABLE documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  doc_number TEXT NOT NULL UNIQUE COLLATE NOCASE,
  title TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'internal' CHECK (direction IN ('incoming','outgoing','internal')),

  doc_type_id INTEGER NOT NULL REFERENCES document_types(id),
  category_id INTEGER REFERENCES categories(id),
  project_id INTEGER NOT NULL REFERENCES projects(id),
  contract_id INTEGER REFERENCES contracts(id),
  discipline_id INTEGER REFERENCES disciplines(id),
  department_id INTEGER REFERENCES departments(id),
  originator_org_id INTEGER REFERENCES organizations(id),      -- organization of origin
  customer_org_id INTEGER REFERENCES organizations(id),
  contractor_org_id INTEGER REFERENCES organizations(id),

  location TEXT,
  area TEXT,
  system TEXT,
  package TEXT,
  work_package TEXT,
  phase TEXT,

  purpose_id INTEGER REFERENCES purposes(id),
  internal_status_id INTEGER NOT NULL REFERENCES statuses(id),
  external_status_id INTEGER REFERENCES statuses(id),

  current_revision_id INTEGER,           -- FK revisions(id); added post-create via ALTER not needed (nullable)

  confidentiality TEXT NOT NULL DEFAULT 'Internal'
    CHECK (confidentiality IN ('Public','Internal','Confidential','Strictly Confidential')),
  security_classification TEXT,

  keywords TEXT,
  remarks TEXT,

  retention_rule_id INTEGER REFERENCES retention_rules(id),
  archive_status TEXT NOT NULL DEFAULT 'none' CHECK (archive_status IN ('none','eligible','archived','disposed')),

  parent_document_id INTEGER REFERENCES documents(id),

  endorser_user_id INTEGER REFERENCES users(id),
  dcc_user_id INTEGER REFERENCES users(id),
  reviewer_user_id INTEGER REFERENCES users(id),
  approver_user_id INTEGER REFERENCES users(id),

  transmittal_ref TEXT,
  correspondence_ref TEXT,

  document_date TEXT,
  receipt_date TEXT,
  accept_date TEXT,
  due_date TEXT,
  review_due_date TEXT,

  created_by INTEGER NOT NULL REFERENCES users(id),
  registered_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);
CREATE INDEX idx_docs_number ON documents(doc_number);
CREATE INDEX idx_docs_title ON documents(title);
CREATE INDEX idx_docs_project ON documents(project_id);
CREATE INDEX idx_docs_contract ON documents(contract_id);
CREATE INDEX idx_docs_status ON documents(internal_status_id);
CREATE INDEX idx_docs_extstatus ON documents(external_status_id);
CREATE INDEX idx_docs_discipline ON documents(discipline_id);
CREATE INDEX idx_docs_org ON documents(originator_org_id);
CREATE INDEX idx_docs_contractor ON documents(contractor_org_id);
CREATE INDEX idx_docs_receipt ON documents(receipt_date);
CREATE INDEX idx_docs_direction ON documents(direction);

-- ---------- REVISIONS & VERSIONS ----------
CREATE TABLE document_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL REFERENCES documents(id),
  revision_code TEXT NOT NULL,
  revision_date TEXT,
  revision_reason TEXT,
  file_id INTEGER REFERENCES files(id),          -- pinned controlled file once approved
  author_user_id INTEGER REFERENCES users(id),
  reviewer_user_id INTEGER REFERENCES users(id),
  endorser_user_id INTEGER REFERENCES users(id),
  approver_user_id INTEGER REFERENCES users(id),
  approval_date TEXT,
  purpose_id INTEGER REFERENCES purposes(id),
  status_id INTEGER NOT NULL REFERENCES statuses(id),
  is_current INTEGER NOT NULL DEFAULT 0,
  superseded_by_revision_id INTEGER REFERENCES document_revisions(id),
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (document_id, revision_code)
);
CREATE INDEX idx_revs_doc ON document_revisions(document_id);

CREATE TABLE document_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  revision_id INTEGER NOT NULL REFERENCES document_revisions(id),
  version_no INTEGER NOT NULL,
  file_id INTEGER NOT NULL REFERENCES files(id),
  comment TEXT,
  uploaded_by INTEGER NOT NULL REFERENCES users(id),
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (revision_id, version_no)
);
CREATE INDEX idx_versions_rev ON document_versions(revision_id);

CREATE TABLE attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,             -- DOCUMENT|TRANSMITTAL|CORRESPONDENCE|MEMO|RESOLUTION|REVIEW|RESOLUTION_EVIDENCE
  entity_id INTEGER NOT NULL,
  file_id INTEGER NOT NULL REFERENCES files(id),
  uploaded_by INTEGER NOT NULL REFERENCES users(id),
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_attach_entity ON attachments(entity_type, entity_id);

CREATE TABLE related_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  related_type TEXT NOT NULL,            -- DOCUMENT|TRANSMITTAL|CORRESPONDENCE|MEMO|RESOLUTION
  related_id INTEGER NOT NULL,
  link_note TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (entity_type, entity_id, related_type, related_id)
);

-- ---------- REVIEWS / ENDORSEMENTS ----------
CREATE TABLE reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL REFERENCES documents(id),
  revision_id INTEGER NOT NULL REFERENCES document_revisions(id),
  reviewer_user_id INTEGER NOT NULL REFERENCES users(id),
  assigned_by INTEGER NOT NULL REFERENCES users(id),
  assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
  review_due_date TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','in_progress','approved','rejected','changes_requested','returned_to_dcc','completed')),
  outcome_comments TEXT,
  completed_at TEXT,
  wf_step_id INTEGER REFERENCES workflow_instance_steps(id)
);
CREATE INDEX idx_reviews_doc ON reviews(document_id);
CREATE INDEX idx_reviews_reviewer ON reviews(reviewer_user_id, status);

CREATE TABLE review_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  review_id INTEGER NOT NULL REFERENCES reviews(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  comment TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_rcmt_review ON review_comments(review_id);

CREATE TABLE endorsements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL REFERENCES documents(id),
  revision_id INTEGER NOT NULL REFERENCES document_revisions(id),
  endorser_user_id INTEGER NOT NULL REFERENCES users(id),
  assigned_by INTEGER NOT NULL REFERENCES users(id),
  assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','endorsed','rejected','returned')),
  comments TEXT,
  acted_at TEXT,
  wf_step_id INTEGER REFERENCES workflow_instance_steps(id)
);
CREATE INDEX idx_endorse_doc ON endorsements(document_id);

-- ---------- APPROVAL ENGINE ----------
CREATE TABLE approvals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL REFERENCES documents(id),
  revision_id INTEGER NOT NULL REFERENCES document_revisions(id),
  mode TEXT NOT NULL DEFAULT 'sequential' CHECK (mode IN ('sequential','parallel')),
  approval_type TEXT NOT NULL DEFAULT 'technical' CHECK (approval_type IN ('general','contract','technical')),
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','approved','rejected')),
  initiated_by INTEGER NOT NULL REFERENCES users(id),
  initiated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deadline_at TEXT,
  completed_at TEXT,
  wf_step_id INTEGER REFERENCES workflow_instance_steps(id)
);
CREATE INDEX idx_appr_doc ON approvals(document_id);
CREATE INDEX idx_appr_rev ON approvals(revision_id);

CREATE TABLE approval_steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  approval_id INTEGER NOT NULL REFERENCES approvals(id),
  seq_no INTEGER NOT NULL,
  approver_user_id INTEGER REFERENCES users(id),
  approver_role_code TEXT,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','pending','approved','rejected','skipped')),
  comments TEXT,
  deadline_at TEXT,
  acted_at TEXT
);
CREATE INDEX idx_astep_appr ON approval_steps(approval_id);
CREATE UNIQUE INDEX idx_appr_rev_control ON approvals(revision_id) WHERE status = 'approved';

-- ---------- TRANSMITTALS ----------
CREATE TABLE transmittals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trn_number TEXT NOT NULL UNIQUE COLLATE NOCASE,
  direction TEXT NOT NULL DEFAULT 'outgoing' CHECK (direction IN ('incoming','outgoing')),
  subject TEXT NOT NULL,
  sender_user_id INTEGER NOT NULL REFERENCES users(id),
  sender_org_id INTEGER REFERENCES organizations(id),
  recipient_org_id INTEGER REFERENCES organizations(id),
  recipient_contact TEXT,
  recipient_user_id INTEGER REFERENCES users(id),
  purpose_id INTEGER REFERENCES purposes(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','issued','acknowledged','responded','closed','cancelled')),
  trn_date TEXT NOT NULL DEFAULT (date('now')),
  response_required INTEGER NOT NULL DEFAULT 0,
  response_due_date TEXT,
  acknowledged_at TEXT,
  responded_at TEXT,
  closed_at TEXT,
  comments TEXT,
  related_correspondence_id INTEGER REFERENCES correspondence(id),
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_trn_number ON transmittals(trn_number);
CREATE INDEX idx_trn_status ON transmittals(status);

CREATE TABLE transmittal_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transmittal_id INTEGER NOT NULL REFERENCES transmittals(id) ON DELETE CASCADE,
  document_id INTEGER NOT NULL REFERENCES documents(id),
  revision_id INTEGER NOT NULL REFERENCES document_revisions(id),
  item_action TEXT NOT NULL DEFAULT 'issue' CHECK (item_action IN ('issue','return','info','resubmit')),
  remarks TEXT,
  UNIQUE (transmittal_id, document_id)
);

CREATE TABLE distributions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transmittal_id INTEGER NOT NULL REFERENCES transmittals(id),
  recipient_user_id INTEGER REFERENCES users(id),
  recipient_org_id INTEGER REFERENCES organizations(id),
  copy_type TEXT NOT NULL DEFAULT 'Electronic' CHECK (copy_type IN ('Electronic','Paper')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','acknowledged')),
  acknowledged_at TEXT,
  acknowledged_by INTEGER REFERENCES users(id),
  sent_at TEXT
);
CREATE INDEX idx_dist_trn ON distributions(transmittal_id);

-- ---------- CORRESPONDENCE ----------
CREATE TABLE correspondence (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  corr_number TEXT NOT NULL UNIQUE COLLATE NOCASE,
  direction TEXT NOT NULL CHECK (direction IN ('incoming','outgoing')),
  subject TEXT NOT NULL,
  corr_type TEXT NOT NULL DEFAULT 'Letter' CHECK (corr_type IN ('Letter','Email','Fax','Notice','Instruction')),
  sender_org_id INTEGER REFERENCES organizations(id),
  sender_name TEXT,
  recipient_org_id INTEGER REFERENCES organizations(id),
  recipient_name TEXT,
  corr_date TEXT NOT NULL DEFAULT (date('now')),
  received_date TEXT,
  response_required INTEGER NOT NULL DEFAULT 0,
  response_due_date TEXT,
  assigned_user_id INTEGER REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','in_progress','awaiting_response','responded','closed')),
  body TEXT,
  linked_transmittal_id INTEGER REFERENCES transmittals(id),
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  closed_at TEXT
);
CREATE INDEX idx_corr_number ON correspondence(corr_number);
CREATE INDEX idx_corr_status ON correspondence(status);

CREATE TABLE correspondence_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  correspondence_id INTEGER NOT NULL REFERENCES correspondence(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('DOCUMENT','TRANSMITTAL','CORRESPONDENCE')),
  entity_id INTEGER NOT NULL,
  UNIQUE (correspondence_id, entity_type, entity_id)
);

-- ---------- OFFICE MEMO ----------
CREATE TABLE memos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  memo_number TEXT NOT NULL UNIQUE COLLATE NOCASE,
  subject TEXT NOT NULL,
  from_user_id INTEGER NOT NULL REFERENCES users(id),
  to_users TEXT NOT NULL DEFAULT '[]',   -- JSON array of user ids
  cc_users TEXT NOT NULL DEFAULT '[]',
  department_id INTEGER REFERENCES departments(id),
  memo_date TEXT NOT NULL DEFAULT (date('now')),
  priority TEXT NOT NULL DEFAULT 'Normal' CHECK (priority IN ('Low','Normal','High','Urgent')),
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','routing','approved','issued','cancelled')),
  distribution_status TEXT NOT NULL DEFAULT 'pending' CHECK (distribution_status IN ('pending','distributed')),
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  issued_at TEXT
);

CREATE TABLE memo_recipients (
  memo_id INTEGER NOT NULL REFERENCES memos(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL DEFAULT 'to' CHECK (kind IN ('to','cc')),
  read_at TEXT,
  PRIMARY KEY (memo_id, user_id, kind)
);

-- ---------- RESOLUTIONS ----------
CREATE TABLE resolutions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  resolution_number TEXT NOT NULL UNIQUE COLLATE NOCASE,
  resolution_date TEXT NOT NULL DEFAULT (date('now')),
  meeting_ref TEXT,
  subject TEXT NOT NULL,
  decision TEXT NOT NULL,
  responsible_user_id INTEGER NOT NULL REFERENCES users(id),
  department_id INTEGER REFERENCES departments(id),
  action_required TEXT,
  due_date TEXT,
  priority TEXT NOT NULL DEFAULT 'Normal' CHECK (priority IN ('Low','Normal','High','Urgent')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','completed','closed','escalated')),
  closure_date TEXT,
  evidence_file_id INTEGER REFERENCES files(id),
  closure_comments TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_res_status ON resolutions(status);
CREATE INDEX idx_res_due ON resolutions(due_date);

CREATE TABLE resolution_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  resolution_id INTEGER NOT NULL REFERENCES resolutions(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  comment TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------- NOTIFICATIONS ----------
CREATE TABLE notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  event_code TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'inapp' CHECK (channel IN ('inapp','email','system')),
  title TEXT NOT NULL,
  body TEXT,
  entity_type TEXT,
  entity_id INTEGER,
  read_at TEXT,
  delivered_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_notif_user ON notifications(user_id, read_at);

CREATE TABLE notification_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_code TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  inapp_enabled INTEGER NOT NULL DEFAULT 1,
  email_enabled INTEGER NOT NULL DEFAULT 0,
  target_mode TEXT NOT NULL DEFAULT 'actor' CHECK (target_mode IN ('actor','role','assignee','custom')),
  target_role_code TEXT,
  is_active INTEGER NOT NULL DEFAULT 1
);

-- ---------- AUDIT (append-only) ----------
CREATE TABLE audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL DEFAULT (datetime('now')),
  user_id INTEGER REFERENCES users(id),
  username TEXT,
  action TEXT NOT NULL,                  -- LOGIN|LOGOUT|CREATE|EDIT|UPLOAD|DOWNLOAD|VIEW|...
  entity_type TEXT NOT NULL,
  entity_id INTEGER,
  prev_value TEXT,                       -- JSON
  new_value TEXT,                        -- JSON
  ip TEXT,
  session_id TEXT,
  details TEXT
);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_at ON audit_logs(at);

CREATE TRIGGER audit_logs_no_update BEFORE UPDATE ON audit_logs
BEGIN SELECT RAISE(ABORT, 'audit_logs is append-only'); END;
CREATE TRIGGER audit_logs_no_delete BEFORE DELETE ON audit_logs
BEGIN SELECT RAISE(ABORT, 'audit_logs is append-only'); END;

-- ---------- ARCHIVE ----------
CREATE TABLE archive_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL DEFAULT 'DOCUMENT',
  entity_id INTEGER NOT NULL,
  archived_at TEXT NOT NULL DEFAULT (datetime('now')),
  archived_by INTEGER NOT NULL REFERENCES users(id),
  reason TEXT NOT NULL,
  retention_rule_id INTEGER REFERENCES retention_rules(id),
  disposition_due TEXT,
  dispositioned_at TEXT,
  dispositioned_by INTEGER REFERENCES users(id)
);
CREATE UNIQUE INDEX idx_archive_entity ON archive_records(entity_type, entity_id, archived_at);

-- ---------- SAVED SEARCHES ----------
CREATE TABLE saved_searches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  definition TEXT NOT NULL,              -- JSON {filters,logic,sort,columns}
  is_shared_template INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, name)
);

-- ---------- SLA RULES & CONFIG ----------
CREATE TABLE sla_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  entity_type TEXT NOT NULL,             -- REVIEW|ENDORSEMENT|APPROVAL|TRANSMITTAL_RESPONSE|RESOLUTION
  doc_type_id INTEGER REFERENCES document_types(id),
  priority TEXT,
  days INTEGER NOT NULL,
  escalate_after_days INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE configurations (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_by INTEGER REFERENCES users(id),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- (schema_migrations table is managed by server/db.js)
