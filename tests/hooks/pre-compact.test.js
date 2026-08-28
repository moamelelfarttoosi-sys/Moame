'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const hook = require('../../scripts/hooks/pre-compact');

function project(pkg = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-precompact-'));
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pkg));
  return dir;
}

test('the note records the trigger and the carry-forward checklist', () => {
  const note = hook.buildNote(project(), { trigger: 'manual' });
  assert.match(note, /# Pre-compaction handoff/);
  assert.match(note, /Trigger: manual \(user ran \/compact\)/);
  assert.match(note, /## Carry forward/);
  assert.match(note, /The exact next step/);
});

test('an automatic trigger is labelled as the context limit', () => {
  assert.match(hook.buildNote(project(), { trigger: 'auto' }), /context limit reached/);
});

test('verification commands come from package.json scripts and use the project package manager', () => {
  const dir = project({ scripts: { test: 'vitest', build: 'tsc', deploy: 'ship' } });
  assert.deepEqual(hook.verificationCommands(dir).sort(), ['build', 'test']);
  const note = hook.buildNote(dir, {});
  assert.match(note, /^- \S+ run test$/m);
  assert.doesNotMatch(note, /run deploy/);
});

test('the run command matches the detected package manager', () => {
  const dir = project({ scripts: { test: 'vitest' } });
  fs.writeFileSync(path.join(dir, 'pnpm-lock.yaml'), '');
  assert.match(hook.buildNote(dir, {}), /- pnpm run test/);
});

test('a project without scripts says so instead of inventing commands', () => {
  assert.match(hook.buildNote(project(), {}), /none declared in package.json/);
});

test('custom compaction instructions are preserved verbatim', () => {
  const note = hook.buildNote(project(), { custom_instructions: 'keep the migration plan' });
  assert.match(note, /## Compaction instructions given/);
  assert.match(note, /keep the migration plan/);
});

test('the note is valid markdown with blank lines between sections', () => {
  const note = hook.buildNote(project(), {});
  assert.match(note, /\n\n## Working tree at compaction\n\n/);
  assert.ok(note.endsWith('\n'));
});
