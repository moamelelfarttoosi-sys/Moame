# Delegation Rules

## Delegate when

- The task is a **broad search** across many files and you only need the conclusion (`Explore` / `general-purpose`).
- The task is **independent** of what you are doing and can run in parallel.
- The work would flood your context with output you do not need to keep (log sweeps, dependency audits, repo-wide greps).
- A **specialist** exists for it: `planner`, `architect`, `tdd-guide`, `code-reviewer`, `security-reviewer`, `build-error-resolver`, `e2e-runner`, `refactor-cleaner`, `doc-updater`.

## Do not delegate when

- You already know the file and the symbol — just read it.
- The task is a single edit or a two-line fix.
- The subagent would need more context to be briefed than the task is worth.
- The work is sequential and each step depends on the last.

## Briefing a subagent

A subagent starts with none of your context. The brief must carry:

1. The goal, in one sentence.
2. The paths and symbols it should start from.
3. The constraints: what not to touch, which conventions apply.
4. The exact shape of the output you need back.
5. Whether it may write, or must only report.

## After it returns

- Its report is not shown to the user — **relay what matters**.
- Do not take a subagent's claim at face value when it is surprising. Verify against the code.
- Never re-run a search you already delegated. Wait for the result.

## Parallelism

- Launch independent agents in a single message so they run concurrently.
- Do not fan out more than a handful without a reason; each one costs tokens and attention.
