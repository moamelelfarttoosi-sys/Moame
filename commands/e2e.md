---
description: Generate and run Playwright end-to-end tests for a user flow
argument-hint: [user flow to cover]
---

# /e2e

Write and run E2E coverage for **$ARGUMENTS**.

## Do this

1. Find the existing setup: `playwright.config.*`, test dir, base URL, auth fixture, how the dev server starts. If Playwright is not installed, say so and stop — do not install it without asking.
2. Write the flow as the user experiences it: navigate → act → assert what is visible.
3. Run it. Report `passed / failed / flaky`, with the failing step and the trace path for each failure.

## Constraints

- Selectors: `getByRole` with an accessible name first, then label/placeholder/text, then `data-testid`. Never CSS classes or DOM position.
- Web-first assertions only (`await expect(...).toBeVisible()`); no `waitForTimeout` as synchronization.
- Each test creates and cleans up its own data and passes in parallel.
- A flaky test is a race to diagnose, not a retry count to raise.

Delegate to the `e2e-runner` agent for multi-flow suites.
