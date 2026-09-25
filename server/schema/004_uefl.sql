-- ============================================================
-- IDMS — Migration 004: UEFL Document Control Database
-- Comprehensive UEFL codes, statuses, correspondence rules,
-- approval stamps, document classification, and defaults
-- ============================================================

-- ---------- DEPARTMENT CODES (UEFL Section 3) ----------
-- Update descriptions to match UEFL procedure, add missing codes
UPDATE controlled_codes SET description='President Office' WHERE code_set='DEPARTMENT' AND code='PO';
UPDATE controlled_codes SET description='Operations' WHERE code_set='DEPARTMENT' AND code='OP';
UPDATE controlled_codes SET description='Engineering and Development' WHERE code_set='DEPARTMENT' AND code='EN';
UPDATE controlled_codes SET description='Drilling and Wells' WHERE code_set='DEPARTMENT' AND code='DW';
UPDATE controlled_codes SET description='Health, Safety and Environment' WHERE code_set='DEPARTMENT' AND code='HS';
UPDATE controlled_codes SET description='Contracts and Procurement' WHERE code_set='DEPARTMENT' AND code='CP';
UPDATE controlled_codes SET description='Projects and Construction' WHERE code_set='DEPARTMENT' AND code='PJ';
UPDATE controlled_codes SET description='Quality Assurance and Control' WHERE code_set='DEPARTMENT' AND code='QA';
UPDATE controlled_codes SET description='Subsurface, Geoscience and Reservoir' WHERE code_set='DEPARTMENT' AND code='SU';
UPDATE controlled_codes SET description='Supply Chain' WHERE code_set='DEPARTMENT' AND code='SC';

INSERT OR IGNORE INTO controlled_codes (code_set, code, description, sort_order) VALUES
  ('DEPARTMENT','HR','Human Resources',11),
  ('DEPARTMENT','IT','Information Technology',12),
  ('DEPARTMENT','FI','Finance and Accounting',13),
  ('DEPARTMENT','LG','Legal and Compliance',14),
  ('DEPARTMENT','GR','Government and External Relations',15),
  ('DEPARTMENT','LC','Local Content and Community',16),
  ('DEPARTMENT','TR','Translation and Correspondence',17);

-- ---------- SECTION CODES (UEFL Section 4) ----------
UPDATE controlled_codes SET description='General or departmental level' WHERE code_set='SECTION' AND code='GN';
UPDATE controlled_codes SET description='Document Control and Archives' WHERE code_set='SECTION' AND code='DC';
UPDATE controlled_codes SET description='Administration and Business Support' WHERE code_set='SECTION' AND code='AD';
UPDATE controlled_codes SET description='Contracts' WHERE code_set='SECTION' AND code='CON';
UPDATE controlled_codes SET description='Procurement' WHERE code_set='SECTION' AND code='PRC';
UPDATE controlled_codes SET description='Planning and Project Controls' WHERE code_set='SECTION' AND code='PLA';
UPDATE controlled_codes SET description='Cost Control and Estimating' WHERE code_set='SECTION' AND code='CST';
UPDATE controlled_codes SET description='Translation and Correspondence' WHERE code_set='SECTION' AND code='TR';

INSERT OR IGNORE INTO controlled_codes (code_set, code, description, sort_order) VALUES
  ('SECTION','MC','Management Committee or JMC Secretariat',11),
  ('SECTION','PR','Public Relations and Protocol',12),
  ('SECTION','INS','Inspection',13),
  ('SECTION','TRN','Training and Competency',14);

-- ---------- DISCIPLINE CODES (UEFL Section 6) ----------
UPDATE controlled_codes SET description='Administration' WHERE code_set='DISCIPLINE' AND code='ADM';
UPDATE controlled_codes SET description='Architectural' WHERE code_set='DISCIPLINE' AND code='ARC';
UPDATE controlled_codes SET description='Civil / Structural' WHERE code_set='DISCIPLINE' AND code='CIV';
UPDATE controlled_codes SET description='Contracts' WHERE code_set='DISCIPLINE' AND code='CON';
UPDATE controlled_codes SET description='Cathodic Protection' WHERE code_set='DISCIPLINE' AND code='CP';
UPDATE controlled_codes SET description='Cost Control' WHERE code_set='DISCIPLINE' AND code='CST';
UPDATE controlled_codes SET description='Document Control and Archives' WHERE code_set='DISCIPLINE' AND code='DCA';
UPDATE controlled_codes SET description='Drilling, Wells and Completions' WHERE code_set='DISCIPLINE' AND code='DRL';
UPDATE controlled_codes SET description='Electrical' WHERE code_set='DISCIPLINE' AND code='ELE';
UPDATE controlled_codes SET description='Environmental and Social' WHERE code_set='DISCIPLINE' AND code='ENV';
UPDATE controlled_codes SET description='General' WHERE code_set='DISCIPLINE' AND code='GEN';
UPDATE controlled_codes SET description='Geology and Geophysics' WHERE code_set='DISCIPLINE' AND code='GEO';
UPDATE controlled_codes SET description='Health, Safety and Environment' WHERE code_set='DISCIPLINE' AND code='HSE';
UPDATE controlled_codes SET description='Mechanical' WHERE code_set='DISCIPLINE' AND code='MEC';
UPDATE controlled_codes SET description='Piping' WHERE code_set='DISCIPLINE' AND code='PIP';
UPDATE controlled_codes SET description='Quality Assurance and Quality Control' WHERE code_set='DISCIPLINE' AND code='QA';
UPDATE controlled_codes SET description='Survey and Geomatics' WHERE code_set='DISCIPLINE' AND code='SUR';
UPDATE controlled_codes SET description='Telecommunication' WHERE code_set='DISCIPLINE' AND code='TEL';
UPDATE controlled_codes SET description='Construction' WHERE code_set='DISCIPLINE' AND code='CON';

INSERT OR IGNORE INTO controlled_codes (code_set, code, description, sort_order) VALUES
  ('DISCIPLINE','COR','Corporate and Government Relations',21),
  ('DISCIPLINE','FIN','Finance and Accounting',22),
  ('DISCIPLINE','HVA','Heating, Ventilation and Air Conditioning',23),
  ('DISCIPLINE','INT','Instrumentation and Control',24),
  ('DISCIPLINE','ITC','Information Technology',25),
  ('DISCIPLINE','LEG','Legal and Compliance',26),
  ('DISCIPLINE','MTL','Materials, Corrosion and Integrity',27),
  ('DISCIPLINE','OPS','Operations and Maintenance',28),
  ('DISCIPLINE','PPL','Pipelines and Flowlines',29),
  ('DISCIPLINE','PRO','Process and Process Safety',30),
  ('DISCIPLINE','QC','Quality Assurance and Quality Control',31),
  ('DISCIPLINE','RES','Reservoir Engineering',32),
  ('DISCIPLINE','SAF','Safety',33),
  ('DISCIPLINE','SEC','Security',34),
  ('DISCIPLINE','STR','Structural',35);

-- ---------- DOCUMENT TYPE CODES (UEFL Section 7) ----------
-- Update existing descriptions to match UEFL procedure
UPDATE controlled_codes SET description='Action List' WHERE code_set='DOCTYPE' AND code='ACT';
UPDATE controlled_codes SET description='Agreement' WHERE code_set='DOCTYPE' AND code='AGR';
UPDATE controlled_codes SET description='Amendment' WHERE code_set='DOCTYPE' AND code='AMD';
UPDATE controlled_codes SET description='Audit Report' WHERE code_set='DOCTYPE' AND code='AUD';
UPDATE controlled_codes SET description='Bidding' WHERE code_set='DOCTYPE' AND code='BID';
UPDATE controlled_codes SET description='Basis of Design' WHERE code_set='DOCTYPE' AND code='BOD';
UPDATE controlled_codes SET description='Bill of Material' WHERE code_set='DOCTYPE' AND code='BOM';
UPDATE controlled_codes SET description='Calculation' WHERE code_set='DOCTYPE' AND code='CAL';
UPDATE controlled_codes SET description='Catalogue' WHERE code_set='DOCTYPE' AND code='CAT';
UPDATE controlled_codes SET description='Commercial Bid Evaluation' WHERE code_set='DOCTYPE' AND code='CBE';
UPDATE controlled_codes SET description='Cause and Effect Chart' WHERE code_set='DOCTYPE' AND code='CBE';
UPDATE controlled_codes SET description='Certificate' WHERE code_set='DOCTYPE' AND code='CERT';
UPDATE controlled_codes SET description='Checklist' WHERE code_set='DOCTYPE' AND code='CHK';
UPDATE controlled_codes SET description='Correspondence' WHERE code_set='DOCTYPE' AND code='COR';
UPDATE controlled_codes SET description='Drawing' WHERE code_set='DOCTYPE' AND code='DWG';
UPDATE controlled_codes SET description='Engineering Change Notice' WHERE code_set='DOCTYPE' AND code='ECN';
UPDATE controlled_codes SET description='Form' WHERE code_set='DOCTYPE' AND code='FORM';
UPDATE controlled_codes SET description='HSE Document' WHERE code_set='DOCTYPE' AND code='HSE';
UPDATE controlled_codes SET description='Instruction' WHERE code_set='DOCTYPE' AND code='INS';
UPDATE controlled_codes SET description='Letter' WHERE code_set='DOCTYPE' AND code='LTR';
UPDATE controlled_codes SET description='Manual' WHERE code_set='DOCTYPE' AND code='MAN';
UPDATE controlled_codes SET description='Memorandum' WHERE code_set='DOCTYPE' AND code='MEM';
UPDATE controlled_codes SET description='Minutes of Meeting' WHERE code_set='DOCTYPE' AND code='MIN';
UPDATE controlled_codes SET description='Note' WHERE code_set='DOCTYPE' AND code='NOTE';
UPDATE controlled_codes SET description='Philosophy' WHERE code_set='DOCTYPE' AND code='PHIL';
UPDATE controlled_codes SET description='Plan' WHERE code_set='DOCTYPE' AND code='PLAN';
UPDATE controlled_codes SET description='Procedure' WHERE code_set='DOCTYPE' AND code='PROC';
UPDATE controlled_codes SET description='Programme' WHERE code_set='DOCTYPE' AND code='PRG';
UPDATE controlled_codes SET description='Quality Assurance Document' WHERE code_set='DOCTYPE' AND code='QA';
UPDATE controlled_codes SET description='Quality Control Procedure' WHERE code_set='DOCTYPE' AND code='QCP';
UPDATE controlled_codes SET description='Report' WHERE code_set='DOCTYPE' AND code='REP';
UPDATE controlled_codes SET description='Technical Report' WHERE code_set='DOCTYPE' AND code='RPT';
UPDATE controlled_codes SET description='Schedule' WHERE code_set='DOCTYPE' AND code='SCH';
UPDATE controlled_codes SET description='Standard Operating Procedure' WHERE code_set='DOCTYPE' AND code='SOP';
UPDATE controlled_codes SET description='Specification' WHERE code_set='DOCTYPE' AND code='SPEC';
UPDATE controlled_codes SET description='Standard' WHERE code_set='DOCTYPE' AND code='STD';
UPDATE controlled_codes SET description='Tender / Bid Evaluation' WHERE code_set='DOCTYPE' AND code='TBE';
UPDATE controlled_codes SET description='Vendor Document Requirement' WHERE code_set='DOCTYPE' AND code='VDR';

-- Add ALL missing document type codes from UEFL Section 7
INSERT OR IGNORE INTO controlled_codes (code_set, code, description, sort_order) VALUES
  ('DOCTYPE','CFT','Certificate',38),
  ('DOCTYPE','CIR','Circular',39),
  ('DOCTYPE','CLR','Clarification',40),
  ('DOCTYPE','CLT','Close-Out',41),
  ('DOCTYPE','CO','Change Order',42),
  ('DOCTYPE','COM','Pre-Commissioning or Commissioning',43),
  ('DOCTYPE','COP','Change Order Proposal',44),
  ('DOCTYPE','COQ','Change Order Request',45),
  ('DOCTYPE','CRS','Change Resolution Sheet',46),
  ('DOCTYPE','CV','Curriculum Vitae',47),
  ('DOCTYPE','DB','Design Basis',48),
  ('DOCTYPE','DC','Document Control',49),
  ('DOCTYPE','DCR','Document Control Register',50),
  ('DOCTYPE','DDM','Document Distribution Matrix',51),
  ('DOCTYPE','DEL','Delegation of Authority',52),
  ('DOCTYPE','DPR','Daily Progress Report',53),
  ('DOCTYPE','DST','Data Sheet',54),
  ('DOCTYPE','EST','Estimate',55),
  ('DOCTYPE','EWN','Extra Work Notification',56),
  ('DOCTYPE','FAT','Factory Acceptance Test',57),
  ('DOCTYPE','FDT','Final Documentation',58),
  ('DOCTYPE','GL','Guideline',59),
  ('DOCTYPE','IDX','Index',60),
  ('DOCTYPE','ISO','Isometric',61),
  ('DOCTYPE','ITB','Invitation to Bid',62),
  ('DOCTYPE','ITF','Interface',63),
  ('DOCTYPE','ITP','Inspection and Test Plan',64),
  ('DOCTYPE','JD','Job Description',65),
  ('DOCTYPE','LAY','Layout',66),
  ('DOCTYPE','LLI','Long Lead Item',67),
  ('DOCTYPE','LST','List',68),
  ('DOCTYPE','MC','Mechanical Completion',69),
  ('DOCTYPE','MDR','Management Document Register',70),
  ('DOCTYPE','MGT','Management',71),
  ('DOCTYPE','MPR','Monthly Progress Report',72),
  ('DOCTYPE','MR','Material Requisition',73),
  ('DOCTYPE','MRB','Manufacturer Record Book',74),
  ('DOCTYPE','MSD','Method Statement',75),
  ('DOCTYPE','MTL','Material List',76),
  ('DOCTYPE','MTO','Material Take-Off',77),
  ('DOCTYPE','NCR','Non-Conformance Report',78),
  ('DOCTYPE','NOT','Notification',79),
  ('DOCTYPE','ORG','Organization Profile',80),
  ('DOCTYPE','PD','Procedure',81),
  ('DOCTYPE','PE','Procurement Enquiry',82),
  ('DOCTYPE','PFD','Process Flow Diagram',83),
  ('DOCTYPE','PID','Piping and Instrumentation Diagram',84),
  ('DOCTYPE','PIR','Preliminary Incident Report',85),
  ('DOCTYPE','PLO','Plot Plan',86),
  ('DOCTYPE','PMS','Progress Measurement System',87),
  ('DOCTYPE','PO','Purchase Order',88),
  ('DOCTYPE','POA','Power of Attorney',89),
  ('DOCTYPE','POL','Policy',90),
  ('DOCTYPE','PSR','Procurement Status Report',91),
  ('DOCTYPE','PUN','Punch List',92),
  ('DOCTYPE','QMS','Quality Management System Document',93),
  ('DOCTYPE','REF','Reference',94),
  ('DOCTYPE','REG','Register',95),
  ('DOCTYPE','REQ','Requisition',96),
  ('DOCTYPE','RFI','Request for Information',97),
  ('DOCTYPE','RFQ','Request for Quotation',98),
  ('DOCTYPE','RSK','Risk Register or Risk Assessment',99),
  ('DOCTYPE','SAT','Site Acceptance Test',100),
  ('DOCTYPE','SO','Service Order',101),
  ('DOCTYPE','SOW','Scope of Work',102),
  ('DOCTYPE','SPC','Specification',103),
  ('DOCTYPE','SPI','Spare Parts and Interchangeability Record',104),
  ('DOCTYPE','SPL','Commissioning Spare Parts List',105),
  ('DOCTYPE','STY','Study',106),
  ('DOCTYPE','TDR','Technical Document Register',107),
  ('DOCTYPE','TMP','Template',108),
  ('DOCTYPE','TOC','Table of Contents',109),
  ('DOCTYPE','TPI','Third Party Inspection',110),
  ('DOCTYPE','TQ','Technical Query',111),
  ('DOCTYPE','TRN','Training',112),
  ('DOCTYPE','UFD','Utility Flow Diagram',113),
  ('DOCTYPE','VDL','Vendor List',114),
  ('DOCTYPE','VED','Vendor',115),
  ('DOCTYPE','WI','Work Instruction',116),
  ('DOCTYPE','WLD','Welding',117),
  ('DOCTYPE','WO','Work Order',118),
  ('DOCTYPE','WPR','Weekly Progress Report',119),
  ('DOCTYPE','WPS','Welding Procedure Specification',120),
  ('DOCTYPE','XDT','Expediting',121);

-- ---------- ORIGINATOR / CORRESPONDENCE PARTY CODES (UEFL Section 14) ----------
UPDATE controlled_codes SET description='United Energy Fao Limited (UEF)' WHERE code_set='ORIGINATOR' AND code='UEF';
UPDATE controlled_codes SET description='Basra Oil Company' WHERE code_set='ORIGINATOR' AND code='BOC';
UPDATE controlled_codes SET description='Ministry of Oil' WHERE code_set='ORIGINATOR' AND code='MOO';
UPDATE controlled_codes SET description='Contractor' WHERE code_set='ORIGINATOR' AND code='CONTRACTOR';
UPDATE controlled_codes SET description='Vendor' WHERE code_set='ORIGINATOR' AND code='VENDOR';
UPDATE controlled_codes SET description='Consultant' WHERE code_set='ORIGINATOR' AND code='CONSULTANT';

INSERT OR IGNORE INTO controlled_codes (code_set, code, description, sort_order) VALUES
  ('ORIGINATOR','UEG','United Energy Group Headquarters',8),
  ('ORIGINATOR','JMC','Joint Management Committee',9),
  ('ORIGINATOR','MC','Management Committee',10),
  ('ORIGINATOR','EPC','EPC or EPCC Contractor',11),
  ('ORIGINATOR','PCC','Procurement, Construction and Commissioning Contractor',12),
  ('ORIGINATOR','DES','Design or FEED Contractor',13),
  ('ORIGINATOR','PMC','Project Management Consultant',14),
  ('ORIGINATOR','LLI','Long Lead Item Supplier',15),
  ('ORIGINATOR','VED','Vendor or Supplier',16),
  ('ORIGINATOR','TPI','Third-Party Inspection Agency',17),
  ('ORIGINATOR','GOV','Other Government Authority',18),
  ('ORIGINATOR','CUS','Customs, Ports and Border Authorities',19),
  ('ORIGINATOR','OTH','Other Third Party',20);

-- ---------- CLASS CODES (UEFL Section 12) ----------
UPDATE controlled_codes SET description='Class I — Must be approved before work proceeds' WHERE code_set='CLASS' AND code='1';
UPDATE controlled_codes SET description='Class II — Submitted for information, work may proceed' WHERE code_set='CLASS' AND code='2';
UPDATE controlled_codes SET description='Class 3 — Standard' WHERE code_set='CLASS' AND code='3';
UPDATE controlled_codes SET description='Not Classified' WHERE code_set='CLASS' AND code='NA';

-- ---------- LANGUAGE CODES ----------
UPDATE controlled_codes SET description='English' WHERE code_set='LANGUAGE' AND code='EN';
UPDATE controlled_codes SET description='Arabic' WHERE code_set='LANGUAGE' AND code='AR';

-- ---------- CORRESPONDENCE SLA RULES (UEFL Section 16) ----------
-- Remove old generic rules, add UEFL-specific ones
DELETE FROM sla_rules WHERE entity_type='CORRESPONDENCE_SLA';

INSERT INTO sla_rules (code, entity_type, priority, days, escalate_after_days) VALUES
  ('SLA-CORR-BOC','CORRESPONDENCE_SLA','BOC',7,5),
  ('SLA-CORR-MOO','CORRESPONDENCE_SLA','MOO',7,5),
  ('SLA-CORR-UEG','CORRESPONDENCE_SLA','UEG',7,5),
  ('SLA-CORR-CONTRACTOR','CORRESPONDENCE_SLA','CONTRACTOR',10,7),
  ('SLA-CORR-VENDOR','CORRESPONDENCE_SLA','VENDOR',10,7),
  ('SLA-CORR-URGENT','CORRESPONDENCE_SLA','URGENT',3,0),
  ('SLA-CORR-GOV','CORRESPONDENCE_SLA','GOV',7,5),
  ('SLA-CORR-JMC','CORRESPONDENCE_SLA','JMC',7,5),
  ('SLA-CORR-DEFAULT','CORRESPONDENCE_SLA','DEFAULT',7,5);

-- ---------- PERMISSIONS ----------
INSERT INTO permissions (code, description, domain) VALUES
  ('project.manage','Manage project register','Projects'),
  ('correspondence.manage','Manage correspondence settings','Correspondence')
  ON CONFLICT(code) DO NOTHING;
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
  SELECT (SELECT id FROM roles WHERE code='ADMIN'), id FROM permissions WHERE code IN ('project.manage','correspondence.manage');
