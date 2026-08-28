# Project: <name>

Example project-level `CLAUDE.md`. Copy to the repo root and replace every angle-bracket placeholder. Keep it short — this file is read at the start of every session, and a long one crowds out the actual work.

## What this is

<One paragraph: what the product does and who uses it.>

## Stack

- Runtime: <Node 22 / Python 3.12 / Go 1.23>
- Framework: <Next.js 15 App Router / FastAPI / …>
- Database: <Postgres 16 via Prisma>
- Tests: <Vitest + Playwright>
- Package manager: <pnpm — do not use npm; the lockfile is authoritative>

## Commands

```bash
pnpm install          # setup
pnpm dev              # run locally on :3000
pnpm test             # unit tests
pnpm test:e2e         # Playwright, needs the dev server
pnpm typecheck        # tsc --noEmit
pnpm lint             # eslint
pnpm db:migrate       # migrations — never call prisma migrate directly
```

## Layout

```
apps/web      Next.js frontend
apps/api      REST API
packages/core Domain logic — imported by both, imports neither
packages/db   Prisma schema, migrations, seed
```

Import direction is one-way: `apps/*` may import `packages/*`; never the reverse.

## Conventions

- Types are generated from the schema; never hand-edit `packages/db/generated`.
- API handlers validate input with a zod schema at the boundary.
- Errors return the shared `{ error: { code, message } }` envelope.
- Feature flags live in `packages/core/flags.ts`, never inline.

## Gotchas

- Tests need `TZ=UTC`; they fail on a local timezone.
- The dev server must be running for E2E; `pnpm test:e2e` does not start it.
- `packages/db` requires `DATABASE_URL` even for typecheck.

## Don't

- Don't commit to `main`.
- Don't add a dependency without saying why the existing ones do not suffice.
- Don't touch `infra/` — that repo owns deploys.
