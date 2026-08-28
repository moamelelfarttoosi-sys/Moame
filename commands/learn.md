---
description: Extract durable lessons from this session and append them to CLAUDE.md
---

# /learn

Capture what this session taught you about **this repo**, so the next session does not relearn it.

## Do this

1. Scan the session for: corrections the user made, commands that failed then worked differently, conventions found by reading code, constraints found by breaking something.
2. Keep only lessons that are durable, repo-specific, and actionable. Discard anything true of software in general, and anything about what happened rather than what to do.
3. Deduplicate against the existing `CLAUDE.md` and `rules/` — never restate a rule that is already written.
4. Compress each to one imperative sentence, with a path where it helps.
5. Show the proposed additions as a diff and ask before writing.

## Routing

- Repo convention → project `CLAUDE.md`
- Cross-project preference → `~/.claude/CLAUDE.md`
- Enforceable standard → a file under `rules/`

## Constraints

- Maximum five lessons. More means they are notes, not lessons.
- Append only — never rewrite the user's existing content.
- No secrets, no machine-specific absolute paths, no PII.
