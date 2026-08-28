#!/usr/bin/env node
'use strict';

/**
 * Run every `*.test.js` under tests/ with the built-in Node test runner.
 * No dependencies: `node tests/run-all.js` is the whole story.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const [major] = process.versions.node.split('.').map(Number);
if (major < 18) {
  process.stderr.write(`Node >= 18 required for the test runner (found ${process.versions.node}).\n`);
  process.exit(1);
}

const root = path.resolve(__dirname, '..');

function collect(dir, found = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collect(full, found);
    else if (entry.isFile() && entry.name.endsWith('.test.js')) found.push(path.relative(root, full));
  }
  return found;
}

const files = collect(__dirname).sort();
if (!files.length) {
  process.stderr.write('No test files found under tests/.\n');
  process.exit(1);
}

process.stdout.write(`Running ${files.length} test file(s)\n`);
const result = spawnSync(process.execPath, ['--test', ...files], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
});

process.exit(result.status === null ? 1 : result.status);
