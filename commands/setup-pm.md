---
description: Detect and configure the package manager for this project
argument-hint: [optional: npm|pnpm|yarn|bun]
---

# /setup-pm

Configure the package manager for this repo.

## Do this

Run the setup script, which detects the manager from lockfiles, `packageManager` in `package.json`, and what is installed:

```bash
node scripts/setup-package-manager.js $ARGUMENTS
```

Then:

1. Report what was detected and why (which lockfile, which field).
2. If the user passed an explicit manager, honour it and write the choice to `.claude/package-manager.json`.
3. If the repo has **conflicting lockfiles**, stop and ask which one is authoritative — deleting the wrong lockfile is destructive.
4. Print the resolved commands (`install`, `run`, `exec`, `add`, `test`) so later steps in the session use the right ones.

## Constraints

- Never install a package manager without asking.
- Never delete a lockfile without explicit confirmation.
- The detected choice is written to `.claude/package-manager.json` and should be respected by every subsequent command in the session.
