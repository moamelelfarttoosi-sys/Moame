'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const hook = require('../../scripts/hooks/session-end');

function transcript(entries) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-end-'));
  const file = path.join(dir, 'transcript.jsonl');
  fs.writeFileSync(file, entries.map((e) => JSON.stringify(e)).join('\n'));
  return file;
}

test('extractNextSteps keeps the last user instructions in order', () => {
  const file = transcript([
    { role: 'user', content: 'Add the refund guard' },
    { role: 'assistant', content: 'done' },
    { role: 'user', content: 'Now write the E2E test' },
  ]);
  assert.deepEqual(hook.extractNextSteps(file), ['Add the refund guard', 'Now write the E2E test']);
});

test('extractNextSteps handles the structured message shape', () => {
  const file = transcript([
    { message: { role: 'user', content: [{ type: 'text', text: 'Use pnpm here' }] } },
  ]);
  assert.deepEqual(hook.extractNextSteps(file), ['Use pnpm here']);
});

test('extractNextSteps skips system-reminder style turns', () => {
  const file = transcript([
    { role: 'user', content: '<system-reminder>ignore me</system-reminder>' },
    { role: 'user', content: 'real instruction' },
  ]);
  assert.deepEqual(hook.extractNextSteps(file), ['real instruction']);
});

test('extractNextSteps respects the limit and takes the most recent', () => {
  const file = transcript(
    Array.from({ length: 10 }, (_, i) => ({ role: 'user', content: `step ${i}` }))
  );
  assert.deepEqual(hook.extractNextSteps(file, 2), ['step 8', 'step 9']);
});

test('extractNextSteps redacts credentials that appear in instructions', () => {
  const file = transcript([{ role: 'user', content: 'deploy with token ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ12' }]);
  const [step] = hook.extractNextSteps(file);
  assert.ok(!step.includes('ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ12'));
  assert.match(step, /REDACTED/);
});

test('extractNextSteps tolerates a missing or corrupt transcript', () => {
  assert.deepEqual(hook.extractNextSteps(null), []);
  assert.deepEqual(hook.extractNextSteps('/nope/transcript.jsonl'), []);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-end-'));
  const file = path.join(dir, 't.jsonl');
  fs.writeFileSync(file, 'not json\n{"role":"user","content":"ok"}');
  assert.deepEqual(hook.extractNextSteps(file), ['ok']);
});

test('buildRecord always produces a timestamped record', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-end-repo-'));
  fs.writeFileSync(path.join(dir, 'package.json'), '{}');
  const record = hook.buildRecord(dir, { session_id: 'abc', reason: 'clear' });
  assert.equal(record.sessionId, 'abc');
  assert.equal(record.reason, 'clear');
  assert.ok(Date.parse(record.endedAt));
  assert.deepEqual(record.nextSteps, []);
});

test('gitSnapshot returns an empty object outside a repository', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-end-nogit-'));
  assert.deepEqual(hook.gitSnapshot(dir), {});
});
