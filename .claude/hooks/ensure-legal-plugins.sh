#!/usr/bin/env bash
# SessionStart hook: ensure the claude-for-legal marketplace and its 12 plugins
# are installed at user scope.
#
# Why this exists: `.claude/settings.json` declares the marketplace and marks the
# plugins enabled, but `enabledPlugins` only enables plugins that are already on
# disk — it does not fetch them. In an ephemeral container (Claude Code on the
# web) `~/.claude` starts empty, so without this hook the plugins are absent.
#
# Fails soft by design: a missing network or CLI must never block session start.

set -uo pipefail

PLUGINS=(
  ai-governance-legal commercial-legal corporate-legal employment-legal
  ip-legal law-student legal-builder-hub legal-clinic
  litigation-legal privacy-legal product-legal regulatory-legal
)
MARKETPLACE=claude-for-legal
SOURCE=anthropics/claude-for-legal
STATE="${HOME}/.claude/plugins/installed_plugins.json"
LOCK="${HOME}/.claude/plugins/.ensure-legal-plugins.lock"

command -v claude >/dev/null 2>&1 || exit 0

# Fast path: every plugin already recorded at user scope -> nothing to do.
if [[ -r "$STATE" ]] && python3 - "$STATE" "${PLUGINS[@]}" <<'PY' 2>/dev/null
import json, sys
state, wanted = sys.argv[1], sys.argv[2:]
try:
    plugins = json.load(open(state)).get("plugins", {})
except Exception:
    sys.exit(1)
# Present under ANY scope is good enough: Claude Code also installs these
# project-scoped by syncing .claude/settings.json at session start. Only act
# when a plugin is genuinely absent, so this stays a no-op in the normal case.
missing = [
    name for name in wanted
    if not plugins.get(f"{name}@claude-for-legal")
]
sys.exit(1 if missing else 0)
PY
then
  exit 0
fi

# Single-flight: if another session is already installing, don't pile on.
mkdir "$LOCK" 2>/dev/null || exit 0
trap 'rmdir "$LOCK" 2>/dev/null' EXIT

echo "claude-for-legal: restoring marketplace and plugins..." >&2
timeout 180 claude plugin marketplace add "$SOURCE" --scope user >/dev/null 2>&1 \
  || timeout 120 claude plugin marketplace update "$MARKETPLACE" >/dev/null 2>&1

for p in "${PLUGINS[@]}"; do
  timeout 120 claude plugin install "${p}@${MARKETPLACE}" --scope user >/dev/null 2>&1 \
    || echo "claude-for-legal: could not install ${p}" >&2
done

echo "claude-for-legal: done (restart Claude Code if commands are missing)." >&2
exit 0
