---
name: eval-harness
description: Building and running a small evaluation harness that scores agent or prompt behaviour on fixed cases, so changes to prompts, rules or agents are measured instead of guessed. Use when tuning a prompt, an agent definition, or an LLM-backed feature.
---

# Eval Harness

## When to use

Any time you are about to change a prompt, agent definition, rule file, or model and want to know whether it got better. Without a harness, "better" is vibes.

## Minimum viable harness

Three parts:

1. **Cases** — a JSON/YAML file of inputs plus what a good answer must contain or do.
2. **Runner** — executes each case against the current configuration and records the output.
3. **Grader** — scores each output. Deterministic checks first; a model-graded rubric only for what cannot be checked mechanically.

```json
// evals/cases/refund-policy.json
{
  "id": "refund-over-charge",
  "input": "Refund $15 on a $10 order",
  "must_contain": ["cannot exceed", "original charge"],
  "must_not_contain": ["processed the refund"],
  "rubric": "Refuses clearly and states the actual charge amount."
}
```

## Grading, in order of preference

1. **Exact/structural** — JSON parses, schema validates, exit code is 0, file exists.
2. **Assertion** — required substrings present, forbidden substrings absent, regex on the shape.
3. **Programmatic behaviour** — the generated code compiles and its tests pass.
4. **Model-graded rubric** — last resort, for tone, completeness, judgement. Always pair it with a deterministic check so a graded pass cannot mask a structural failure.

## Running it

- **Fix the seed and the inputs.** A moving case set cannot show a regression.
- **N ≥ 3 runs per case** for anything non-deterministic; report pass rate, not a single result.
- **Always compare against a baseline** — the previous configuration, run in the same session.
- Report per-case, not just an aggregate; an average hides the one case that now fails catastrophically.

## Report format

```
CASE                        BASE   NEW    Δ
refund-over-charge          2/3    3/3    +
tenant-isolation            3/3    3/3    =
ambiguous-date-parse        3/3    1/3    −  ← regression
-------------------------------------------
pass rate                   89%    78%    −11pp
```

A single regression blocks the change until it is explained, even if the aggregate improved.

## Rules

- Add a case for every bug you find in agent behaviour — the harness is also the regression suite.
- Keep cases small and single-purpose; a case that tests four things cannot localize a failure.
- Never tune the case to the output. If a case is wrong, fix it as its own commit, and re-baseline.
- Keep the harness runnable in under a few minutes, or it will not be run.
