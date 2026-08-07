# claude-for-legal — installed plugins

This directory pins the [`claude-for-legal`](https://github.com/anthropics/claude-for-legal)
marketplace and enables all 12 practice-area plugins for any Claude Code session
opened on this repository.

## Why the config lives here

`claude plugin install` writes to `~/.claude/settings.json` (user scope), which is
per-machine and is lost when an ephemeral/remote container is reclaimed. The same two
keys are committed here in `.claude/settings.json`, so Claude Code re-registers the
marketplace and installs the plugin set wherever this repo is checked out.

`.claude/hooks/ensure-legal-plugins.sh` is a `SessionStart` backstop for the case
where that sync doesn't run or the fetch fails. It is a no-op (~45ms, silent) when the
plugins are already present under any scope, and restores all 12 from an empty
`~/.claude` in about 15 seconds. It fails soft — it never blocks session start.

## Installed plugins

| Plugin | Covers |
|---|---|
| `commercial-legal` | Vendor agreements, NDAs, SaaS/MSA review; renewal & cancel-by deadlines; escalation routing |
| `privacy-legal` | Processing-activity triage, PIAs, DPA review, DSAR responses |
| `product-legal` | Launch review, marketing-claims substantiation, feature risk assessment |
| `corporate-legal` | M&A diligence (tabular review), closing checklists, board consents & minutes, entity compliance |
| `employment-legal` | Hiring/termination review, worker classification, leave tracking, investigations, policy drafting |
| `regulatory-legal` | Regulatory feed watching, policy diffs, comment deadlines, gap tracking |
| `ai-governance-legal` | AI use-case triage, impact assessments, vendor AI terms, AI inventory |
| `litigation-legal` | Matter/deadline/hold management, claim charts, chronologies, depo prep, privilege logs |
| `ip-legal` | Trademark clearance, FTO triage, invention intake, C&D and DMCA, OSS compliance |
| `law-student` | Case briefs, outlines, Socratic drilling, IRAC practice, bar prep |
| `legal-clinic` | Clinic setup, student onboarding, intake, deadlines, semester handoff |
| `legal-builder-hub` | Discover, security-review, and install community legal skills |

Not installed: `cocounsel-legal` (Thomson Reuters) — requires a Westlaw/CoCounsel
subscription and separate authorization.

## First run

Each plugin learns your playbook through a setup interview before its other skills
are useful:

```
/commercial-legal:cold-start-interview
```

The resulting practice profile is written to
`~/.claude/plugins/config/claude-for-legal/<plugin>/CLAUDE.md` and is read by every
skill in that plugin. Re-run the interview or edit the file to change it.

## Notes

- **Restart required.** Newly enabled plugins are not live until Claude Code restarts.
- **Context cost.** All 12 enabled add roughly 19.4k always-on tokens to every
  session, before any skill fires. Trim with `claude plugin disable <plugin>` for
  practice areas you don't use.
- **Citations.** Without a connected legal-research tool, citations come from
  training data and are marked `[verify]`. Connect one via the plugin's MCP servers.
- **Every output is a draft for attorney review.**
