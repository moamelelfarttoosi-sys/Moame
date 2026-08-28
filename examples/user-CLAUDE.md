# Personal preferences

Example user-level `CLAUDE.md` (`~/.claude/CLAUDE.md`). These apply across every project, so keep them about *how you want to be worked with*, not about any one repo.

## Communication

- Lead with the answer. Context after, if it is needed at all.
- Tell me what failed, with the output. Don't summarize a failure as "mostly working".
- If you are unsure, say which part you are unsure about rather than hedging the whole answer.
- No preamble ("Great question!"), no recap of what I just asked.

## Working style

- Ask before doing anything hard to reverse: deleting files, rewriting history, pushing, installing globally.
- Make routine judgement calls yourself; check in only when two readings would lead to materially different work.
- Finish the whole task. If part of it is blocked, do the rest and say exactly what you left out and why.
- Show me the diff of anything you write into my config files before writing it.

## Code

- Match the repo's existing style over your own preferences, always.
- Tests for logic; I do not need tests for layout.
- No dependency added without a one-line reason.
- Never use `--force`, `--no-verify`, or a suppression comment to get past a failure.

## Git

- Conventional commit subjects, imperative mood.
- Never commit or push unless I ask.
- Never commit to the default branch.

## Tools

- Prefer targeted `grep`/`glob` over dumping whole directories.
- Delegate wide searches to a subagent and give me the conclusion, not the file dumps.
