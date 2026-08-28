'use strict';

/**
 * Cross-platform helpers shared by every script in this plugin.
 * No dependencies — these run wherever Node runs, on any OS.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const isWindows = process.platform === 'win32';

/** Walk up from `startDir` looking for a repo marker. Falls back to startDir. */
function repoRoot(startDir = process.cwd()) {
  let dir = path.resolve(startDir);
  const markers = ['.git', 'package.json', 'pyproject.toml', 'go.mod'];
  while (true) {
    if (markers.some((m) => fs.existsSync(path.join(dir, m)))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return path.resolve(startDir);
    dir = parent;
  }
}

/** The project-local `.claude` directory for a repo. */
function claudeDir(root = repoRoot()) {
  return path.join(root, '.claude');
}

/** The plugin's own state directory, created on demand. */
function stateDir(root = repoRoot()) {
  return ensureDir(path.join(claudeDir(root), 'state'));
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

/** Read JSON, returning `fallback` for a missing or malformed file. */
function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

/** Write JSON atomically (temp file + rename) so a crash cannot truncate state. */
function writeJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  const tmp = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, filePath);
  return filePath;
}

function writeText(filePath, text) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, text, 'utf8');
  return filePath;
}

function appendJsonl(filePath, obj) {
  ensureDir(path.dirname(filePath));
  fs.appendFileSync(filePath, `${JSON.stringify(obj)}\n`, 'utf8');
  return filePath;
}

/** Read the last `count` JSON objects from a .jsonl file, oldest first. */
function readJsonl(filePath, count = Infinity) {
  if (!exists(filePath)) return [];
  const lines = fs.readFileSync(filePath, 'utf8').split('\n').filter(Boolean);
  const slice = count === Infinity ? lines : lines.slice(-count);
  return slice
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

/** Is `cmd` on PATH? Uses `where` on Windows, `command -v` elsewhere. */
function commandExists(cmd) {
  if (!/^[\w.@/-]+$/.test(cmd)) return false;
  const probe = isWindows
    ? spawnSync('where', [cmd], { stdio: 'ignore', shell: false })
    : spawnSync('command', ['-v', cmd], { stdio: 'ignore', shell: '/bin/sh' });
  return probe.status === 0;
}

/** Run a command without a shell. Never throws; returns a plain result object. */
function run(cmd, args = [], opts = {}) {
  const res = spawnSync(cmd, args, {
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
    timeout: opts.timeout || 60000,
    cwd: opts.cwd || process.cwd(),
    env: { ...process.env, ...(opts.env || {}) },
  });
  return {
    ok: res.status === 0,
    status: res.status === null ? 1 : res.status,
    stdout: (res.stdout || '').trim(),
    stderr: (res.stderr || '').trim(),
    error: res.error ? res.error.message : null,
  };
}

/** ISO timestamp safe for use in a filename. */
function fileTimestamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-').replace(/Z$/, '');
}

function truncate(str, max = 2000) {
  const s = String(str == null ? '' : str);
  return s.length <= max ? s : `${s.slice(0, max)}\n… (${s.length - max} more characters)`;
}

const SECRET_PATTERNS = [
  /\b(sk|pk|rk)-[A-Za-z0-9_-]{16,}/g,
  /\bgh[pousr]_[A-Za-z0-9]{20,}/g,
  /\bxox[abposr]-[A-Za-z0-9-]{10,}/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  /((?:api[_-]?key|secret|token|password|passwd)["' ]*[:=]["' ]*)([^\s"',}]{8,})/gi,
];

/** Best-effort redaction — never let a hook write a credential into state. */
function redactSecrets(text) {
  let out = String(text == null ? '' : text);
  for (const re of SECRET_PATTERNS) {
    out = out.replace(re, (match, prefix) =>
      prefix && /[:=]/.test(prefix) ? `${prefix}[REDACTED]` : '[REDACTED]'
    );
  }
  return out;
}

/** Replace the user's home directory with `~` so state stays portable. */
function tildify(p) {
  const home = os.homedir();
  return typeof p === 'string' && home && p.startsWith(home) ? p.replace(home, '~') : p;
}

/** Read and parse the hook payload on stdin. Resolves to {} when there is none. */
function readStdinJson({ timeout = 5000 } = {}) {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) return resolve({});
    let raw = '';
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        resolve(raw.trim() ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    };
    const timer = setTimeout(done, timeout);
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      raw += chunk;
    });
    process.stdin.on('end', done);
    process.stdin.on('error', done);
  });
}

/**
 * Emit a hook result and exit 0.
 * A hook must never break the session it is observing, so failures are swallowed.
 */
function emit(payload) {
  try {
    if (payload !== undefined && payload !== null) {
      process.stdout.write(`${JSON.stringify(payload)}\n`);
    }
  } catch {
    /* nothing useful to do here */
  }
  process.exitCode = 0;
}

/** Wrap a hook main() so any throw becomes a clean, silent exit. */
async function safeMain(fn) {
  try {
    await fn();
  } catch (err) {
    if (process.env.ECC_DEBUG) process.stderr.write(`[ecc] ${err && err.stack}\n`);
    process.exitCode = 0;
  }
}

module.exports = {
  isWindows,
  repoRoot,
  claudeDir,
  stateDir,
  ensureDir,
  exists,
  readJson,
  writeJson,
  writeText,
  appendJsonl,
  readJsonl,
  commandExists,
  run,
  fileTimestamp,
  truncate,
  redactSecrets,
  tildify,
  readStdinJson,
  emit,
  safeMain,
};
