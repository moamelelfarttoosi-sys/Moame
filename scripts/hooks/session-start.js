#!/usr/bin/env node
'use strict';

/**
 * SessionStart hook — load durable context so a new session starts informed.
 *
 * Reads the previous session's summary, the newest checkpoint, any captured
 * lessons and the current git state, and returns them as additional context.
 */

const fs = require('fs');
const path = require('path');
const {
  repoRoot,
  stateDir,
  claudeDir,
  exists,
  readJson,
  run,
  truncate,
  readStdinJson,
  emit,
  safeMain,
} = require('../lib/utils');
const pm = require('../lib/package-manager');

function gitContext(root) {
  if (!exists(path.join(root, '.git'))) return null;
  const branch = run('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: root });
  const status = run('git', ['status', '--porcelain'], { cwd: root });
  const last = run('git', ['log', '-1', '--pretty=%h %s'], { cwd: root });
  if (!branch.ok) return null;
  const changed = status.ok ? status.stdout.split('\n').filter(Boolean).length : 0;
  return {
    branch: branch.stdout,
    changedFiles: changed,
    lastCommit: last.ok ? last.stdout : null,
  };
}

function newestFile(dir, suffix) {
  if (!exists(dir)) return null;
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(suffix))
    .sort();
  return files.length ? path.join(dir, files[files.length - 1]) : null;
}

/** Build the context block. Exported so tests can call it without a hook payload. */
function buildContext(root = repoRoot(), { maxChars = 4000 } = {}) {
  const sections = [];
  const state = stateDir(root);

  const previous = readJson(path.join(state, 'last-session.json'));
  if (previous) {
    const when = previous.endedAt || previous.startedAt || 'unknown time';
    const lines = [`Previous session ended ${when}.`];
    if (previous.branch) lines.push(`Branch: ${previous.branch}`);
    if (previous.lastCommit) lines.push(`Last commit: ${previous.lastCommit}`);
    if (previous.summary) lines.push(`Summary: ${previous.summary}`);
    if (Array.isArray(previous.nextSteps) && previous.nextSteps.length) {
      lines.push('Next steps carried over:');
      previous.nextSteps.forEach((s) => lines.push(`  - ${s}`));
    }
    sections.push(`## Previous session\n${lines.join('\n')}`);
  }

  const checkpoint = newestFile(path.join(claudeDir(root), 'checkpoints'), '.md');
  if (checkpoint) {
    sections.push(
      `## Latest checkpoint (${path.basename(checkpoint)})\n${truncate(
        fs.readFileSync(checkpoint, 'utf8'),
        1500
      )}`
    );
  }

  const lessons = newestFile(state, '-lessons.md');
  if (lessons) {
    sections.push(`## Lessons captured previously\n${truncate(fs.readFileSync(lessons, 'utf8'), 1200)}`);
  }

  const git = gitContext(root);
  if (git) {
    sections.push(
      `## Repository state\nBranch: ${git.branch}\nUncommitted files: ${git.changedFiles}` +
        (git.lastCommit ? `\nHEAD: ${git.lastCommit}` : '')
    );
  }

  if (exists(path.join(root, 'package.json'))) {
    const detected = pm.detect(root);
    const cmds = pm.commands(detected.name);
    sections.push(
      `## Package manager\n${detected.name} — ${detected.reason}.\n` +
        `Use \`${cmds.install}\`, \`${cmds.run} <script>\`, \`${cmds.test}\`.` +
        (detected.conflict ? '\nWARNING: multiple lockfiles present — ask which is authoritative before installing.' : '')
    );
  }

  if (!sections.length) return '';
  return truncate(`# Session context (everything-claude-code)\n\n${sections.join('\n\n')}`, maxChars);
}

async function main() {
  const payload = await readStdinJson();
  const root = repoRoot(payload.cwd || process.cwd());
  const additionalContext = buildContext(root);

  // Record that this session started, so session-end can measure it.
  const started = {
    sessionId: payload.session_id || null,
    startedAt: new Date().toISOString(),
    source: payload.source || null,
    branch: (gitContext(root) || {}).branch || null,
  };
  try {
    require('../lib/utils').writeJson(path.join(stateDir(root), 'current-session.json'), started);
  } catch {
    /* state is best-effort */
  }

  if (!additionalContext) return emit(undefined);
  emit({
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext,
    },
  });
}

if (require.main === module) safeMain(main);

module.exports = { buildContext, gitContext, newestFile };
