# Formatting Specification

Source: LOIE Guidelines Rev 04, §5 and §12.3.

## Contents
1. Letterhead and logo
2. Page setup and typography matrix
3. Universal text rules
4. Mandatory attribute matrix by document type
5. Document type name
6. Document date
7. Reference numbers and numbering conventions
8. Signature blocks

---

## 1. Letterhead and logo

- Use only the official letterhead carrying the colour corporate logo.
- Unauthorised modification, recolouring or rescaling of the logo is prohibited.
- A document prepared jointly by two or more organisations is compiled on a **blank sheet**, not on
  either party's letterhead.
- Always use the **latest template from the corporate portal** (e.g. SharePoint → DCC Templates),
  never a locally saved copy. Document Control notifies all staff by e-mail when templates change.

## 2. Page setup and typography matrix

All document types share the same page geometry:

| Parameter | Value |
|---|---|
| Paper | A4 (attachments A4–A3) |
| Margins | Left 20–25 mm, Right 15 mm, Top 20 mm, Bottom 20 mm |
| Heading spacing | Before 12 pt / After 12 pt |
| Body spacing | Before 6 pt / After 6 pt |
| Line spacing | 1.15 (see the conflict note in SKILL.md) |
| Alignment | Justified |

Font and indentation vary by type:

| Document type | Font / size | First-line indent | Output format |
|---|---|---|---|
| Outgoing letter to parent company (PJSC LUKOIL) | Times New Roman 14 (Russian) / 12 (English) | 1.25 cm | PDF + native |
| Outgoing letter to NOC (TOC / BOC) | Times New Roman 12 | none | PDF + native |
| Outgoing letter to state authorities | Times New Roman 12 | none | PDF + native |
| Outgoing letter, all other organisations | Times New Roman 12 | none | PDF + native |
| Office Memorandum | Times New Roman 12 | none | PDF |
| Executive / Regulatory document | Times New Roman 12 | none | PDF + native |

## 3. Universal text rules

- **Prohibited:** word hyphenation; italics; underlining; colour highlighting; coloured fonts.
- **Permitted:** rendering a document as a table, questionnaire, or column breakdown — this is the
  standard mechanism for bilingual documents (e.g. bilingual contracts, EN/AR letters).
- Headings of paragraphs: **bold, left-aligned, no full stop at the end**.
- Subparagraphs numbered continuously: `1.`, `1.1.`, `1.2.`

## 4. Mandatory attribute matrix by document type

`✔` = required; `—` = not applicable; `cond.` = conditional.

| # | Attribute | Outgoing letter | Office Memo | Order | Minutes of Meeting | Local regulation |
|---|---|---|---|---|---|---|
| 1 | Logo | ✔ | ✔ | ✔ | ✔ | — |
| 2 | Document type name | — | ✔ | ✔ | ✔ | ✔ |
| 3 | Addressee | ✔ | ✔ | — | — | — |
| 4 | Date | ✔ | ✔ | ✔ | ✔ | ✔ |
| 5 | DMS registration number | ✔ | ✔ | ✔ | ✔ | ✔ |
| 6 | Heading | ✔ | ✔ | ✔ | ✔ | ✔ |
| 7 | Body of the text | ✔ | ✔ | ✔ | ✔ | ✔ |
| 8 | Record about attachments | ✔ | ✔ | ✔ | ✔ | ✔ |
| 9 | Record about Executor | ✔ | ✔ | ✔ | ✔ | — |
| 10 | Signature | ✔ | ✔ | ✔ | ✔ | — |
| 11 | Document approval field | — | — | — | — | ✔ |
| 12 | Stamp certification | cond. — per applicable regulatory documents |
| 13 | Confidentiality record | cond. — paper documents containing confidential information |
| 14 | Approved-copy record | cond. — original paper copies |

Note: the outgoing letter carries **no document type name** — the letterhead and layout identify it.
Every other type carries its name in **CAPITAL LETTERS, centre-aligned** (e.g. `ORDER`,
`OFFICE MEMO`, `MINUTES OF MEETING`).

## 5. Document type name

Typed in capitals, centred, placed above the heading. Applies to all types except outgoing letters.

## 6. Document date

Default rule: **the date of a document is the date of its registration.** Exceptions:

| Document type | Date assigned |
|---|---|
| Minutes of Meeting | Date of the meeting (date of decision); for multi-day meetings, the final day |
| Act | Date of the event |
| Document compiled by several organisations | Date of signing by the last organisation |

Accepted formats for a full date: `01.09.2025` **or** `September 1, 2025`. In orders and directives
the numeric form is mandatory (`01.01.2025`). Year-only references are written naturally:
"the plan for 2025", "the cost estimate of 2025".

## 7. Reference numbers and numbering conventions

- **Orders / Directives:** alphanumeric — `Order number/LOIE` (adapt the suffix to the entity,
  e.g. `26/UEFL`).
- **Orders on personnel:** `Order number/Block10` (i.e. the asset code, not the legal entity code).
- **Sequential numbering runs on a calendar-year basis.** Each number is unique and is never reused
  within the same year.
- A document may be registered **only once**. Altering a signed and registered document is prohibited —
  issue an amending document instead.
- **Reference to a prior document** (`Ref.` / `In reply to`) is used only when the document responds
  to an incoming or internal document, and is placed **below** the current document's own number
  and date.
- Registration company codes (adapt to the entity's own scheme):
  - `8019` — correspondence to/from the NOC, all other third parties, accounting correspondence, MEMOs and MOMs
  - `8020` — correspondence to/from the parent group
  - `8022` — correspondence related to Procurement

### File naming convention for outgoing packages

Numeric sequence where **"1" is always the letter itself**:

```
1. Outgoing 056 LOIE Block 10 dated 31.05.2025
2. Outgoing 056 LOIE Block 10 dated 31.05.2025_Attachment 1
3. Outgoing 056 LOIE Block 10 dated 31.05.2025_Attachment 2
```

Status annotations applied by Document Control:
- Cancelled order: `Cancelled by Order XX/LOIE dated DD.MM.YYYY`
- Cancelled memo: `_Cancelled as of DD.MM.YYYY`
- Superseded memo: `_SUPERSEDED by 8019-MEM-L-2025-00000XX dated DD.MM.YYYY`
- Revised draft during approval: append `revised as of dd.mm.yyyy` to the filename
- Assignment closure evidence: `_assignment completion acknowledgement`

Cancelled or superseded documents are **never deleted** from the DMS; only their status changes.

## 8. Signature blocks

The signature field contains: the signatory's **position**; the **company title** (only if the
document is not on letterhead); the **handwritten signature**; the **full name**.

**On letterhead:**
```
Job Title                    Signature          Full Name
```

**Not on letterhead:**
```
Job Title
Company name
Signature                                       Full Name
```

**Signature under a Power of Attorney** — the POA number and date are mandatory:
```
Full Name
Financial Director                              Signature
(by Power of Attorney No. 100/LOIE B.V. dated 10.05.2025)
```
An Acting Director signs the same way, citing the relevant POA. The Director's own authority is
**not suspended** while a POA is in force.

**Multiple signatories:**
- Equal position → signatures on the **same horizontal line**, the initiating head first, on the left.
- Unequal position → signatures **stacked**, in descending order of seniority, separated by 2–4 line spacings.
- Committee documents → indicate roles (Chairperson, Members).
- **Prohibited:** signing "on behalf of", or placing a slash before the printed title.

**Executor mark** (lower-left corner, beneath the signature field) — initials, surname, phone:
```
Full Name
(+964) 777-77-77
```
Omit the "Drafted by" / executor detail entirely in letters to the NOC and to state authorities.

**In an order:** the issuer's job title is **left-aligned**; the surname and initials are
**right-aligned**.
