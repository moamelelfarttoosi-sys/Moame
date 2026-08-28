---
name: coding-standards
description: Language-level best practices for TypeScript/JavaScript, Python, Go and SQL — types, error handling, async, naming and module structure. Use when writing or reviewing code in these languages, or when deciding how a new module should be shaped.
---

# Coding Standards

## When to use

Before writing a new module, and during review when something reads wrong but you need a concrete reason.

## Universal

- **Make illegal states unrepresentable.** A type or constructor that cannot hold a bad value beats a validation call someone forgets.
- **Fail loudly at the boundary, never in the middle.** Validate untrusted input once, at the edge; the interior trusts its types.
- **Return errors, don't swallow them.** An empty `catch` is a bug. If a failure is genuinely ignorable, write the sentence that says why.
- **Name by intent.** `retryBudget`, not `n`. `isEligibleForRefund`, not `check`.
- **Depth over width in functions, width over depth in modules.** Small files that each do one thing; functions deep enough that callers don't reassemble the logic.
- **No comments that restate the code.** Comment the *why*, the constraint, the surprising thing.

## TypeScript / JavaScript

```ts
// strict tsconfig, always
"strict": true, "noUncheckedIndexedAccess": true, "exactOptionalPropertyTypes": true
```

- `unknown` at the boundary, never `any`. Narrow with a parser (zod/valibot) rather than a cast.
- Discriminated unions over optional-field soup:
  ```ts
  type Result<T> = { ok: true; value: T } | { ok: false; error: AppError };
  ```
- `readonly` on inputs; return new objects rather than mutating arguments.
- Every `async` call is awaited or explicitly `void`-ed with a reason. Floating promises lose errors.
- `Promise.all` for independent work; sequential `await` in a loop is a performance bug unless order matters.
- No default exports — they break rename-refactors and grep.

## Python

- Type hints on every public function; run `mypy`/`pyright` in CI.
- `dataclass(frozen=True)` or Pydantic models for data; bare dicts only at the I/O boundary.
- Context managers for anything with a lifetime (files, connections, locks).
- Never a bare `except:`. Catch the narrowest exception you can name.
- No mutable default arguments.
- f-strings for formatting; `logging` with `%s` args, never f-strings in log calls (they format even when filtered out).

## Go

- Handle every error where it happens; wrap with context: `fmt.Errorf("load config: %w", err)`.
- Accept interfaces, return structs.
- `context.Context` as the first parameter for anything that does I/O; honour cancellation.
- `defer` the cleanup on the line after the acquisition.
- Zero values should be usable.

## SQL

- Parameterized queries only — never string interpolation.
- Explicit column lists; `SELECT *` breaks silently when the schema moves.
- Every foreign key indexed; every query in a hot path has an `EXPLAIN` you have actually read.
- Migrations are forward-only and reversible in effect: add column → backfill → switch reads → drop old, as separate deploys.

## Examples

Bad:
```ts
async function save(u: any) { try { await db.save(u); } catch (e) {} }
```

Good:
```ts
async function save(user: User): Promise<Result<UserId>> {
  try {
    return { ok: true, value: await db.save(user) };
  } catch (cause) {
    return { ok: false, error: new PersistenceError("save user", { cause }) };
  }
}
```
