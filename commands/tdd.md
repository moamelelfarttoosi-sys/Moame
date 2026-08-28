---
description: Implement a feature test-first with a strict red-green-refactor loop
argument-hint: [feature description]
---

# /tdd

Implement **$ARGUMENTS** test-first.

## Do this

1. Discover the test setup: framework, runner command, test file location and naming, existing fixtures. Do not guess — read `package.json`/`pyproject.toml`/`Makefile` and one neighbouring test.
2. List the behaviours to cover, smallest first, including boundaries and failure paths. Show the list before writing code.
3. For each behaviour, run the loop:
   - **RED** — write one failing test. Run it. Show the failure.
   - **GREEN** — minimum implementation. Run it. Show the pass.
   - **REFACTOR** — clean up with the bar green. Re-run.
4. Run the full suite at the end and report the result.

## Constraints

- No implementation before a failing test exists.
- Never weaken, skip, or `.only` a test to get green.
- One behaviour per test; the test name states the behaviour.
- Use the repo's existing conventions, not your preferred ones.

Delegate to the `tdd-guide` agent if the feature spans more than three files.
