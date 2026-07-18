package com.moame.app.profile

import com.moame.core.model.CompetencyGroup
import com.moame.core.model.EducationEntry
import com.moame.core.model.ExperienceEntry
import com.moame.core.model.JobPreferences
import com.moame.core.model.LanguageProficiency
import com.moame.core.model.Profile

/**
 * Default profile seeded on first launch, built from the sample CV provided
 * during setup (Contracts & Procurement Engineer). This is just a starting
 * point: edit it from the in-app Profile screen for a different specialty -
 * nothing in the matching/tailoring logic is specific to oil & gas/procurement.
 */
object SeedProfile {
    val default: Profile = Profile(
        id = "current_profile",
        fullName = "Moamel Ali Mohaisen",
        headline = "Contracts & Procurement Engineer | Oil & Gas & EPC Projects",
        email = "moamelali.alfarttoosi@gmail.com",
        phone = "+964 782 264 6895",
        location = "Basra, Iraq",
        linkedInUrl = "linkedin.com/in/moamelali",
        summary = "Contracts & Procurement Engineer with 5+ years of experience in contract " +
            "administration, tendering, and procurement operations across the oil & gas and " +
            "EPC sectors in Iraq. Skilled in managing the full contract lifecycle for EPC and " +
            "frame agreements, evaluating technical and commercial bids, negotiating cost-saving " +
            "commercial terms, and administering variations, amendments, and claims in line with " +
            "FIDIC-based and corporate standards. Combines strong sourcing, supplier evaluation, " +
            "and cost-control capabilities with SAP Ariba, SAP MM, SAP GRC, and Maximo " +
            "proficiency, a Petroleum Engineering foundation, and internationally recognised " +
            "procurement and safety certifications.",
        yearsOfExperience = 5,
        skills = listOf(
            "Contract Lifecycle Management", "EPC / EPCM / Frame Agreements", "FIDIC-based Contracts",
            "Tendering (ITB/ITT/RFQ/RFP)", "Technical & Commercial Bid Evaluation", "Supplier Prequalification",
            "Variation Orders & Change Management", "Claims & Back-charges", "Bonds & Guarantees",
            "Strategic Sourcing", "Vendor Management", "Purchase Requisitions & Purchase Orders",
            "Procurement Planning", "Demand Forecasting", "Incoterms 2020",
            "SAP Ariba", "SAP MM", "SAP GRC", "Maximo", "ERP", "KPI & Cost-Savings Reporting",
        ),
        coreCompetencyGroups = listOf(
            CompetencyGroup(
                "Contract Management & Administration",
                listOf(
                    "Contract lifecycle management", "Contract administration",
                    "EPC / EPCM / frame agreements and call-off contracts",
                    "FIDIC-based contracts", "Commercial terms and conditions", "Negotiation",
                ),
            ),
            CompetencyGroup(
                "Tendering & Bid Evaluation",
                listOf(
                    "ITB / ITT / RFQ / RFP", "Tender management", "Technical and commercial bid evaluation",
                    "Comparative supplier analysis", "Supplier prequalification",
                ),
            ),
            CompetencyGroup(
                "Change, Claims & Risk",
                listOf(
                    "Variation orders and change management", "Claims and back-charges",
                    "Bonds and guarantees (bid, performance, advance payment)",
                    "LOI / LOA", "Compliance and risk management",
                ),
            ),
            CompetencyGroup(
                "Procurement & Sourcing",
                listOf(
                    "Strategic sourcing", "Supplier evaluation and performance", "Vendor management",
                    "Purchase requisitions and purchase orders", "Procurement planning",
                    "Demand forecasting", "Incoterms 2020",
                ),
            ),
            CompetencyGroup(
                "Systems & Reporting",
                listOf("SAP Ariba", "SAP MM", "SAP GRC", "Maximo", "ERP", "KPI and cost-savings reporting", "Document control", "Microsoft Office"),
            ),
        ),
        experience = listOf(
            ExperienceEntry(
                title = "Contracts & Procurement Engineer",
                company = "Teriyaki Agro",
                location = "Basra (Umm Qasr), Iraq",
                startDate = "Feb 2026",
                endDate = null,
                bullets = listOf(
                    "Manage the end-to-end contract lifecycle for agricultural materials supply, negotiating commercial terms that delivered measurable cost reductions.",
                    "Review and evaluate contractor quotations, identifying cost-saving alternatives while maintaining quality standards.",
                    "Negotiate revised payment and delivery terms, lowering operational expenses through strategic contract renegotiation.",
                    "Lead comparative analysis of multiple supplier offers, recommending the most competitive, value-driven contracts to management.",
                    "Coordinate contract amendments and variations to remove unnecessary cost line items and improve logistics and service cost structures.",
                    "Support supplier evaluation and selection decisions that reduced total contract values.",
                    "Monitor contract pricing compliance to prevent cost overruns and flag deviations from agreed commercial terms.",
                ),
            ),
            ExperienceEntry(
                title = "Contracts & Procurement Engineer",
                company = "LUKOIL Overseas Iraq (Block 10 - Eridu)",
                location = "Basra (Al-Barjesia), Iraq",
                startDate = "Nov 2024",
                endDate = "Feb 2026",
                bullets = listOf(
                    "Reported and monitored KPIs and cost savings for Contracts & Procurement (C&P) services, supporting transparency, budget oversight, and management decisions.",
                    "Administered and adapted EPC Frame Agreements and Frame Contracts to project-specific contexts, ensuring contractual compliance throughout the lifecycle.",
                    "Built and maintained proactive relationships with technical entities and EPC contractors to ensure timely materials delivery aligned with project schedules.",
                    "Coordinated with suppliers and vendors to resolve delivery and service issues, maintaining supply chain continuity.",
                    "Maintained and updated the Procurement Plan and forecasted demand with department heads, optimizing procurement cycles and inventory.",
                    "Ensured all purchasing activities complied with quality standards, company policies, and regulatory frameworks.",
                    "Identified and submitted procurement best practices to C&P management, supporting continuous process improvement.",
                ),
            ),
            ExperienceEntry(
                title = "Contracts & Procurement Engineer",
                company = "ZPEC Oil Services Company",
                location = "Basra (Rumaila Oil Field), Iraq",
                startDate = "Aug 2023",
                endDate = "Aug 2025",
                bullets = listOf(
                    "Processed purchase orders accurately and ensured timely entry into company ERP systems in line with ZPEC procedures.",
                    "Administered contracts across the full contract lifecycle, ensuring compliance with organizational procedures at every stage.",
                    "Coordinated closely with service managers and team leaders to improve service delivery timelines and resolve operational bottlenecks.",
                    "Managed PPE procurement, distribution, and record-keeping for service engineers, ensuring full HSE compliance.",
                    "Implemented customer-specific invoice submission processes, including approval workflows and payment follow-up.",
                    "Built and maintained performance tracking dashboards supporting continuous improvement and management reporting.",
                    "Ensured compliance with documentation requirements including timesheets, site visit reports, and contractual service records.",
                ),
            ),
            ExperienceEntry(
                title = "Contracts & Procurement Engineer",
                company = "Zain Al Shahad",
                location = "Halfaya Oil Field, Iraq",
                startDate = "Jul 2022",
                endDate = "Aug 2023",
                bullets = listOf(
                    "Managed contractual documentation and records for vehicle and personnel site access across major operators including PetroChina (PCH), CNOOC, GPP, and Al-Gharraf field.",
                    "Oversaw issuance, renewal, and compliance of gate passes and access permits across operators including CNOOC, CPECC, Power Petroleum, BHDC, and DQDC.",
                    "Processed and monitored invoices and financial transactions for contractual obligations including machinery rental and rig waste transport services.",
                    "Maintained strict control over contract documentation flow - filing, archiving, and handover - across all project phases (Engineering, Procurement, Construction, Commissioning).",
                    "Reviewed and verified final documentation from subcontractors and suppliers to ensure compliance with contractual requirements.",
                    "Administered and updated the Technical Document Register (TDR), tracking documents through approval cycles, and liaised daily with engineering teams and document controllers.",
                ),
            ),
        ),
        education = listOf(
            EducationEntry(
                degree = "Bachelor of Science, Petroleum Engineering",
                institution = "Misan University",
                location = "Maysan, Iraq",
                startYear = 2018,
                endYear = 2022,
                notes = listOf(
                    "GPA 3.2 / 4.0 - Ranked 4th of 200 graduates (Top 2%), cumulative average 78.55%.",
                    "Graduation project: application of SiO2 and Al2O3 nanoparticles to improve filtration and rheological properties of water-based drilling fluids.",
                ),
            ),
        ),
        certifications = listOf(
            "Contract Management - LUKOIL Block 10, 2025",
            "Procurement Management - LUKOIL Block 10, 2025",
            "Procurement Specialization - PCH, Halfaya, 2024",
            "Recruitment Management - LUKOIL Block 10, 2025",
            "IOSH Managing Safely (IOSH MS) - OSHA Academy & IOSH, 2023",
            "Hazard Management & Risk Analysis - IOSH, 2023",
            "H2S Safety Training - OSHA Academy, 2023",
            "Tax Management - CPECC, Halfaya Oil Field, 2022",
            "Document Controlling & Invoices - ZPEC & Quality World, South Rumaila, 2024",
            "Logistics & Administration in Engineering - CPECC, Halfaya Oil Field, 2023",
            "Well Planning & Scheduling / API Q2 Engineering - SPE, Halfaya Oil Field, 2024",
            "QA/QC & NDT in Petroleum Engineering - Antonoil, Halfaya Oil Field, 2023",
            "Google Data Analytics Professional Certificate (8 courses) - Google, 2022",
            "Energy Production, Distribution & Safety Specialization - University at Buffalo (Coursera), 2022",
            "Bawsala Career Mentorship Program (8 months) - World Learning, 2022",
        ),
        languages = listOf(
            LanguageProficiency("Arabic", "Native"),
            LanguageProficiency("English", "Advanced (C2), Michigan English MEPT certified"),
        ),
        preferences = JobPreferences(
            desiredTitles = listOf(
                "Contracts Engineer", "Procurement Engineer", "Contracts & Procurement Engineer",
                "Procurement Specialist", "Contracts Administrator", "Procurement Manager",
            ),
            locations = listOf("Basra", "Iraq"),
            remoteOk = true,
            excludedCompanies = emptyList(),
            excludedKeywords = listOf("unpaid internship"),
        ),
    )
}
