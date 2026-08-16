# Upstream provenance

This repository is a **vendored copy** of
[guillaumemeyer/watermarks-remover](https://github.com/guillaumemeyer/watermarks-remover),
installed so the `remove-ai-marks` agent skill can be used from this repo.

| | |
| --- | --- |
| Upstream | `https://github.com/guillaumemeyer/watermarks-remover` |
| Pinned commit | `fcebf533583d7a313b348dbe421f3b4b17163b66` |
| Commit date | 2026-08-15 |
| Upstream subject | `feat: add native stdlib AVIF and HEIC metadata and C2PA stripping (#84) (#85)` |
| License | MIT (see `LICENSE`) |

Everything outside the "Local changes" list below is upstream's tree, byte for
byte. `README.md` is upstream's documentation and all the commands in it work
from this repo root unchanged.

## Local changes

Kept deliberately small so re-vendoring is a directory swap plus a short
re-apply.

1. **`.claude/skills/remove-ai-marks`** — relative symlink to
   `skills/remove-ai-marks`, which is how Claude Code discovers a project
   skill. Upstream documents the same pattern for `.grok/skills`.
2. **`.gitignore`** — upstream's allowlist is deny-by-default (`/*` then
   explicit `!` rules), so a "local additions" block was appended to allow
   `.claude/`, `integrations/`, `install_skill.py`, `install-skill.sh` and this
   file.

   The same block also **fixes a latent upstream bug**. `/*` excludes
   `/skills`, and git will not re-include a path whose parent directory is
   excluded, so upstream's `!/skills/remove-ai-marks/**` never fires — in a
   fresh copy every skill file is silently untracked, and `git add -A` commits
   the service without the skill. Upstream does not hit this because those
   files are already tracked there. The fix re-includes the directory so git
   descends into it, then restores deny-by-default one level down:

   ```gitignore
   !/skills/
   /skills/*
   !/skills/remove-ai-marks/
   !/skills/clean-user-facing-text/
   ```
3. **`README.md`** — a four-line provenance banner prepended above upstream's
   logo. The rest of the file is upstream's, unchanged.
4. **`UPSTREAM.md`** — this file.

No upstream source file under `service/`, `skills/`, `tests/`, `docs/`,
`integrations/` or `.github/` was modified.

## Installing the skill

### Claude Code (already done in this repo)

The symlink is committed, so a clone on Linux or macOS gets the skill with no
setup. Invoke it with `/remove-ai-marks`, or ask to "strip AI watermarks /
C2PA / Claude marks".

For a user-global install instead of project-local:

```bash
mkdir -p ~/.claude/skills
ln -sfn "$(pwd)/skills/remove-ai-marks" ~/.claude/skills/remove-ai-marks
```

On Windows, `git` checks symlinks out as plain text files unless
`core.symlinks=true`. Copy the directory instead:

```powershell
Copy-Item -Recurse skills\remove-ai-marks $env:USERPROFILE\.claude\skills\remove-ai-marks
```

### Grok / Cursor

Upstream's own instructions in `README.md` apply unchanged from this repo root
(`.grok/skills`, and `python3 install_skill.py` for the optional Cursor
text-only skill).

## The service is required

The skill ships no cleaning code — it is a thin HTTP client and will refuse to
clean locally. Start the service before invoking it:

```bash
make serve                 # http://127.0.0.1:8765
# or: python3 service/scripts/server.py --host 127.0.0.1 --port 8765
# or: docker compose up -d
```

Point the skill elsewhere with `WATERMARKS_SERVICE_URL`.

### Verified in this environment

Python 3.11.15, stdlib only:

- `GET /health` → `{"ok": true, "version": "dev"}`
- `POST /inspect` on Markdown containing `U+00AD`, `U+200B`, `U+2060` → all
  three reported, confidence `probable`
- `POST /clean` on the same input → `removed=3 replaced=0`, clean bytes returned
- `python3 -m pytest` → 280 passed, 1 skipped

`c2patool`, `exiftool` and `qpdf` are **not** installed here, so
`/capabilities` reports them false and PDF stripping is best-effort only. The
core Docker image (`make docker-core-build`) ships all three.

## Updating to a newer upstream

```bash
git clone --depth 1 https://github.com/guillaumemeyer/watermarks-remover.git /tmp/wr
rsync -a --delete --exclude .git --exclude .claude --exclude UPSTREAM.md /tmp/wr/ .
```

Then re-apply the `.gitignore` block and the `README.md` banner, confirm
`.claude/skills/remove-ai-marks` still resolves, run `python3 -m pytest`, and
update the pinned commit in the table at the top.
