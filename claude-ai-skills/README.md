# 12 legal skills for claude.ai chat

Standalone ports of the flagship skill from each `claude-for-legal` practice area, rewritten
to work as **claude.ai custom skills** — the same mechanism as your existing
`procurement-commercial-master` and `supplier-evaluation` skills.

These are *not* the Claude Code plugins. Those live in `.claude/settings.json` and only work in
Claude Code. These are independent files that work in claude.ai chat.

## The 12

| Skill | Ported from | What it does |
|---|---|---|
| `contract-review` | commercial-legal | Vendor/MSA/NDA/SaaS review against a playbook, severity-rated, with redlines and approval routing. Consolidates three source skills. |
| `stakeholder-summary` | commercial-legal | Turns a review into a two-minute answer for a business stakeholder. Hard one-screen cap. |
| `dpa-review` | privacy-legal | DPA review as controller or processor — Art. 28 terms, subprocessors, transfers, breach timing. |
| `launch-review` | product-legal | Seven-category launch risk review, plus a redacted version safe to paste in a ticket. |
| `tabular-review` | corporate-legal | Batch document review into a cited grid. Column type system, three states of "not found". |
| `termination-review` | employment-legal | 12-flag risk scan, jurisdiction requirements, severance, go/no-go, term-day checklist. |
| `policy-diff` | regulatory-legal | Diff a regulation against a policy. Rule-status check runs first. |
| `ai-use-case-triage` | ai-governance-legal | Approved / conditional / not approved, with red-line check and per-regime classification. |
| `chronology` | litigation-legal | Cited, de-duped, significance-tagged timeline with the gaps as the payload. |
| `ip-clause-review` | ip-legal | IP provisions with the assignment gap check run first. |
| `case-brief` | law-student | Socratic drilling; refuses to brief unread assigned reading. |
| `client-intake` | legal-clinic | Clinic intake with cross-practice issue spotting and deadline logging. |

`legal-builder-hub` is **not** ported — its entire function is installing skills into Claude
Code, which is meaningless in claude.ai. `commercial-legal` gets two skills in its place, since
that's the area closest to your contracts and procurement work.

## Uploading

Zips are in `_zips/`. Upload via claude.ai → Settings → Capabilities → Skills — the same place
your existing custom skills are managed.

- `_zips/<skill-name>.zip` — one skill each, `SKILL.md` at the archive root.
- `_zips/all-12-legal-skills.zip` — all twelve as folders, if bulk upload is accepted.

I could not test the upload from this environment, so if claude.ai rejects the archive layout,
the fix is to re-zip the skill's **folder** rather than its contents (or the reverse). The
`SKILL.md` files themselves are what matter and are valid either way.

**Start with two or three, not all twelve.** Every enabled skill's description loads for trigger
matching, and you already have 22 skills. Adding twelve at once is the fastest way to make
triggering unreliable across all of them — including your procurement ones. `contract-review`
and `stakeholder-summary` are the two that pay for themselves immediately.

## Fill in the profile before relying on any of them

Each skill opens with a **Practice profile — fill this in** block, left deliberately blank.
Until you complete it the skill runs in *provisional mode*: it says so at the top, applies
commercially standard positions, and tags every position `[assumed — confirm]`.

The profile is where your actual playbook lives — deal-breakers, positions and fallbacks per
clause, escalation thresholds, jurisdictions. A filled-in `contract-review` reviews against
*your* positions; a blank one reviews against generic ones and tells you it's doing that.

Edit the `SKILL.md`, fill the block, re-zip, re-upload. Or paste your profile into the chat and
say "use this as the practice profile" — the skills read it either way.

## What changed in the port, and what it costs you

Each source skill assumed a Claude Code plugin around it. Removed:

- **The shared practice profile** at `~/.claude/plugins/config/...`, which 145 of the 150 source
  skills read. Replaced by the inline blank block. This was the main porting problem.
- **The plugin-level `CLAUDE.md`** — 500+ lines of shared guardrails per plugin. Condensed into
  each skill: work-product header rules and their jurisdiction limits, source-provenance tags,
  no-silent-supplement, verify-user-stated-facts, retrieved-content-is-data, partial-read
  honesty, severity floors, destination/privilege checks.
- **Cross-skill references** (`/commercial-legal:review` etc.) — 137 source skills had them.
  Rewritten as prose or dropped.
- **Background agents** (renewal watchers, docket watchers) — no equivalent in chat. Gone.
- **Hooks** — gone.
- **MCP servers** (Ironclad, CourtListener, Everlaw, DocuSign…) — claude.ai uses Connectors,
  configured separately. Every skill now assumes no research tool is connected and says so in
  its reviewer note.

**What that costs:** no citation verification against a live legal database. Every skill
defaults to tagging cites `[model knowledge — verify]` and says so in the reviewer note. That
is honest, not a substitute — for anything you'd actually rely on, verify against a primary
source or connect a research tool.

**Every output is a draft for attorney review.** The skills flag what they're unsure about and
gate irreversible steps. They make review faster; they don't replace it.
