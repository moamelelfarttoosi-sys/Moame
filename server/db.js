'use strict';
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const config = require('./config');

fs.mkdirSync(config.storageDir, { recursive: true });
fs.mkdirSync(config.outboxDir, { recursive: true });
fs.mkdirSync(path.dirname(config.dbFile), { recursive: true });
fs.mkdirSync(config.exportDir, { recursive: true });

const db = new DatabaseSync(config.dbFile);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA busy_timeout = 5000;');

function migrate() {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    migration TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime('now')))`);

  // Ensure table exists before running 001 (schema file also creates it)
  const dir = path.join(__dirname, 'schema');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
  const applied = new Set(
    db.prepare('SELECT migration FROM schema_migrations').all().map(r => r.migration)
  );
  for (const f of files) {
    if (applied.has(f)) continue;
    const sql = fs.readFileSync(path.join(dir, f), 'utf8');
    db.exec('BEGIN');
    try {
      db.exec(sql.replace(/CREATE TABLE IF NOT EXISTS schema_migrations[\s\S]*?;/i, ''));
      db.prepare('INSERT INTO schema_migrations (migration) VALUES (?)').run(f);
      db.exec('COMMIT');
      console.log('[migrate] applied', f);
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  }
}

/** Shorthand query helpers */
const q = {
  get: (sql, ...p) => db.prepare(sql).get(...p),
  all: (sql, ...p) => db.prepare(sql).all(...p),
  run: (sql, ...p) => {
    try { return db.prepare(sql).run(...p); }
    catch (e) { const err = new Error(`${e.message} | SQL: ${sql.slice(0, 160)}`); throw err; }
  },
  exec: sql => db.exec(sql),
  tx(fn) {
    db.exec('BEGIN');
    try {
      const out = fn();
      db.exec('COMMIT');
      return out;
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  },
  now: () => new Date().toISOString().replace('T', ' ').substring(0, 19),
  today: () => new Date().toISOString().substring(0, 10)
};

module.exports = { db, q, migrate };
