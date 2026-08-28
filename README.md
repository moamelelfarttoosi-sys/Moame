# Everything Claude Code

A complete Claude Code configuration pack: specialized subagents, workflow skills, slash commands, always-follow rules, lifecycle hooks, cross-platform scripts and MCP server configs — installable as a plugin or copied piece by piece.

Everything here is dependency-free. The scripts are plain Node (>= 18) and run on macOS, Linux and Windows.

---

## Install

### As a plugin (recommended)

```
/plugin marketplace add <this-repo-url-or-path>
/plugin install everything-claude-code@everything-claude-code
```

Restart the session. Agents, skills, commands and hooks are all live.

### Manually

```bash
cp -r agents/*   ~/.claude/agents/
cp -r skills/*   ~/.claude/skills/
cp -r commands/* ~/.claude/commands/
cp -r rules/*    ~/.claude/rules/
cp -r scripts    ~/.claude/scripts
```

Then merge `hooks/hooks.json` into `~/.claude/settings.json`, replacing `${CLAUDE_PLUGIN_ROOT}` with `$HOME/.claude`.

Project-scoped instead of user-scoped? Use `.claude/` in the repo rather than `~/.claude/`.

---

## What's in it

### Agents — delegate a whole task

| Agent | Use it for |
|---|---|
| `planner` | Ordered, file-level implementation plans |
| `architect` | Design decisions that are expensive to reverse |
| `tdd-guide` | Strict red-green-refactor implementation |
| `code-reviewer` | Correctness/clarity review of a diff |
| `security-reviewer` | Exploitable-vulnerability audit |
| `build-error-resolver` | Red builds and type errors, fixed at the root |
| `e2e-runner` | Playwright flows written and run |
| `refactor-cleaner` | Dead code removed, with proof |
| `doc-updater` | Docs brought back in sync with the code |

### Skills — knowledge loaded when it is relevant

`coding-standards` · `backend-patterns` · `frontend-patterns` · `tdd-workflow` · `security-review` · `continuous-learning` · `strategic-compact` · `verification-loop` · `eval-harness`

### Commands — one-line entry points

| Command | Does |
|---|---|
| `/plan` | Ordered implementation plan, no code |
| `/tdd` | Implement test-first |
| `/e2e` | Generate and run Playwright coverage |
| `/code-review` | Review the pending diff |
| `/build-fix` | Diagnose and fix a failing build |
| `/refactor-clean` | Remove dead code, with evidence |
| `/verify` | Run the full verification loop and report honestly |
| `/checkpoint` | Save verified state before compacting |
| `/learn` | Extract durable lessons into CLAUDE.md |
| `/setup-pm` | Detect and pin the package manager |

### Rules — always-follow guidelines

`security.md` · `coding-style.md` · `testing.md` · `git-workflow.md` · `agents.md` · `performance.md`

Copy these to `~/.claude/rules/`, or reference them from your `CLAUDE.md`.

### Hooks — automation on session lifecycle

| Event | Effect |
|---|---|
| `SessionStart` | Injects previous-session summary, newest checkpoint, captured lessons, git state, package manager |
| `SessionEnd` | Saves state; mines the transcript for durable lessons |
| `PreCompact` | Writes a handoff note before context is discarded |
| `PostToolUse` | Suggests compacting at a seam, never mid-edit |

Every hook exits 0 by construction — a hook must never break the session it is observing. Credentials are redacted before anything is written to disk.

### MCP servers

`mcp-configs/mcp-servers.json` is a **reference** file — GitHub, filesystem, Postgres, Supabase, Vercel, Railway, Sentry, Playwright, Puppeteer and memory. Installing the plugin does not start any of them. Copy the entries you want into `.mcp.json` (project) or `~/.claude.json` (user); every credential is read from the environment, never stored in the file.

### Contexts

`contexts/dev.md`, `contexts/review.md`, `contexts/research.md` — paste into a session (or a `CLAUDE.md`) to set the posture for that mode of work.

---

## Scripts

```bash
node scripts/setup-package-manager.js            # detect and pin the package manager
node scripts/setup-package-manager.js pnpm       # force a choice
node scripts/setup-package-manager.js --json     # machine-readable
```

Detection precedence: explicit argument → `.claude/package-manager.json` → the `packageManager` field in `package.json` → lockfile → installed binary → npm. Conflicting lockfiles are reported, never silently resolved.

Hook scripts live in `scripts/hooks/` and are importable as modules, which is how they are tested.

---

## Tests

```bash
npm test          # or: node tests/run-all.js
```

67 tests, no dependencies, using the built-in Node test runner. They cover the cross-platform utilities, package-manager detection (including lockfile conflicts and precedence), and each hook's pure logic — context building, next-step extraction, handoff notes, compaction thresholds, lesson mining and secret redaction.

---

## State this writes

```
.claude/state/last-session.json      # what the next session reads first
.claude/state/current-session.json   # in-flight marker
.claude/state/sessions.jsonl         # append-only history
.claude/state/<ts>-precompact.md     # handoff note
.claude/state/<ts>-lessons.md        # proposed CLAUDE.md additions — never auto-applied
.claude/checkpoints/<ts>-<label>.md  # /checkpoint output
```

All of it is local working memory; `.gitignore` already excludes it. Nothing is written to your `CLAUDE.md` without you approving the diff.

---

## Layout

```
.claude-plugin/   plugin.json, marketplace.json
agents/           9 subagent definitions
skills/           9 skills, one directory each
commands/         10 slash commands
rules/            6 always-follow rule files
hooks/            hooks.json + two standalone hook bundles
scripts/          lib/ utilities + hooks/ implementations + setup CLI
tests/            node:test suite
contexts/         dev / review / research postures
examples/         project and user CLAUDE.md templates
mcp-configs/      MCP server configurations
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). New agents, skills, commands, rules, hooks and MCP configs are all welcome — test them with Claude Code before submitting.

## License

MIT — see [LICENSE](LICENSE).
