'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const utils = require('../../scripts/lib/utils');

function tmpdir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-utils-'));
}

test('readJson returns the fallback for a missing file', () => {
  assert.deepEqual(utils.readJson('/definitely/not/here.json', { a: 1 }), { a: 1 });
});

test('readJson returns the fallback for malformed JSON', () => {
  const dir = tmpdir();
  const file = path.join(dir, 'bad.json');
  fs.writeFileSync(file, '{ not json');
  assert.equal(utils.readJson(file, null), null);
});

test('writeJson round-trips and leaves no temp file behind', () => {
  const dir = tmpdir();
  const file = path.join(dir, 'nested', 'state.json');
  utils.writeJson(file, { hello: 'world' });
  assert.deepEqual(utils.readJson(file), { hello: 'world' });
  assert.deepEqual(
    fs.readdirSync(path.dirname(file)).filter((f) => f.endsWith('.tmp')),
    []
  );
});

test('appendJsonl and readJsonl keep order and skip corrupt lines', () => {
  const dir = tmpdir();
  const file = path.join(dir, 'log.jsonl');
  utils.appendJsonl(file, { n: 1 });
  fs.appendFileSync(file, 'corrupt\n');
  utils.appendJsonl(file, { n: 2 });
  assert.deepEqual(utils.readJsonl(file), [{ n: 1 }, { n: 2 }]);
  assert.deepEqual(utils.readJsonl(file, 1), [{ n: 2 }]);
});

test('readJsonl returns [] for a missing file', () => {
  assert.deepEqual(utils.readJsonl('/nope/nope.jsonl'), []);
});

test('repoRoot walks up to the nearest marker', () => {
  const dir = tmpdir();
  const nested = path.join(dir, 'a', 'b', 'c');
  fs.mkdirSync(nested, { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), '{}');
  assert.equal(fs.realpathSync(utils.repoRoot(nested)), fs.realpathSync(dir));
});

test('repoRoot falls back to the start directory when no marker exists', () => {
  const dir = fs.realpathSync(tmpdir());
  const found = fs.realpathSync(utils.repoRoot(dir));
  // Either the tmpdir itself or an ancestor that happens to have a marker.
  assert.ok(dir === found || dir.startsWith(found));
});

test('redactSecrets removes common credential shapes', () => {
  const redacted = utils.redactSecrets(
    'token=ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ12 and api_key: "abcdefgh12345678" and AKIAIOSFODNN7EXAMPLE'
  );
  assert.ok(!redacted.includes('ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ12'));
  assert.ok(!redacted.includes('abcdefgh12345678'));
  assert.ok(!redacted.includes('AKIAIOSFODNN7EXAMPLE'));
  assert.ok(redacted.includes('[REDACTED]'));
});

test('redactSecrets leaves ordinary prose alone', () => {
  const text = 'The refund path validates the amount before charging.';
  assert.equal(utils.redactSecrets(text), text);
});

test('truncate marks how much was dropped', () => {
  const out = utils.truncate('x'.repeat(50), 10);
  assert.ok(out.startsWith('xxxxxxxxxx'));
  assert.match(out, /40 more characters/);
});

test('truncate leaves short strings untouched', () => {
  assert.equal(utils.truncate('short', 100), 'short');
  assert.equal(utils.truncate(null), '');
});

test('fileTimestamp is filesystem safe', () => {
  const stamp = utils.fileTimestamp(new Date('2026-08-28T07:00:00.000Z'));
  assert.equal(stamp, '2026-08-28T07-00-00-000');
  assert.ok(!/[:.]/.test(stamp));
});

test('run executes without a shell and reports failure cleanly', () => {
  const ok = utils.run(process.execPath, ['-e', 'process.stdout.write("hi")']);
  assert.equal(ok.ok, true);
  assert.equal(ok.stdout, 'hi');

  const bad = utils.run(process.execPath, ['-e', 'process.exit(3)']);
  assert.equal(bad.ok, false);
  assert.equal(bad.status, 3);

  const missing = utils.run('definitely-not-a-real-binary-xyz', []);
  assert.equal(missing.ok, false);
  assert.ok(missing.error);
});

test('commandExists rejects unsafe names and finds node', () => {
  assert.equal(utils.commandExists('rm -rf /'), false);
  assert.equal(utils.commandExists('node'), true);
  assert.equal(utils.commandExists('definitely-not-a-real-binary-xyz'), false);
});

test('tildify shortens the home directory', () => {
  assert.equal(utils.tildify(path.join(os.homedir(), 'x')), path.join('~', 'x'));
  assert.equal(utils.tildify('/var/tmp'), '/var/tmp');
});

test('stateDir creates .claude/state under the repo root', () => {
  const dir = tmpdir();
  fs.writeFileSync(path.join(dir, 'package.json'), '{}');
  const created = utils.stateDir(dir);
  assert.equal(created, path.join(dir, '.claude', 'state'));
  assert.ok(fs.existsSync(created));
});
