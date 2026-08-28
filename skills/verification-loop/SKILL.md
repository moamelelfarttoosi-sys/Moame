---
name: verification-loop
description: A closed loop that proves a change works before it is called done — define the check, run it, read the real output, fix, repeat. Use whenever finishing a task, or when tempted to report success from reasoning rather than execution.
---

# Verification Loop

## The rule

**A change is not done until a command you ran says it is done.** Reasoning about correctness is a hypothesis; the exit code is the evidence.

## The loop

```
1. DEFINE   what "working" means, as a command with an expected result
2. RUN      it — before the change, so you know it fails for the right reason
3. CHANGE   the code
4. RUN      it again — read the whole output, not just the exit code
5. FIX      the real cause; goto 4
6. WIDEN    to the full suite / build / lint, then stop
```

## Defining the check

| Change | Verification |
|---|---|
| Bug fix | A test that reproduces the bug, red before, green after |
| New behaviour | Tests for happy path + the boundaries |
| Refactor | Existing suite green, no behaviour diff |
| Perf | A measurement before and after, same input, stated method |
| Build/type fix | The repo's build and typecheck commands, clean |
| UI change | Rendered and looked at (E2E, screenshot, or the running app) |
| Config/infra | The thing actually starts and serves a request |

## Reading output honestly

- Read the **whole** failure, not the first line. The cause is usually below.
- `0 tests found` is a failure, not a pass. So is a suite that exits 0 having skipped everything.
- A test that passed before your change and still passes has verified nothing about your change.
- If you cannot explain *why* the fix worked, you have not finished — you have coincidence.

## Anti-patterns

- Declaring success from a diff you find convincing.
- Loosening the assertion so it passes.
- `--force`, `--no-verify`, `.skip`, `@ts-ignore` to reach green.
- Calling a failure "flaky" without a mechanism. Flaky is a diagnosis, not an excuse: re-run only to confirm an infrastructure failure or a pre-existing red on the base branch, and only once.
- Reporting "should work" — either it ran or it did not.

## Reporting

State exactly what you ran and what came back:

```
$ pnpm test --filter api
  214 passed, 0 failed (18.2s)
$ pnpm typecheck
  0 errors
Not run: E2E (needs a browser, unavailable here)
```

If something could not be verified, say so plainly and say why. An honest gap is useful; a claimed pass that was never run is not.
