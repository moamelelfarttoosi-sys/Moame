-- ============================================================
-- IDMS — Migration 003: Master Project Register
-- Adds PROJECT code set to controlled_codes + 211 Oil & Gas projects
-- ============================================================

-- Recreate controlled_codes with expanded CHECK constraint
CREATE TABLE controlled_codes_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code_set TEXT NOT NULL CHECK (code_set IN ('DEPARTMENT','SECTION','DISCIPLINE','DOCTYPE','ORIGINATOR','CLASS','LANGUAGE','PROJECT')),
  code TEXT NOT NULL,
  description TEXT NOT NULL,
  lifecycle TEXT NOT NULL DEFAULT 'active' CHECK (lifecycle IN ('active','inactive','retired')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by INTEGER REFERENCES users(id),
  UNIQUE (code_set, code)
);

INSERT INTO controlled_codes_new (id, code_set, code, description, lifecycle, sort_order, created_at, updated_at, updated_by)
  SELECT id, code_set, code, description, lifecycle, sort_order, created_at, updated_at, updated_by FROM controlled_codes;

DROP TABLE controlled_codes;
ALTER TABLE controlled_codes_new RENAME TO controlled_codes;
CREATE INDEX idx_codes_set ON controlled_codes(code_set, lifecycle);

-- ============================================================
-- MASTER PROJECT REGISTER — 211 Oil & Gas Projects
-- PRID 0000–2090 (standard lifecycle phases)
-- PRID 4210–4300 (Mansuriya Gas Field Expansion)
-- ============================================================

INSERT INTO controlled_codes (code_set, code, description, sort_order) VALUES
-- 0000 — Corporate & Business Development
('PROJECT','0000','Corporate & Business Development',1),
('PROJECT','0010','Corporate Strategy Program',2),
('PROJECT','0020','New Ventures Assessment',3),
('PROJECT','0030','Portfolio Optimization Study',4),
('PROJECT','0040','Mergers & Acquisitions Initiative',5),
('PROJECT','0050','Joint Venture Development Program',6),
('PROJECT','0060','Asset Acquisition Program',7),
('PROJECT','0070','Regional Expansion Assessment',8),
('PROJECT','0080','Commercial Development Project',9),
('PROJECT','0090','Investment Opportunity Evaluation',10),

-- 0100 — Frontier Basin Exploration
('PROJECT','0100','Frontier Basin Exploration Program',11),
('PROJECT','0110','Regional Geological Survey',12),
('PROJECT','0120','Gravity Survey Campaign',13),
('PROJECT','0130','Magnetic Survey Campaign',14),
('PROJECT','0140','Geochemical Investigation Campaign',15),
('PROJECT','0150','Surface Mapping Program',16),
('PROJECT','0160','Exploration Block A Survey',17),
('PROJECT','0170','Exploration Block B Survey',18),
('PROJECT','0180','Exploration Block C Survey',19),
('PROJECT','0190','Prospect Maturation Study',20),

-- 0200 — Seismic Acquisition & Processing
('PROJECT','0200','2D Seismic Acquisition Campaign',21),
('PROJECT','0210','3D Seismic Acquisition Campaign',22),
('PROJECT','0220','Offshore Seismic Program',23),
('PROJECT','0230','Onshore Seismic Program',24),
('PROJECT','0240','Seismic Data Processing Project',25),
('PROJECT','0250','Seismic Data Reprocessing Project',26),
('PROJECT','0260','Seismic Interpretation Program',27),
('PROJECT','0270','Exploration Prospect Evaluation',28),
('PROJECT','0280','Basin Modeling Study',29),
('PROJECT','0290','Reservoir Characterization Study',30),

-- 0300 — Exploration Drilling
('PROJECT','0300','Exploration Drilling Campaign',31),
('PROJECT','0310','Wildcat Well No. 1',32),
('PROJECT','0320','Wildcat Well No. 2',33),
('PROJECT','0330','Wildcat Well No. 3',34),
('PROJECT','0340','Deep Exploration Well Project',35),
('PROJECT','0350','Horizontal Exploration Well Project',36),
('PROJECT','0360','Offshore Exploration Well Project',37),
('PROJECT','0370','High Pressure High Temperature Well',38),
('PROJECT','0380','Exploration Test Well Campaign',39),
('PROJECT','0390','Exploration Evaluation Program',40),

-- 0400 — Appraisal & Delineation
('PROJECT','0400','Appraisal Well Campaign Phase 1',41),
('PROJECT','0410','Appraisal Well Campaign Phase 2',42),
('PROJECT','0420','Reservoir Delineation Project',43),
('PROJECT','0430','Formation Testing Program',44),
('PROJECT','0440','Extended Well Testing Project',45),
('PROJECT','0450','Reserve Estimation Study',46),
('PROJECT','0460','Reservoir Simulation Study',47),
('PROJECT','0470','Development Planning Project',48),
('PROJECT','0480','Appraisal Drilling Program',49),
('PROJECT','0490','Concept Selection Study',50),

-- 0500 — Field Development
('PROJECT','0500','Oil Field Development Project',51),
('PROJECT','0510','Gas Field Development Project',52),
('PROJECT','0520','Integrated Field Development Plan',53),
('PROJECT','0530','Reservoir Management Program',54),
('PROJECT','0540','Artificial Lift Program',55),
('PROJECT','0550','Water Injection Program',56),
('PROJECT','0560','Gas Injection Program',57),
('PROJECT','0570','Enhanced Oil Recovery Pilot',58),
('PROJECT','0580','Production Optimization Study',59),
('PROJECT','0590','Development Drilling Campaign',60),

-- 0600 — Processing Facilities
('PROJECT','0600','Central Processing Facility',61),
('PROJECT','0610','Early Production Facility',62),
('PROJECT','0620','Production Gathering Center',63),
('PROJECT','0630','Field Processing Facility',64),
('PROJECT','0640','Crude Oil Processing Facility',65),
('PROJECT','0650','Gas Processing Facility',66),
('PROJECT','0660','Produced Water Treatment Facility',67),
('PROJECT','0670','Sulfur Recovery Unit',68),
('PROJECT','0680','Utilities & Offsites Package',69),
('PROJECT','0690','Industrial Water System',70),

-- 0700 — Wellhead & Gathering
('PROJECT','0700','Wellhead Facilities Development',71),
('PROJECT','0710','Production Manifold Station',72),
('PROJECT','0720','Flowline Network Package',73),
('PROJECT','0730','Gathering System Expansion',74),
('PROJECT','0740','Tank Farm Development',75),
('PROJECT','0750','Export Terminal Development',76),
('PROJECT','0760','Metering Station Development',77),
('PROJECT','0770','Chemical Injection Facilities',78),
('PROJECT','0780','Pigging Facility Package',79),
('PROJECT','0790','Pipeline Launcher & Receiver System',80),

-- 0800 — Pipeline
('PROJECT','0800','Crude Export Pipeline Project',81),
('PROJECT','0810','Gas Export Pipeline Project',82),
('PROJECT','0820','Offshore Pipeline Project',83),
('PROJECT','0830','Cross Country Pipeline Program',84),
('PROJECT','0840','Transmission Pipeline Project',85),
('PROJECT','0850','Pipeline Looping Project',86),
('PROJECT','0860','Pipeline Integrity Upgrade',87),
('PROJECT','0870','Pipeline Expansion Phase 1',88),
('PROJECT','0880','Pipeline Expansion Phase 2',89),
('PROJECT','0890','Pipeline Rehabilitation Program',90),

-- 0900 — Offshore
('PROJECT','0900','Offshore Platform Development',91),
('PROJECT','0910','Wellhead Platform Construction',92),
('PROJECT','0920','Production Platform Development',93),
('PROJECT','0930','Jacket Installation Project',94),
('PROJECT','0940','Topside Fabrication Project',95),
('PROJECT','0950','Offshore Hook-Up Campaign',96),
('PROJECT','0960','Offshore Commissioning Project',97),
('PROJECT','0970','Subsea Production System',98),
('PROJECT','0980','Offshore Utilities Package',99),
('PROJECT','0990','Offshore Brownfield Upgrade',100),

-- 1000 — LNG & Gas
('PROJECT','1000','LNG Facility Development',101),
('PROJECT','1010','LNG Train 1',102),
('PROJECT','1020','LNG Train 2',103),
('PROJECT','1030','LNG Train 3',104),
('PROJECT','1040','NGL Recovery Facility',105),
('PROJECT','1050','LPG Processing Facility',106),
('PROJECT','1060','Gas Compression Station',107),
('PROJECT','1070','Gas Dehydration Facility',108),
('PROJECT','1080','Fractionation Unit',109),
('PROJECT','1090','LNG Export Terminal',110),

-- 1100 — Refinery
('PROJECT','1100','Refinery Development Program',111),
('PROJECT','1110','Refinery Expansion Phase 1',112),
('PROJECT','1120','Refinery Expansion Phase 2',113),
('PROJECT','1130','Crude Distillation Unit',114),
('PROJECT','1140','Vacuum Distillation Unit',115),
('PROJECT','1150','Hydrocracker Unit',116),
('PROJECT','1160','Catalytic Reformer Unit',117),
('PROJECT','1170','Delayed Coker Unit',118),
('PROJECT','1180','Sulfur Recovery Upgrade',119),
('PROJECT','1190','Refinery Utilities Package',120),

-- 1200 — Engineering Design
('PROJECT','1200','Engineering Design Package',121),
('PROJECT','1210','Concept Engineering',122),
('PROJECT','1220','FEED Package',123),
('PROJECT','1230','Detailed Engineering Package',124),
('PROJECT','1240','Process Design Package',125),
('PROJECT','1250','Mechanical Engineering Package',126),
('PROJECT','1260','Piping Engineering Package',127),
('PROJECT','1270','Electrical Engineering Package',128),
('PROJECT','1280','Instrumentation Engineering Package',129),
('PROJECT','1290','Civil & Structural Engineering Package',130),

-- 1300 — Construction
('PROJECT','1300','EPC Package A',131),
('PROJECT','1310','EPC Package B',132),
('PROJECT','1320','EPC Package C',133),
('PROJECT','1330','Modular Construction Package',134),
('PROJECT','1340','Fabrication Yard Package',135),
('PROJECT','1350','Site Construction Package',136),
('PROJECT','1360','Infrastructure Development',137),
('PROJECT','1370','Camp Construction Project',138),
('PROJECT','1380','Warehouse Development Project',139),
('PROJECT','1390','Logistics Base Development',140),

-- 1400 — Mechanical Completion
('PROJECT','1400','Mechanical Completion Program',141),
('PROJECT','1410','System Handover Phase 1',142),
('PROJECT','1420','System Handover Phase 2',143),
('PROJECT','1430','Punch List Management',144),
('PROJECT','1440','Pre-Commissioning Activities',145),
('PROJECT','1450','Flushing & Cleaning Program',146),
('PROJECT','1460','Leak Testing Program',147),
('PROJECT','1470','Functional Testing Program',148),
('PROJECT','1480','System Verification Program',149),
('PROJECT','1490','Readiness Review Program',150),

-- 1500 — Commissioning
('PROJECT','1500','Commissioning Program',151),
('PROJECT','1510','Utilities Commissioning',152),
('PROJECT','1520','Process Commissioning',153),
('PROJECT','1530','Instrument Commissioning',154),
('PROJECT','1540','Electrical Commissioning',155),
('PROJECT','1550','Mechanical Commissioning',156),
('PROJECT','1560','Integrated System Testing',157),
('PROJECT','1570','Performance Testing',158),
('PROJECT','1580','Reliability Run Test',159),
('PROJECT','1590','Ready for Startup Review',160),

-- 1600 — Startup
('PROJECT','1600','Startup Program',161),
('PROJECT','1610','Initial Oil Production',162),
('PROJECT','1620','Initial Gas Production',163),
('PROJECT','1630','First Oil Achievement',164),
('PROJECT','1640','First Gas Achievement',165),
('PROJECT','1650','Production Ramp-Up Phase 1',166),
('PROJECT','1660','Production Ramp-Up Phase 2',167),
('PROJECT','1670','Commercial Operation Readiness',168),
('PROJECT','1680','Operational Acceptance',169),
('PROJECT','1690','Performance Guarantee Testing',170),

-- 1700 — Operations Excellence
('PROJECT','1700','Operations Excellence Program',171),
('PROJECT','1710','Asset Integrity Project',172),
('PROJECT','1720','Reliability Improvement Program',173),
('PROJECT','1730','Production Enhancement Program',174),
('PROJECT','1740','Capacity Expansion Project',175),
('PROJECT','1750','Plant Debottlenecking Project',176),
('PROJECT','1760','Digital Oilfield Initiative',177),
('PROJECT','1770','Energy Efficiency Program',178),
('PROJECT','1780','Carbon Reduction Initiative',179),
('PROJECT','1790','Asset Life Extension Program',180),

-- 1800 — Brownfield Modification
('PROJECT','1800','Brownfield Modification Program',181),
('PROJECT','1810','Facility Revamp Project',182),
('PROJECT','1820','Control System Upgrade',183),
('PROJECT','1830','Equipment Replacement Program',184),
('PROJECT','1840','Rotating Equipment Upgrade',185),
('PROJECT','1850','Flare System Improvement',186),
('PROJECT','1860','Utility System Upgrade',187),
('PROJECT','1870','Fire & Gas Upgrade Project',188),
('PROJECT','1880','Process Safety Upgrade Project',189),
('PROJECT','1890','Operational Improvement Program',190),

-- 1900 — HSE
('PROJECT','1900','HSE Improvement Program',191),
('PROJECT','1910','Environmental Compliance Project',192),
('PROJECT','1920','Emissions Reduction Program',193),
('PROJECT','1930','Produced Water Management',194),
('PROJECT','1940','Waste Management Improvement',195),
('PROJECT','1950','HSE Digitalization Project',196),
('PROJECT','1960','Process Safety Enhancement',197),
('PROJECT','1970','Occupational Safety Program',198),
('PROJECT','1980','Emergency Response Upgrade',199),
('PROJECT','1990','Sustainability Initiative',200),

-- 2000 — Asset Retirement
('PROJECT','2000','Asset Retirement Program',201),
('PROJECT','2010','Well Abandonment Campaign',202),
('PROJECT','2020','Facility Decommissioning Project',203),
('PROJECT','2030','Platform Removal Project',204),
('PROJECT','2040','Pipeline Abandonment Project',205),
('PROJECT','2050','Site Restoration Program',206),
('PROJECT','2060','Environmental Rehabilitation Project',207),
('PROJECT','2070','Asset Disposal Program',208),
('PROJECT','2080','End of Field Life Program',209),
('PROJECT','2090','Close-Out & Lessons Learned Program',210),

-- 4210 — Mansuriya Gas Field Expansion Phase 2
('PROJECT','4210','Mansuriya Gas Field Expansion Phase 2',211),
('PROJECT','4220','Mansuriya Development Drilling Campaign',212),
('PROJECT','4230','Mansuriya Gas Gathering System',213),
('PROJECT','4240','Mansuriya Central Processing Facility',214),
('PROJECT','4250','Mansuriya Compressor Station',215),
('PROJECT','4260','Mansuriya Export Pipeline',216),
('PROJECT','4270','Mansuriya Utilities Package',217),
('PROJECT','4280','Mansuriya Commissioning Program',218),
('PROJECT','4290','Mansuriya Startup Program',219),
('PROJECT','4300','Mansuriya Production Optimization Program',220);
