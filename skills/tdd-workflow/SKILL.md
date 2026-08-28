---
name: tdd-workflow
description: The red-green-refactor methodology — how to pick the next test, what to assert, and how to keep the loop tight. Use when implementing a feature test-first or when a suite has become slow, brittle, or untrustworthy.
---

# TDD Workflow

## When to use

Any change where being wrong is expensive: business rules, money, permissions, parsers, state machines, anything with edge cases.

Skip TDD for throwaway spikes and pure layout work — then delete the spike and do it properly.

## The loop

**Red → Green → Refactor**, one behaviour at a time.

1. **Red.** Write the smallest failing test for the next increment. *Run it and read the failure.* A test that has never failed proves nothing — it may be asserting nothing at all.
2. **Green.** Do the least that passes. Hardcoding a return value is legitimate here; the next test forces generality.
3. **Refactor.** With the bar green, fix names, remove duplication, extract the concept that emerged. Re-run.

## Choosing the next test

Work outside-in through the cases in this order:

1. The simplest happy path
2. The next-simplest variation that forces real logic
3. Boundaries: zero, one, many, max, off-by-one either side
4. Invalid input — what should it do, exactly?
5. Failure of a dependency — timeout, rejection, partial write
6. Concurrency, if the code can be entered twice

## What a good test looks like

```ts
it("rejects a refund larger than the original charge", async () => {
  const order = await createOrder({ total: 1000 });          // arrange
  const result = await refund(order.id, 1500);               // act
  expect(result).toEqual({ ok: false, error: "amount_exceeds_charge" }); // assert
});
```

- The name states the behaviour, not the function. `rejects a refund larger than the original charge`, not `test refund 2`.
- One reason to fail per test.
- Assert the observable outcome, not the internal call sequence.
- No branching or loops in the test body — if you need them, you need more tests.

## Test doubles

- Prefer the real thing: in-memory DB, real clock injected as a value, real function.
- Mock only what you cannot afford to run: third-party network, payment providers, email.
- Never mock the unit under test.
- A test that only asserts "this mock was called" tests your mock, not your code.

## Keeping the suite trustworthy

- **Fast**: unit suite under a minute, or people stop running it.
- **Deterministic**: no real clock, no real random, no shared mutable fixtures, no order dependence.
- **A failing test is never skipped.** Fix it or delete it with a stated reason.
- Flaky means broken. Find the race; do not raise the retry count.
- Coverage is a smoke detector, not a goal — 80% with meaningful assertions beats 100% of `expect(x).toBeDefined()`.

## When a bug is reported

1. Write the failing test that reproduces it. **Do not fix anything first.**
2. Watch it fail for the reported reason.
3. Fix it.
4. Keep the test forever — that is the regression guard.
