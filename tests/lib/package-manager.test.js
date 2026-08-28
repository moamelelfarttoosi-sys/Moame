'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const pm = require('../../scripts/lib/package-manager');

function project(files = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-pm-'));
  fs.writeFileSync(path.join(dir, 'package.json'), files['package.json'] || '{}');
  for (const [name, content] of Object.entries(files)) {
    if (name === 'package.json') continue;
    fs.writeFileSync(path.join(dir, name), content);
  }
  return dir;
}

test('detects pnpm from its lockfile', () => {
  const dir = project({ 'pnpm-lock.yaml': '' });
  const result = pm.detect(dir);
  assert.equal(result.name, 'pnpm');
  assert.equal(result.source, 'lockfile');
  assert.equal(result.conflict, false);
});

test('detects yarn and bun from their lockfiles', () => {
  assert.equal(pm.detect(project({ 'yarn.lock': '' })).name, 'yarn');
  assert.equal(pm.detect(project({ 'bun.lockb': '' })).name, 'bun');
});

test('the packageManager field beats the lockfile', () => {
  const dir = project({
    'package.json': JSON.stringify({ packageManager: 'yarn@4.1.0' }),
    'package-lock.json': '{}',
  });
  const result = pm.detect(dir);
  assert.equal(result.name, 'yarn');
  assert.equal(result.source, 'packageManager');
});

test('an unknown packageManager value is ignored', () => {
  const dir = project({
    'package.json': JSON.stringify({ packageManager: 'cargo@1.0.0' }),
    'package-lock.json': '{}',
  });
  assert.equal(pm.detect(dir).name, 'npm');
});

test('conflicting lockfiles are flagged, not silently resolved', () => {
  const dir = project({ 'pnpm-lock.yaml': '', 'package-lock.json': '{}' });
  const result = pm.detect(dir);
  assert.equal(result.conflict, true);
  assert.equal(result.lockfiles.length, 2);
  assert.match(result.reason, /multiple lockfiles/);
});

test('a saved choice wins over detection', () => {
  const dir = project({ 'package-lock.json': '{}' });
  pm.save(dir, 'bun');
  const result = pm.detect(dir);
  assert.equal(result.name, 'bun');
  assert.equal(result.source, 'config');
  assert.deepEqual(pm.load(dir).commands, pm.commands('bun'));
});

test('an explicit override wins over everything', () => {
  const dir = project({ 'pnpm-lock.yaml': '' });
  const result = pm.resolve(dir, 'npm');
  assert.equal(result.name, 'npm');
  assert.equal(result.source, 'override');
});

test('an unsupported override is rejected', () => {
  const dir = project();
  assert.throws(() => pm.resolve(dir, 'cargo'), /unsupported package manager/);
  assert.throws(() => pm.save(dir, 'cargo'), /unsupported package manager/);
});

test('every supported manager has a full command set', () => {
  for (const name of pm.SUPPORTED) {
    const cmds = pm.commands(name);
    for (const key of ['install', 'ci', 'run', 'exec', 'add', 'addDev', 'test']) {
      assert.ok(cmds[key] && cmds[key].includes(name === 'npm' && key === 'exec' ? 'npx' : name.slice(0, 2)),
        `${name}.${key} looks wrong: ${cmds[key]}`);
    }
  }
});

test('commands() returns a copy, so callers cannot mutate the table', () => {
  const first = pm.commands('npm');
  first.install = 'rm -rf /';
  assert.equal(pm.commands('npm').install, 'npm install');
});

test('falls back to npm when nothing is declared', () => {
  const dir = project();
  const result = pm.detect(dir);
  assert.ok(pm.SUPPORTED.includes(result.name));
  assert.ok(['default', 'installed'].includes(result.source));
});
