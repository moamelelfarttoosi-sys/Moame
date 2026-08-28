# Performance & Context Rules

## Model selection

| Work | Model |
|---|---|
| Architecture, planning, security analysis, subtle debugging | The most capable model available |
| Implementation, refactors, reviews, tests | A balanced model |
| Mechanical edits, formatting, summarizing known output | The fastest model |

Choose deliberately; do not use the heaviest model for a rename, or the lightest for a design decision.

## Context management

- **Read narrowly.** Read the function, not the 2000-line file, when you know where you are going.
- Prefer targeted `grep`/`glob` over dumping directories.
- Delegate anything that produces output you will not need to keep.
- Compact at a seam (milestone done, context switch), not at the limit. See the `strategic-compact` skill.
- Write durable facts to `CLAUDE.md` rather than carrying them in the transcript. See `continuous-learning`.

## Tool use

- Run independent tool calls in a single message; they execute in parallel.
- Do not re-read a file you just edited to verify — the edit tool would have failed.
- Do not re-derive a fact already established in the session.
- Cap command output: `| head`, `--max-count`, `-n` on log tails.

## Code performance

- **Measure before optimizing.** A profiler or a timing, not an intuition.
- Fix the algorithm before the constant factor: an N+1 query or an O(n²) loop dwarfs any micro-optimization.
- State the input size you are optimizing for. "Slow" without a number is not a bug report.
- Re-measure after the change, with the same input and method, and report both numbers.
- Do not trade clarity for a speedup you have not measured.
