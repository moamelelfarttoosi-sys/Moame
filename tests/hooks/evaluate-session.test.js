'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const hook = require('../../scripts/hooks/evaluate-session');

test('user corrections are captured as lessons', () => {
  const lessons = hook.extractLessons([
    { role: 'user', content: 'No, we always run migrations with pnpm db:migrate' },
    { role: 'assistant', content: 'understood' },
    { role: 'user', content: "don't edit files under generated/" },
  ]);
  assert.equal(lessons.length, 2);
  assert.match(lessons[0], /pnpm db:migrate/);
  assert.match(lessons[1], /generated\//);
});

test('ordinary instructions are not mistaken for lessons', () => {
  const lessons = hook.extractLessons([
    { role: 'user', content: 'Add a refund endpoint' },
    { role: 'user', content: 'Looks good, ship it' },
  ]);
  assert.deepEqual(lessons, []);
});

test('assistant turns are ignored', () => {
  const lessons = hook.extractLessons([
    { role: 'assistant', content: 'No, we always use pnpm in this repo' },
  ]);
  assert.deepEqual(lessons, []);
});

test('duplicate corrections are collapsed', () => {
  const lessons = hook.extractLessons([
    { role: 'user', content: 'we always use pnpm' },
    { role: 'user', content: 'We  always  use  pnpm' },
  ]);
  assert.equal(lessons.length, 1);
});

test('no more than five lessons are proposed', () => {
  const entries = Array.from({ length: 12 }, (_, i) => ({
    role: 'user',
    content: `don't use approach number ${i} in this codebase`,
  }));
  assert.equal(hook.extractLessons(entries).length, 5);
});

test('credentials inside a correction are redacted', () => {
  const [lesson] = hook.extractLessons([
    { role: 'user', content: 'we always use api_key: "sk-ABCDEFGHIJKLMNOP1234" for staging' },
  ]);
  assert.ok(lesson, 'expected the correction to be captured');
  assert.ok(!lesson.includes('sk-ABCDEFGHIJKLMNOP1234'));
  assert.match(lesson, /REDACTED/);
});

test('the structured content shape is supported', () => {
  const lessons = hook.extractLessons([
    { message: { role: 'user', content: [{ type: 'text', text: 'in this repo tests need TZ=UTC set' }] } },
  ]);
  assert.equal(lessons.length, 1);
});

test('the report is a review document, not an applied change', () => {
  const report = hook.buildReport(['we always use pnpm'], { sessionId: 'abc' });
  assert.match(report, /# Session lessons/);
  assert.match(report, /Review before accepting/);
  assert.match(report, /- we always use pnpm/);
  assert.match(report, /Session: abc/);
});

test('an empty session produces an explicit "nothing found" report', () => {
  assert.match(hook.buildReport([]), /Nothing durable and repo-specific/);
});

test('readTranscript tolerates missing files and corrupt lines', () => {
  assert.deepEqual(hook.readTranscript('/nope/t.jsonl'), []);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-eval-'));
  const file = path.join(dir, 't.jsonl');
  fs.writeFileSync(file, '{"role":"user","content":"a"}\nbroken\n{"role":"user","content":"b"}');
  assert.equal(hook.readTranscript(file).length, 2);
});
