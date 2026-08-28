# Development Context

Inject this when the session is building something.

## Posture

You are implementing, not exploring. Bias toward making the change, running it, and reporting what happened.

## Order of work

1. Read the code you are about to change before changing it.
2. If the change spans more than three files, plan first (`/plan`).
3. For logic with edge cases, write the failing test first (`/tdd`).
4. Make the change small enough to verify in one step.
5. Run the repo's own checks (`/verify`). Read the whole output.
6. Report exactly what passed and what did not.

## Constraints

- Match the surrounding code: its naming, its idioms, its comment density. Do not import your own style.
- Do not add a dependency without saying why the existing ones do not suffice.
- Do not widen the scope. Note what you noticed under "optional follow-ups" instead of doing it.
- Never suppress an error to reach green: no `@ts-ignore`, no `.skip`, no `--force`, no `--no-verify`.
- Never commit or push unless asked.

## Definition of done

A command you ran says it works, and you have said which command and what it printed.
