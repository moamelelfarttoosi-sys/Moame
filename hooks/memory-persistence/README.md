# Memory Persistence Hooks

Carries context across session boundaries so a new session does not start blind.

## What it does

| Event | Script | Effect |
|---|---|---|
| `SessionStart` | `scripts/hooks/session-start.js` | Injects the previous session's summary and next steps, the newest checkpoint, captured lessons, git branch/status, and the detected package manager. |
| `SessionEnd` | `scripts/hooks/session-end.js` | Writes `.claude/state/last-session.json` and appends to `.claude/state/sessions.jsonl`. |
| `SessionEnd` | `scripts/hooks/evaluate-session.js` | Mines the transcript for durable corrections and writes them to `.claude/state/<ts>-lessons.md` for review. |

## Files written

```
.claude/state/last-session.json      # what the next session reads first
.claude/state/current-session.json   # in-flight session marker
.claude/state/sessions.jsonl         # append-only history
.claude/state/<ts>-lessons.md        # proposed CLAUDE.md additions, never auto-applied
```

Add `.claude/state/` to `.gitignore` — it is local working memory, not source.

## Guarantees

- Every hook exits 0. A hook must never break the session it is observing.
- Credentials matching common token shapes are redacted before anything is written.
- Nothing is ever written to `CLAUDE.md` automatically. Lessons are proposals; run `/learn` to review them.

## Install standalone

```bash
cp -r scripts ~/.claude/scripts
```

Then merge `hooks.json` into `~/.claude/settings.json`, replacing `${CLAUDE_PLUGIN_ROOT}` with `$HOME/.claude`.
