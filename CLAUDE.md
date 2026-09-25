# CLAUDE.md

Guidance for AI assistants (Claude Code and others) working in this repository.

---

## 1. Project overview

- **Name:** Moame — IDMS (Integrated Document Management System)
- **Purpose:** An enterprise document-control platform for an Oil & Gas / EPC project
  environment. It manages controlled documents, incoming/outgoing correspondence,
  registration (DCR/LOIR/TDR/MDR/VDR/SOP registers), transmittals, review →
  endorsement → approval workflows, tasks, resolutions, distribution matrices,
  numbering/allocation, reports, archive and an immutable audit trail.
- **Users:** Document Controllers, Reviewers, Endorsers, Approvers, Project Managers
  and read-only stakeholders (role-based access).
- **Status:** Working application. Vanilla-JS single-page front end served by an
  Express API over a SQLite database.

## 2. Repository structure

```
.
├── server/               # Node/Express API + SQLite (node:sqlite)
│   ├── index.js          # app entry: mounts routes, static SPA, error handler
│   ├── config.js         # port, paths, JWT, upload limits (env-overridable)
│   ├── db.js             # SQLite connection + migration runner
│   ├── migrate.js        # standalone migrate script
│   ├── seed.js           # demonstration data (idempotent)
│   ├── seed-oilgas.js    # additional oil & gas sample data
│   ├── schema/           # 00x_*.sql migrations (applied in order)
│   ├── lib/              # auth, jwt, workflow, numbering, audit, notify, …
│   └── routes/           # one router per domain (documents, approvals, …)
├── public/               # front-end SPA (no build step)
│   ├── index.html        # loads styles + scripts in order
│   ├── assets/styles.css # the single enterprise design system (v3)
│   └── js/
│       ├── api.js        # fetch client + session/token store
│       ├── ui.js         # UI toolkit: el(), table, modal, drawer, badge,
│       │                 #   statusPill, breadcrumb, pageHeader, emptyState,
│       │                 #   skeleton, stepper, moreMenu, toast, charts …
│       ├── app.js        # shell: router, sidebar, topbar, breadcrumbs,
│       │                 #   global search, notifications, keyboard shortcuts
│       └── pages/*.js     # one module per route (Pages.<name>.render)
├── package.json          # start script + express/multer deps
└── SETUP.txt             # Windows-oriented setup notes
```

Storage (`storage/`) — SQLite DB, uploaded files, exports, outbox — is created at
runtime and is git-ignored.

## 3. Development workflow

Requires **Node.js ≥ 22.5** (uses the built-in experimental `node:sqlite`).

| Task            | Command                        |
| --------------- | ------------------------------ |
| Install         | `npm install`                  |
| Run / dev       | `npm start` (or `node server/index.js`) |
| Seed demo data  | `node server/seed.js`          |
| Migrate only    | `node server/migrate.js`       |

The app serves on `http://localhost:8088` by default (override with `PORT`).
Demo accounts (password `Password123!`): `admin`, `dcc`, `reviewer`, `achuplin`,
`approver`, `pm`, `deptmgr`, `contractor1`, `viewer`.

If the database gets into a bad state, delete `storage/idms.db*` and re-run the
seed — it recreates and reseeds.

## 4. Conventions

- **Front end is buildless vanilla JS.** Pages are plain objects
  `Pages.<name> = { title, render(root, params, query) }`. Build DOM with the
  `el(tag, attrs, ...children)` helper from `ui.js`; never inject untrusted HTML.
- **One design system.** All styling lives in `public/assets/styles.css`. Reuse
  the shared components/classes (`.card`, `.btn`, `.tbl`, `.badge`,
  `UI.statusPill`, `UI.pageHeader`, `UI.emptyState`, `UI.moreMenu`, …) rather than
  ad-hoc inline styles, so every screen reads as one product.
- **Status colour is semantic and consistent.** Use `UI.statusPill(code)` — it maps
  a status code to good/warn/bad/info/neutral so the same status always looks the
  same everywhere. Never rely on colour alone (pills carry text + a dot).
- **Server routes** are thin Express routers under `server/routes/`, one per domain,
  using helpers in `server/lib/` (`ah` async wrapper, `ok`/`badRequest`,
  `requireAuth`, `requirePerm`, `pagination`). Responses are `{ data, meta }`.
- Match the style of surrounding code; keep changes focused; don't mix unrelated
  refactors into a feature change.

## 5. Git & contribution workflow

- **Default branch:** `main`.
- Use clear, descriptive commit messages (imperative mood).
- Do not open a pull request unless explicitly asked.
- Keep this `CLAUDE.md` current: when you change structure, commands, or
  conventions, update the relevant section in the same commit.

## 6. Notes for AI assistants

- **Verify before documenting.** This file must describe what is actually in the
  repo. Don't add commands, paths, or conventions you haven't confirmed exist.
- **Preserve business logic when redesigning UI.** The document-control concept
  (registers, workflows, numbering, audit) is intentional — improve how it is
  presented, don't remove working functionality.
