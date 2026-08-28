'use strict';

/**
 * Package-manager detection and command resolution.
 *
 * Precedence: explicit override → saved choice (.claude/package-manager.json)
 *           → `packageManager` field → lockfile → installed binary → npm.
 */

const path = require('path');
const {
  exists,
  readJson,
  writeJson,
  claudeDir,
  repoRoot,
  commandExists,
} = require('./utils');

const SUPPORTED = ['npm', 'pnpm', 'yarn', 'bun'];

const LOCKFILES = {
  'pnpm-lock.yaml': 'pnpm',
  'yarn.lock': 'yarn',
  'bun.lockb': 'bun',
  'bun.lock': 'bun',
  'package-lock.json': 'npm',
  'npm-shrinkwrap.json': 'npm',
};

const COMMANDS = {
  npm: { install: 'npm install', ci: 'npm ci', run: 'npm run', exec: 'npx', add: 'npm install', addDev: 'npm install -D', test: 'npm test' },
  pnpm: { install: 'pnpm install', ci: 'pnpm install --frozen-lockfile', run: 'pnpm run', exec: 'pnpm dlx', add: 'pnpm add', addDev: 'pnpm add -D', test: 'pnpm test' },
  yarn: { install: 'yarn install', ci: 'yarn install --immutable', run: 'yarn', exec: 'yarn dlx', add: 'yarn add', addDev: 'yarn add -D', test: 'yarn test' },
  bun: { install: 'bun install', ci: 'bun install --frozen-lockfile', run: 'bun run', exec: 'bunx', add: 'bun add', addDev: 'bun add -d', test: 'bun test' },
};

function configPath(root = repoRoot()) {
  return path.join(claudeDir(root), 'package-manager.json');
}

/** Every lockfile present in `dir`, as [{ file, manager }]. */
function lockfiles(dir) {
  return Object.entries(LOCKFILES)
    .filter(([file]) => exists(path.join(dir, file)))
    .map(([file, manager]) => ({ file, manager }));
}

/** Parse the `packageManager` field, e.g. "pnpm@9.1.0" → "pnpm". */
function fromPackageJson(dir) {
  const pkg = readJson(path.join(dir, 'package.json'));
  if (!pkg || typeof pkg.packageManager !== 'string') return null;
  const name = pkg.packageManager.split('@')[0].trim();
  return SUPPORTED.includes(name) ? name : null;
}

/**
 * Detect the package manager for `dir`.
 * Returns { name, reason, source, lockfiles, conflict }.
 * Pure with respect to the filesystem — it reads, it never writes.
 */
function detect(dir = repoRoot()) {
  const found = lockfiles(dir);
  const distinct = [...new Set(found.map((l) => l.manager))];

  const saved = readJson(configPath(dir));
  if (saved && SUPPORTED.includes(saved.packageManager)) {
    return {
      name: saved.packageManager,
      source: 'config',
      reason: `saved choice in ${path.relative(dir, configPath(dir))}`,
      lockfiles: found,
      conflict: distinct.length > 1,
    };
  }

  const declared = fromPackageJson(dir);
  if (declared) {
    return {
      name: declared,
      source: 'packageManager',
      reason: 'the `packageManager` field in package.json',
      lockfiles: found,
      conflict: distinct.length > 1,
    };
  }

  if (distinct.length === 1) {
    return {
      name: distinct[0],
      source: 'lockfile',
      reason: `${found[0].file} is present`,
      lockfiles: found,
      conflict: false,
    };
  }

  if (distinct.length > 1) {
    // Ambiguous on purpose: the caller must ask rather than pick.
    return {
      name: distinct[0],
      source: 'lockfile',
      reason: `multiple lockfiles present (${found.map((l) => l.file).join(', ')})`,
      lockfiles: found,
      conflict: true,
    };
  }

  const installed = SUPPORTED.filter((m) => m !== 'npm').find((m) => commandExists(m));
  if (installed) {
    return {
      name: installed,
      source: 'installed',
      reason: `no lockfile; ${installed} is installed`,
      lockfiles: [],
      conflict: false,
    };
  }

  return { name: 'npm', source: 'default', reason: 'no lockfile or declaration found', lockfiles: [], conflict: false };
}

/** The command strings for a manager. Throws on an unknown name. */
function commands(name) {
  const cmds = COMMANDS[name];
  if (!cmds) throw new Error(`unsupported package manager: ${name}`);
  return { ...cmds };
}

/** Resolve with an optional explicit override (from the user or a flag). */
function resolve(dir = repoRoot(), override = null) {
  if (override) {
    const name = String(override).trim().toLowerCase();
    if (!SUPPORTED.includes(name)) {
      throw new Error(`unsupported package manager: ${override} (expected one of ${SUPPORTED.join(', ')})`);
    }
    return { name, source: 'override', reason: 'explicitly requested', lockfiles: lockfiles(dir), conflict: false };
  }
  return detect(dir);
}

/** Persist the choice so the rest of the session agrees with it. */
function save(dir = repoRoot(), name, extra = {}) {
  if (!SUPPORTED.includes(name)) throw new Error(`unsupported package manager: ${name}`);
  const file = configPath(dir);
  writeJson(file, {
    packageManager: name,
    commands: commands(name),
    updatedAt: new Date().toISOString(),
    ...extra,
  });
  return file;
}

function load(dir = repoRoot()) {
  return readJson(configPath(dir));
}

module.exports = { SUPPORTED, LOCKFILES, COMMANDS, detect, commands, resolve, save, load, lockfiles, configPath, fromPackageJson };
