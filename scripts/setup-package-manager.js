#!/usr/bin/env node
'use strict';

/**
 * Detect (or set) the package manager for this project and persist the choice
 * to `.claude/package-manager.json`.
 *
 *   node scripts/setup-package-manager.js            # detect and save
 *   node scripts/setup-package-manager.js pnpm       # force a choice
 *   node scripts/setup-package-manager.js --dry-run  # report only
 *   node scripts/setup-package-manager.js --json     # machine-readable
 */

const path = require('path');
const { repoRoot, exists } = require('./lib/utils');
const pm = require('./lib/package-manager');

function parseArgs(argv) {
  const args = { override: null, dryRun: false, json: false, help: false };
  for (const raw of argv) {
    const arg = String(raw).trim();
    if (!arg) continue;
    if (arg === '--dry-run' || arg === '-n') args.dryRun = true;
    else if (arg === '--json') args.json = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
    else if (arg.startsWith('-')) continue;
    else args.override = arg.toLowerCase();
  }
  return args;
}

const HELP = `setup-package-manager — configure the package manager for this project

Usage: node scripts/setup-package-manager.js [${pm.SUPPORTED.join('|')}] [--dry-run] [--json]

Precedence: explicit argument > .claude/package-manager.json > package.json
"packageManager" field > lockfile > installed binary > npm.`;

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    process.stdout.write(`${HELP}\n`);
    return 0;
  }

  const root = repoRoot();
  if (!exists(path.join(root, 'package.json'))) {
    process.stdout.write(`No package.json under ${root} — nothing to configure.\n`);
    return 0;
  }

  let resolved;
  try {
    resolved = pm.resolve(root, args.override);
  } catch (err) {
    process.stderr.write(`${err.message}\n`);
    return 1;
  }

  const cmds = pm.commands(resolved.name);

  if (resolved.conflict && !args.override) {
    const files = resolved.lockfiles.map((l) => l.file).join(', ');
    process.stderr.write(
      `Conflicting lockfiles present: ${files}\n` +
        'Refusing to guess. Re-run with an explicit manager, e.g.\n' +
        `  node scripts/setup-package-manager.js ${resolved.name}\n` +
        'and delete the other lockfile yourself once you are sure.\n'
    );
    return 2;
  }

  if (!args.dryRun) pm.save(root, resolved.name, { detectedBy: resolved.source });

  if (args.json) {
    process.stdout.write(`${JSON.stringify({ ...resolved, commands: cmds, saved: !args.dryRun }, null, 2)}\n`);
    return 0;
  }

  process.stdout.write(
    [
      `Package manager: ${resolved.name}`,
      `Detected from:   ${resolved.reason}`,
      args.dryRun ? 'Dry run — nothing written.' : `Saved to:        ${path.relative(root, pm.configPath(root))}`,
      '',
      'Commands to use for the rest of this session:',
      `  install   ${cmds.install}`,
      `  ci        ${cmds.ci}`,
      `  run       ${cmds.run} <script>`,
      `  exec      ${cmds.exec} <binary>`,
      `  add       ${cmds.add} <package>`,
      `  test      ${cmds.test}`,
      '',
    ].join('\n')
  );
  return 0;
}

if (require.main === module) process.exitCode = main();

module.exports = { main, parseArgs, HELP };
