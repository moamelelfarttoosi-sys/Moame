# Strategic Compaction Hooks

Automatic compaction at the context limit is indiscriminate — it may drop the constraint you needed and keep the log output you did not. These hooks move the decision earlier, to a seam you choose.

## What it does

| Event | Script | Effect |
|---|---|---|
| `PostToolUse` | `scripts/hooks/suggest-compact.js` | Tracks tool calls and edits per session; after a sustained run, suggests `/checkpoint` then `/compact` — and explicitly says not to compact mid-edit or mid-debug. |
| `PreCompact` | `scripts/hooks/pre-compact.js` | Writes `.claude/state/<ts>-precompact.md` with the branch, working tree, available verification commands, and the carry-forward checklist. |

## Thresholds

Defaults in `scripts/hooks/suggest-compact.js`:

```js
toolCallThreshold: 120     // sustained activity
editThreshold: 40          // many files touched
minCallsBetweenNudges: 60  // never nag
```

Raise them for long sessions in a large repo; lower them if you prefer to compact often.

## What it never does

- It never compacts anything. It only suggests.
- It never nudges twice in quick succession.
- It never fails the tool call it is observing — the hook always exits 0.
