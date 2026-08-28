'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const hook = require('../../scripts/hooks/session-start');

function project() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-start-'));
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'x', scripts: { test: 'x' } }));
  return dir;
}

function writeState(dir, name, content) {
  const file = path.join(dir, '.claude', 'state', name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  return file;
}

test('a repo with no history produces context about the package manager only', () => {
  const dir = project();
  const context = hook.buildContext(dir);
  assert.match(context, /## Package manager/);
  assert.doesNotMatch(context, /## Previous session/);
});

test('the previous session summary and next steps are carried forward', () => {
  const dir = project();
  writeState(
    dir,
    'last-session.json',
    JSON.stringify({
      endedAt: '2026-08-27T10:00:00.000Z',
      branch: 'feat/refunds',
      summary: 'Refund guard implemented, E2E still missing.',
      nextSteps: ['Add the over-refund E2E case'],
    })
  );
  const context = hook.buildContext(dir);
  assert.match(context, /## Previous session/);
  assert.match(context, /feat\/refunds/);
  assert.match(context, /Add the over-refund E2E case/);
});

test('the newest checkpoint is included, older ones are not', () => {
  const dir = project();
  const checkpoints = path.join(dir, '.claude', 'checkpoints');
  fs.mkdirSync(checkpoints, { recursive: true });
  fs.writeFileSync(path.join(checkpoints, '2026-01-01-old.md'), 'OLD CHECKPOINT');
  fs.writeFileSync(path.join(checkpoints, '2026-08-01-new.md'), 'NEW CHECKPOINT');
  const context = hook.buildContext(dir);
  assert.match(context, /NEW CHECKPOINT/);
  assert.doesNotMatch(context, /OLD CHECKPOINT/);
});

test('a conflicting lockfile set produces a warning', () => {
  const dir = project();
  fs.writeFileSync(path.join(dir, 'pnpm-lock.yaml'), '');
  fs.writeFileSync(path.join(dir, 'package-lock.json'), '{}');
  assert.match(hook.buildContext(dir), /multiple lockfiles/i);
});

test('context is capped so it cannot flood the session', () => {
  const dir = project();
  writeState(dir, 'last-session.json', JSON.stringify({ summary: 'x'.repeat(20000) }));
  const context = hook.buildContext(dir, { maxChars: 500 });
  assert.ok(context.length < 700, `context was ${context.length} chars`);
});

test('newestFile returns null for a directory that does not exist', () => {
  assert.equal(hook.newestFile('/nope/nope', '.md'), null);
});

test('gitContext is null outside a repository', () => {
  assert.equal(hook.gitContext(project()), null);
});
