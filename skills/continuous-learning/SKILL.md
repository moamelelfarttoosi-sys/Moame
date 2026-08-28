---
name: continuous-learning
description: Extracts durable patterns, conventions and gotchas from a working session and writes them into CLAUDE.md or a rule file so the next session starts smarter. Use at the end of a substantial session, or when the user says a correction should stick.
---

# Continuous Learning

## When to use

- At the end of a session where you learned something non-obvious about this repo.
- Immediately after the user corrects you on a convention ("we always…", "never do X here").
- When the `/learn` command is invoked, or the session-end hook fires.

## What counts as a lesson

Keep it only if it is **durable, repo-specific, and actionable**:

| Keep | Discard |
|---|---|
| "Migrations run via `pnpm db:migrate`, never `prisma migrate dev`" | "The build took 40s" |
| "`apps/api` imports from `packages/core` only — never the reverse" | "Fixed a typo in Header.tsx" |
| "Tests need `TZ=UTC`, they fail locally otherwise" | "The user prefers dark mode" |
| "Auth middleware must run before the tenant resolver" | Anything true of software in general |

Rule of thumb: if it would have saved you ten minutes at the start of the session, keep it.

## How it works

1. **Scan the session** for: corrections from the user, commands that failed then succeeded in a different form, conventions discovered by reading code, and constraints discovered by breaking something.
2. **Deduplicate** against what is already in `CLAUDE.md` and `.claude/rules/`. Never restate an existing rule.
3. **Compress** each lesson into one imperative sentence with a path where relevant.
4. **Write it to the right place**:
   - Repo-wide convention → project `CLAUDE.md`
   - Cross-project preference → `~/.claude/CLAUDE.md`
   - Enforceable standard → a file in `rules/`
5. **Show the diff** and let the user veto it. Never silently rewrite their config.

## Output format

```md
## Learned this session
- Run migrations with `pnpm db:migrate` — the raw prisma command bypasses the seed guard. (packages/db/README.md)
- `apps/api` must not import `apps/web`; the boundary is enforced by eslint `no-restricted-imports`.
```

## Rules

- Append, don't rewrite. Preserve everything already in the file.
- Maximum five lessons per session — more means they are not lessons, they are notes.
- No secrets, no absolute paths from this machine, no user PII.
- Phrase as an instruction to a future agent, not a diary entry.
