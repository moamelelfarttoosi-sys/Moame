# Testing Rules

## Test-first for logic

- Business rules, permissions, money, parsing, state machines: write the failing test first.
- Bug fixes always start with the failing test that reproduces the bug.
- UI layout and throwaway spikes are exempt — but a spike that survives gets tests before it merges.

## The bar

- **80% line coverage** on code you add or change, with meaningful assertions.
- Coverage is a floor, not a goal. `expect(x).toBeDefined()` is not a test.
- Every public function has at least: a happy path, a boundary, and a failure case.

## Writing tests

- One behaviour per test. The name states the behaviour, not the function.
- Arrange / act / assert, in that order, visibly.
- Assert observable outcomes, not internal call sequences.
- No branching or loops in a test body — that means you need more tests.
- Test through the public surface. A test that reaches into privates breaks on every refactor.

## Doubles

- Prefer the real implementation: in-memory DB, injected clock, real function.
- Mock only what you cannot afford to run: third-party network, payments, email, SMS.
- Never mock the unit under test.

## Suite health

- Deterministic: no real clock, no unseeded random, no shared mutable fixtures, no order dependence.
- Fast: the unit suite runs in under a minute, or it stops being run.
- **Never** skip, `.only`, `xit`, or quarantine a failing test to get green. Fix it or delete it with a stated reason.
- Flaky is broken. Diagnose the race; do not raise the retry count.

## Before you say it works

Run the suite and paste the result. "Should pass" is not a result. If something could not be run here, say so and say why.
