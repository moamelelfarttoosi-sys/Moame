---
description: Diagnose and fix a failing build, typecheck, or compile step
argument-hint: [optional build command]
---

# /build-fix

Fix the failing build (**$ARGUMENTS** if a command was given, otherwise discover the repo's build and typecheck commands).

## Do this

1. Reproduce: run the command, capture the full output.
2. Address the **first** error — cascades usually have one origin.
3. Find the cause in the source: changed signature, missing export, moved file, version bump, stale generated artifact.
4. Fix minimally. Re-run the same command. Paste the clean output.
5. Then run the test suite to confirm the fix did not trade a type error for a behaviour bug.

## Forbidden

`@ts-ignore` · `@ts-expect-error` · `any` · `# type: ignore` · `eslint-disable` · loosening `tsconfig` strictness · deleting the failing file or test · `--force`.

If suppression really is correct (upstream bug), say so, scope it to one line, and comment the reason with a link.

Delegate to the `build-error-resolver` agent for large cascades.
