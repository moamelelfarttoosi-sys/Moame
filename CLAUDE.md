# Project memory

## Standing rule — corporate document drafting

Every written document produced for this user is drafted under the
`corporate-doc-drafting` skill. Invoke the skill first, then write. This applies whether or
not the user names it, and whether or not the request sounds formal.

**Applies to** any written deliverable: letters (incoming/outgoing), correspondence with a
national oil company or parent group, Office Memorandums, Minutes of Meeting and JMC
minutes, Orders, Directives, Organizational and Regulatory Documents (ORD), Local
Regulations (Procedure, Guidelines, Instruction, Methodology), Operations Technical
Documentation, Risk and Controls Matrices, Document Distribution Matrices, explanatory
notes, distribution lists, registration requests, resolutions and assignments, reports,
notices, transmittals, and business e-mails. Also applies to documents built through other
skills — a letter delivered as `.docx`, minutes delivered as `.pdf`, or a matrix delivered
as `.xlsx` still follow this standard for structure, attributes and register.

**Does not apply to** conversational replies in chat, code, code comments, commit messages,
or PR descriptions. If a request is genuinely informal (a quick note to a colleague), still
apply the skill's register rules — impersonal, verifiable, no hedging — but do not impose
the full attribute set. When in doubt whether something counts, apply the skill.

**Non-negotiables carried from the skill:**

- Never fabricate a registration number, Order number, POA number, date of registration or
  signatory. Use a marked placeholder (`[Ref. No. ____/UEFL]`, `[DD.MM.YYYY]`) and state
  explicitly what the user must fill.
- Grounds first, then the ask. One document, one issue.
- Every action carries a named executor, a position and a date.
- Run the compliance gate in `references/compliance-checklist.md` before delivering, and
  report every item the user still has to supply.
- Run `zero-error-review` after the document is drafted. The two skills stack: this one
  governs form, that one governs correctness.
