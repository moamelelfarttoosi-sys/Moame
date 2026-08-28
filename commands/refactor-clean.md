---
description: Find and remove dead code, unused exports and stale config, with proof
argument-hint: [optional path to scope the sweep]
---

# /refactor-clean

Clean up dead code in **$ARGUMENTS** (or the whole repo if no path given).

## Do this

1. Inventory candidates: unused exports, unreferenced files, commented-out blocks, duplicate helpers, unused dependencies, dead feature flags.
2. **Prove each one dead** before removing it:
   - `grep -rn "<symbol>" .` across source, tests, configs, docs and build scripts
   - check dynamic references: string-keyed lookups, barrel re-exports, DI containers, framework file conventions
   - if the package is published, a removed export is a breaking change — flag it instead of deleting
3. Remove in small steps, running build and tests after each.
4. Report each removal with the evidence, and each *kept* candidate with the reference that saved it.

## Constraints

- No behaviour changes in a cleanup pass. Found a bug? Report it separately.
- Do not touch files under active modification in the current diff.
- Delete rather than comment out.

Delegate to the `refactor-cleaner` agent for repo-wide sweeps.
