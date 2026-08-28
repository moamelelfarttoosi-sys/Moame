#!/usr/bin/env node
'use strict';

/**
 * PreCompact hook — write a handoff note before context is discarded.
 *
 * Compaction is lossy. This saves the facts that are expensive to rediscover
 * (branch, verification commands, open work) to a file on disk, and points the
 * post-compaction session at it.
 */

const path = require('path');
const pm = require('../lib/package-manager');
const {
  repoRoot,
  stateDir,
  exists,
  readJson,
  writeText,
  run,
  fileTimestamp,
  readStdinJson,
  emit,
  safeMain,
} = require('../lib/utils');

/** Verification commands this repo actually defines, best-effort. */
function verificationCommands(root) {
  const pkg = readJson(path.join(root, 'package.json'));
  if (!pkg || !pkg.scripts) return [];
  const interesting = ['test', 'typecheck', 'type-check', 'lint', 'build', 'e2e'];
  return Object.keys(pkg.scripts).filter((s) => interesting.includes(s));
}

/** Render the handoff note. Exported so tests can assert on its shape. */
function buildNote(root, payload = {}) {
  const when = new Date().toISOString();
  const hasGit = exists(path.join(root, '.git'));
  const branchResult = hasGit ? run('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: root }) : null;
  const branch = branchResult && branchResult.ok ? branchResult.stdout : null;
  const statusResult = hasGit ? run('git', ['status', '--porcelain'], { cwd: root }) : null;
  const status = statusResult && statusResult.ok ? statusResult.stdout.split('\n').filter(Boolean) : [];
  const scripts = verificationCommands(root);
  const runCmd = pm.commands(pm.detect(root).name).run;
  const triggerNote = payload.trigger === 'manual' ? 'user ran /compact' : 'context limit reached';

  const lines = [
    `# Pre-compaction handoff — ${when}`,
    '',
    `Trigger: ${payload.trigger || 'unknown'} (${triggerNote})`,
    branch ? `Branch: ${branch}` : null,
    '',
    '## Working tree at compaction',
    '',
    status.length ? status.slice(0, 40).map((l) => `- ${l}`).join('\n') : '- clean',
    '',
    '## Verification commands available',
    '',
    scripts.length ? scripts.map((s) => `- ${runCmd} ${s}`).join('\n') : '- none declared in package.json',
    '',
    '## Carry forward',
    '',
    "- The goal in the user's own words, and their stated constraints",
    '- Decisions already made, and the options rejected',
    '- The exact next step',
    '',
    payload.custom_instructions
      ? `## Compaction instructions given\n\n${payload.custom_instructions}\n`
      : null,
  ];

  return `${lines.filter((l) => l !== null).join('\n')}\n`;
}

async function main() {
  const payload = await readStdinJson();
  const root = repoRoot(payload.cwd || process.cwd());
  const file = path.join(stateDir(root), `${fileTimestamp()}-precompact.md`);
  writeText(file, buildNote(root, payload));
  emit({
    hookSpecificOutput: {
      hookEventName: 'PreCompact',
      additionalContext: `A pre-compaction handoff note was saved to ${path.relative(root, file)}. Read it if context after compaction is missing repository facts.`,
    },
  });
}

if (require.main === module) safeMain(main);

module.exports = { buildNote, verificationCommands };
