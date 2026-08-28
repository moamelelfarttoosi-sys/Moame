#!/usr/bin/env node
'use strict';

/**
 * SessionEnd hook — persist what the next session needs to know.
 *
 * Writes `.claude/state/last-session.json` with the branch, the last commit,
 * how the session ended, and any next steps recovered from the transcript.
 */

const fs = require('fs');
const path = require('path');
const {
  repoRoot,
  stateDir,
  exists,
  readJson,
  writeJson,
  appendJsonl,
  run,
  redactSecrets,
  truncate,
  readStdinJson,
  emit,
  safeMain,
} = require('../lib/utils');

/** Pull the trailing user instructions out of a transcript, newest last. */
function extractNextSteps(transcriptPath, limit = 5) {
  if (!transcriptPath || !exists(transcriptPath)) return [];
  let lines;
  try {
    lines = fs.readFileSync(transcriptPath, 'utf8').split('\n').filter(Boolean);
  } catch {
    return [];
  }
  const steps = [];
  for (const line of lines.slice(-400)) {
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    const role = entry.role || (entry.message && entry.message.role);
    if (role !== 'user') continue;
    const content = entry.content || (entry.message && entry.message.content);
    const text = typeof content === 'string'
      ? content
      : Array.isArray(content)
        ? content.filter((c) => c && c.type === 'text').map((c) => c.text).join(' ')
        : '';
    const trimmed = text.trim();
    if (!trimmed || trimmed.startsWith('<')) continue;
    steps.push(truncate(redactSecrets(trimmed.split('\n')[0]), 200));
  }
  return steps.slice(-limit);
}

function gitSnapshot(root) {
  if (!exists(path.join(root, '.git'))) return {};
  const branch = run('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: root });
  const last = run('git', ['log', '-1', '--pretty=%h %s'], { cwd: root });
  const status = run('git', ['status', '--porcelain'], { cwd: root });
  return {
    branch: branch.ok ? branch.stdout : null,
    lastCommit: last.ok ? last.stdout : null,
    uncommittedFiles: status.ok ? status.stdout.split('\n').filter(Boolean).length : null,
  };
}

/** Build the record written to last-session.json. Exported for tests. */
function buildRecord(root, payload = {}) {
  const state = stateDir(root);
  const current = readJson(path.join(state, 'current-session.json')) || {};
  return {
    sessionId: payload.session_id || current.sessionId || null,
    startedAt: current.startedAt || null,
    endedAt: new Date().toISOString(),
    reason: payload.reason || 'unknown',
    ...gitSnapshot(root),
    nextSteps: extractNextSteps(payload.transcript_path),
  };
}

async function main() {
  const payload = await readStdinJson();
  const root = repoRoot(payload.cwd || process.cwd());
  const record = buildRecord(root, payload);
  const state = stateDir(root);
  writeJson(path.join(state, 'last-session.json'), record);
  appendJsonl(path.join(state, 'sessions.jsonl'), record);
  emit(undefined);
}

if (require.main === module) safeMain(main);

module.exports = { buildRecord, extractNextSteps, gitSnapshot };
