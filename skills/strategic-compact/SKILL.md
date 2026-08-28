---
name: strategic-compact
description: Deciding when and how to compact a long session so context is spent on the task, not on scrollback. Use when context is filling up, when switching to an unrelated task, or when the suggest-compact hook fires.
---

# Strategic Compact

## When to use

Compaction is worth doing **at a seam**, not at a limit. Good seams:

- A milestone finished and verified (feature merged, suite green).
- Switching to an unrelated area of the codebase.
- After a long exploration whose only lasting value is a conclusion.
- After a debugging session where 90% of the transcript is discarded hypotheses.

Bad moments: mid-edit, mid-debug with live state in the transcript, or immediately before a step that needs the details you are about to drop.

## Why bother

An automatic compaction at the limit is indiscriminate — it may drop the constraint you needed and keep the log output you did not. Compacting deliberately lets you choose what survives.

## What must survive

1. **The goal** and the acceptance criteria, in the user's own terms.
2. **Decisions and their reasons** — especially options rejected, so they are not re-litigated.
3. **Repo facts**: the commands that work, paths that matter, conventions discovered.
4. **Current state**: what is done, what is in flight, exactly what is next.
5. **Constraints** the user stated: don't touch X, must stay compatible with Y.

## What should not survive

Full file dumps · command output that has been acted on · exploratory greps · superseded plans · resolved errors · your own restatements of what you were about to do.

## The handoff note

Before compacting, write the note that would let a fresh session continue without asking a question:

```md
## Goal
<one paragraph, user's framing>

## Done
- <verified outcome> (file:line)

## In progress
- <exact next step>

## Decisions
- Chose X over Y because Z

## Repo facts
- test: `pnpm test --filter api`
- migrations: `pnpm db:migrate`

## Constraints
- Do not change the public API of `packages/core`
```

## Rules

- Never compact away an unfinished instruction from the user.
- Preserve verbatim anything the user asked you to remember.
- After compacting, restate the current step in one line so the thread stays legible.
- If a milestone is one step from done, finish it first — then compact.
