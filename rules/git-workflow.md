# Git Workflow Rules

## Commits

- Conventional commits: `type(scope): subject`
  - `feat` `fix` `refactor` `perf` `test` `docs` `chore` `build` `ci`
- Subject: imperative, lower case, no trailing period, under 72 characters.
- Body: *why*, not what. The diff already says what.
- One logical change per commit. A commit that needs "and" in its subject is two commits.
- Never commit generated artifacts, `.env`, credentials, or editor config that belongs in a global ignore.

```
fix(auth): reject expired refresh tokens

The refresh path checked signature but not exp, so a leaked token
stayed valid indefinitely. Adds the expiry check and a regression test.
```

## Branches

- Branch from the default branch; never commit directly to it.
- Name as `type/short-description`: `fix/expired-refresh-token`.
- Rebase your own branch to keep it current. **Never** rewrite history on a branch someone else may have checked out — merge the base branch in instead.

## Before pushing

1. The build passes.
2. The tests pass.
3. Lint and typecheck pass.
4. You have re-read your own diff.

Never use `--no-verify`. If a hook is wrong, fix the hook.

## Pull requests

- Title: the same convention as the commit subject.
- Body: what changed, why, how it was verified, and anything a reviewer should look at hard.
- Keep PRs small enough to review in one sitting. Split mechanical changes from behavioural ones.
- Only open a PR when the user asks for one.

## Responding to review

- Address every comment: implement it, or reply with the reason it does not apply.
- Push fixes rather than describing them.
- Re-request review after pushing for a changes-requested review.
- A red CI on your own PR is work now, not "waiting on review".
