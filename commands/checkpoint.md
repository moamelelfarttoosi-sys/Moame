---
description: Save a verification checkpoint of the current state before compacting or switching context
argument-hint: [optional label]
---

# /checkpoint

Record where this work actually stands — **$ARGUMENTS** as the label if given.

## Do this

1. Run the repo's verification commands (test, typecheck, lint, build) and capture the real results. Do not report from memory.
2. Write the checkpoint:

```md
## Checkpoint: <label> — <ISO date>

### Goal
<the user's framing, one paragraph>

### Verified
- `pnpm test` → 214 passed
- `pnpm typecheck` → 0 errors

### Done
- <outcome> (file:line)

### In progress
- <the exact next step>

### Decisions
- Chose X over Y because Z

### Constraints
- <anything the user said not to touch>
```

3. Save it to `.claude/checkpoints/<timestamp>-<label>.md` and print the path.
4. If anything is red, say so in the checkpoint. A checkpoint that hides a failure is worse than none.

Use this before `/compact`, before switching to unrelated work, and at the end of a session.
