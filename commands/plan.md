---
description: Produce an ordered, file-level implementation plan before writing code
argument-hint: [what you want to build]
---

# /plan

Plan the implementation of **$ARGUMENTS**. Do not write production code in this command.

## Do this

1. Read the relevant code first — entry points, the modules that own the behaviour, existing tests. Cite `file:line`.
2. Produce:

```
## Goal
## Current state        (with file:line)
## Plan                 (numbered, each step names files)
## Verification         (commands that must pass)
## Risks & open questions
## Optional follow-ups  (things you noticed but were not asked for)
```

3. Order steps so the repo builds and the tests pass after each one.
4. Stop and ask if an ambiguity would change the plan rather than planning both branches.

Delegate to the `planner` agent for anything touching more than three files, and to `architect` if the change involves a data model, a service boundary, or a new dependency.
