---
description: Review the current diff for correctness, contracts, tests and clarity
argument-hint: [optional base branch or path]
---

# /code-review

Review the pending changes (**$ARGUMENTS** if given, otherwise `git diff` plus staged changes).

## Do this

1. Get the diff. If a base branch was given, use `git diff <base>...HEAD`.
2. Read enough surrounding code to judge each hunk in context.
3. For each candidate finding, construct the concrete failure — inputs, state, wrong result. Drop anything you cannot make concrete.
4. Report, most severe first:

```
### [High] <one-line claim>
`path/file.ts:88`
Why it breaks, with the failing scenario.
Fix: <the change>
```

5. End with a one-line verdict: **ship** / **ship with nits** / **hold**.

## Constraints

- No style nits the formatter or linter already owns.
- No summary of what the diff does; the author wrote it.
- A clean diff gets a one-line review. That is a valid result.

Run `/security-review`-style checks too if the diff touches auth, user input, file paths, or outbound requests — or delegate to the `security-reviewer` agent.
