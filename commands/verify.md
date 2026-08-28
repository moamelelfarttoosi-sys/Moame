---
description: Run the full verification loop and report what actually passed
argument-hint: [optional scope or package]
---

# /verify

Prove the current change works — scope: **$ARGUMENTS** (or the whole repo).

## Do this

1. Discover the repo's own commands (scripts in `package.json`, `Makefile`, `justfile`, CI workflow) — do not invent them.
2. Run, in this order, stopping to fix rather than to continue past a failure:
   - typecheck / compile
   - lint / format check
   - unit tests
   - integration tests
   - build
   - E2E, if configured and runnable here
3. Read the **whole** output of each. `0 tests found` is a failure. A skipped suite is not a pass.
4. Fix real causes and re-run until green.

## Report exactly

```
$ pnpm typecheck     → 0 errors
$ pnpm test          → 214 passed, 0 failed
$ pnpm build         → ok (12.4s)
Not run: E2E — no browser in this environment
```

## Constraints

- Never loosen an assertion, skip a test, or pass `--force`/`--no-verify` to reach green.
- Never report "should work". Either it ran, or say it did not run and why.
