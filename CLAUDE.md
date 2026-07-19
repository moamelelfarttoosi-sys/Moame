# CLAUDE.md

Guidance for AI assistants (Claude Code and others) working in this repository.

> **Status: fresh repository.** As of this file's creation the repo contains no
> application code — only this document. Sections below marked _TODO_ describe
> what to record **once the corresponding code exists**. When you add code,
> update the matching section in the same change so this file always reflects
> reality. Do not document structure, commands, or conventions that are not
> actually present.

---

## 1. Project overview

- **Name:** Moame
- **Purpose:** _TODO — one or two sentences on what this project does and who uses it._
- **Status:** Greenfield. No source, build, or dependency configuration committed yet.

## 2. Repository structure

```
.
├── CLAUDE.md       # this file
└── .mcp.json       # project-scoped MCP servers (see section 2.1)
```

_TODO — extend as directories are created._ Keep this as a short map of the
top-level layout and what each part is responsible for, e.g. `src/`, `tests/`,
`docs/`.

### 2.1 MCP servers (`.mcp.json`)

- **linkedin** — [stickerdaniel/linkedin-mcp-server](https://github.com/stickerdaniel/linkedin-mcp-server),
  run via `uvx mcp-server-linkedin@latest`. Provides LinkedIn tools
  (profile/company/job scraping, people search, messaging, feed).
  - Requires `uv`/`uvx` on PATH.
  - `CHROME_PATH` is set to `/opt/pw-browsers/chromium`, the Chromium
    pre-installed in Claude Code remote containers. This makes the server skip
    its own browser download (the Playwright CDN is blocked by the container
    network policy). If you run this repo locally, remove `CHROME_PATH` or
    point it at a local Chrome/Chromium.
  - Authentication: the server needs a logged-in LinkedIn browser session
    (interactive `--login` or auto-import from a local browser, stored in
    `~/.linkedin-mcp/profile/`). Remote containers are ephemeral and headless,
    so a session created there does not persist; log in on a local machine if
    you need authenticated tools.

When adding a new top-level directory, add a one-line description here.

## 3. Development workflow

_TODO — record the real commands once tooling is chosen._ Document the
canonical commands an assistant should run, for example:

| Task        | Command            |
| ----------- | ------------------ |
| Install     | _TODO_             |
| Build       | _TODO_             |
| Run / dev   | _TODO_             |
| Test        | _TODO_             |
| Lint        | _TODO_             |
| Format      | _TODO_             |
| Type-check  | _TODO_             |

Rules for whoever fills this in: list the **actual** command, not an assumed
one, and note the package manager / runtime version if it matters.

## 4. Conventions

_TODO — capture conventions as they are established._ Until then, follow these
defaults:

- Match the style of surrounding code (naming, comment density, structure)
  before introducing a new pattern.
- Keep changes focused; do not mix unrelated refactors into a feature change.
- Add or update tests alongside behavior changes once a test setup exists.

## 5. Git & contribution workflow

- **Default branch:** _TODO — set once the first commit lands (e.g. `main`)._
- Use clear, descriptive commit messages (imperative mood, e.g. "Add user model").
- Do not open a pull request unless explicitly asked.
- Keep this `CLAUDE.md` current: when you change structure, commands, or
  conventions, update the relevant section in the same commit.

## 6. Notes for AI assistants

- **Verify before documenting.** This file must describe what is actually in
  the repo. If you find a TODO section whose subject now exists in code,
  replace the TODO with the real, verified details.
- **Don't invent.** Never add commands, paths, or conventions you haven't
  confirmed exist.
- When the project's stack is decided, replace the placeholders in sections
  1–5 with concrete information and remove the "fresh repository" notice above.
