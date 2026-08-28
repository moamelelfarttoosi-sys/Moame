# Coding Style Rules

## Immutability by default

- Do not mutate function arguments. Return new values.
- `const` over `let`; `let` over reassignment-in-place. No `var`.
- Freeze or type-as-`readonly` shared configuration and constants.
- Mutation is allowed inside a function on a value that function created, when it is measurably clearer or faster. Say why in a comment.

## Functions

- One job per function. If the name needs "and", split it.
- Guard clauses over nested conditionals — return early, keep the happy path at the left margin.
- Maximum three positional parameters; past that, take an options object.
- No boolean parameters that select behaviour. Two functions beat `doThing(true)`.

## Files and modules

- One primary export per file, named the same as the file.
- No default exports.
- Colocate the test with the code (`foo.ts` / `foo.test.ts`).
- Keep files under ~300 lines. When one grows past that, it is usually two concepts.
- Import direction is one-way. Never create a cycle to "share" a helper — move the helper down.

## Naming

- Say what it is: `retryBudgetMs`, not `n`. `isEligibleForRefund`, not `check`.
- Booleans read as predicates: `is`, `has`, `should`, `can`.
- Functions are verbs, values are nouns, collections are plural.
- No abbreviations beyond the ones the repo already uses.

## Errors

- Never swallow an error. An empty `catch` is a bug.
- Throw or return typed errors with context, not bare strings.
- Handle the failure where you can do something about it; propagate with context everywhere else.

## Comments

- Comment the *why*, the constraint, the non-obvious. Never restate the code.
- No commented-out code — version control is the archive.
- `TODO` must name what and when: `// TODO(auth): drop after the v2 migration lands`.

## Formatting

The repo's formatter and linter own formatting. Run them; do not argue with them in review.
