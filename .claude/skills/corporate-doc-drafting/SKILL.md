---
name: corporate-doc-drafting
description: >-
  House drafting standard for oil & gas corporate documentation, extracted from the LOIE
  Guidelines for Documentation Support of Management Activities (Order 26/LOIE Rev 04) and
  generalised for UEFL, BOC and any Operator-Contractor setting. Trigger automatically,
  without being asked, for: official incoming or outgoing letters; correspondence with a
  national oil company or a parent group; bilingual English-Arabic or English-Russian
  documents; Office Memorandums; Minutes of Meeting and JMC minutes; Orders; Directives;
  Organizational and Regulatory Documents (ORD); Local Regulations (Procedure, Guidelines,
  Instruction, Methodology); Operations Technical Documentation; Risk and Controls Matrices;
  Document Distribution Matrices; explanatory notes; distribution lists; registration
  requests; resolutions and assignments; document numbering; e-mail signatures. Also trigger
  on "make it official", "corporate format", or any document bound for ESDO, IDMS or
  SharePoint. If unsure whether it is formal enough, trigger it.
---

# Corporate Document Drafting Standard

## Why this exists

The LOIE Guidelines are not a style preference. They are a **control system**. Every rule in them
exists because a document that fails it becomes unregistrable, unenforceable, or unauditable:
an unnumbered letter is "not official" and cannot be relied on in arbitration; a regulation without
a Risk and Controls Matrix is rejected at the DMS gate; a resolution without a named first executor
has no accountable owner. Drafting to this standard means the document survives contact with
Document Control, Legal, Internal Control and, eventually, an auditor.

Apply the standard's **logic** even when the entity is not LOIE. Swap the entity names
(Operator / Company / Asset), the DMS (ESDO → IDMS → SharePoint), and the counterparty
(TOC → BOC), but keep the structure, the attribute set, the numbering discipline and the
approval mechanics intact.

## The seven principles behind every rule

1. **Registration is what makes a document exist.** No reference number = not official. Never
   produce a document without a slot for its number and date, and never let a draft leave without
   telling the user what still needs to be registered.
2. **One document, one issue.** Letters address a single subject with a single heading. Orders do
   not duplicate or contradict prior orders. A single Order releases a single OTD at a single revision.
3. **Two-part logic.** Grounds first (facts, events, references to prior documents), then the ask
   (conclusion, proposal, request, resolution). Never invert this.
4. **Everything is attributable.** Every action carries a named executor, a position, and a date.
   Vague verbs ("reinforce", "speed up", "optimise") and vague status ("in progress", "completed")
   are prohibited because they cannot be verified.
5. **Traceability over elegance.** Cross-reference by paragraph number, cite the full title of
   external documents, and log every revision. Never copy-paste external provisions without
   adapting them to the entity's specifics.
6. **The template is the contract.** Use the current approved template from the corporate portal,
   not a remembered version. Formatting deviations are treated as non-compliance, not taste.
7. **Risk is documented, not assumed.** Any document that defines a procedure, standard, norm or
   methodology carries a Risk and Controls Matrix as its final pages.

## Workflow — follow this order every time

**Step 1 — Classify.** Determine the document type before writing a word. The type dictates the
attribute set, language, template, approval route and deadline. If unsure, read
`references/document-types.md`.

**Step 2 — Set the language regime.** English is the official language and prevails in any
discrepancy. Arabic and Russian are working languages with specific, non-interchangeable rules.
Bilingual output requires the prevalence clause. See `references/language-rules.md`.

**Step 3 — Lay in the mandatory attributes.** Each type has a fixed attribute set (logo, type name,
addressee, date, number, heading, body, attachments record, executor record, signature, approval
field, stamp, confidentiality mark, approved-copy mark). Missing attributes are the single most
common rejection cause. See `references/formatting-spec.md`.

**Step 4 — Draft the body** to the type-specific rules in `references/document-types.md`
(letters, memos, orders/directives, MOM) or `references/local-regulations.md`
(procedures, guidelines, instructions, methodologies, OTD).

**Step 5 — Build the control apparatus.** Distribution list, explanatory note, Risk and Controls
Matrix, revision history log, approver list — whichever the type requires. See
`references/local-regulations.md` and `references/workflow-and-control.md`.

**Step 6 — Run the compliance gate** in `references/compliance-checklist.md` before delivering.
Report any item the user still has to supply (registration number, translator confirmation,
Director's approval, signed PDF) instead of silently inventing it.

**Never fabricate** a registration number, an Order number, a POA number, a date of registration,
or a signatory. Leave a clearly marked placeholder — `[Ref. No. ____/UEFL]`, `[DD.MM.YYYY]` — and
tell the user explicitly what to fill.

## Reference files

Read the one that matches the task; do not read all of them by default.

| File | Read it when |
|---|---|
| `references/formatting-spec.md` | Any document — page setup, fonts, attribute matrix, dates, numbering, signature blocks |
| `references/document-types.md` | Letters, memos, orders, directives, minutes of meeting |
| `references/language-rules.md` | Bilingual work, Arabic/Russian, addressing forms, terminology, capitalisation |
| `references/local-regulations.md` | Procedures, Guidelines, Instructions, Methodologies, OTD, Risk and Controls Matrix |
| `references/workflow-and-control.md` | Registration, resolutions/assignments, deadlines, approval routes and timeframes, confidentiality, e-mail, facsimile |
| `references/compliance-checklist.md` | Always, immediately before delivery |
| `assets/skeletons.md` | You need a ready-to-fill structure for a letter, memo, order, MOM or regulation |

## Tone and register

Business register, impersonal, verifiable. First-person plural or third-person singular for letters
("We submit for consideration…", "The Company does not object to…"); first-person singular for
orders and directives ("I HEREBY ORDER"). Infinitive verbs in instructions ("To finalize…",
"To develop…"). No italics, no underlining, no colour highlighting, no rhetorical flourish, no
hedging. If a sentence cannot be audited against a fact, a date or a named person, cut it.

## Handling the source's own defects

The source Guidelines contain internal inconsistencies. Do not propagate them; flag them if the
user is building a derivative document:

- **Line spacing conflict (§5.2).** The formatting table specifies `1.15`, while the prose directly
  beneath specifies "one (1) line spacing". Default to **1.15** for the body of letters/memos/ORD
  (the table is the controlling specification) and raise the conflict when producing a derived
  in-house standard.
- **Stale cross-reference (§9.1).** It cites "Clause 4.3" for the types of Local Regulations, but
  after the Rev 04 renumbering Local Regulations are **§4.4**; §4.3 is Executive Documents.
- **Role table defect (§11.2).** The "Responsible Executor (Originator)" row names the Supervisor as
  the responsible person; the intended reading is the executor appointed by the Supervisor.
- **Attribute matrix (§5.3).** The applicability ticks do not survive text extraction. When exact
  applicability matters, verify against the original PDF rather than relying on the table alone.
- Minor: "before applying for the facsimile" (§12.1) should read "before applying the facsimile".

## Pairing with other skills

Run `zero-error-review` after producing any deliverable under this skill — the two are designed to
stack: this one governs form, that one governs correctness.
