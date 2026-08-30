'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../config');
const { q } = require('../db');

/** Store file content; returns files row. Content-addressed under storage/files/ab/cd/<sha>.<ext> */
function storeFile(buffer, originalName, mimeType, userId) {
  const sha = crypto.createHash('sha256').update(buffer).digest('hex');
  const ext = path.extname(originalName || '').replace(/[^.\w]/g, '').slice(0, 10);
  const rel = path.join(sha.slice(0, 2), sha.slice(2, 4), `${sha}${ext}`);
  const abs = path.join(config.storageDir, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  if (!fs.existsSync(abs)) fs.writeFileSync(abs, buffer);
  const existing = q.get(`SELECT id FROM files WHERE sha256 = ?`, sha);
  if (existing) return existing.id;
  const r = q.run(
    `INSERT INTO files (sha256, original_name, mime_type, size_bytes, storage_path, uploaded_by)
     VALUES (?,?,?,?,?,?)`,
    sha, path.basename(originalName || 'file'), mimeType || 'application/octet-stream',
    buffer.length, rel.split(path.sep).join('/'), userId
  );
  return Number(r.lastInsertRowid);
}

function getFileRecord(id) {
  return q.get(`SELECT * FROM files WHERE id = ?`, id);
}

function openFileStream(fileRec) {
  const abs = path.join(config.storageDir, fileRec.storage_path);
  if (!fs.existsSync(abs)) throw new Error('Stored file missing on disk: ' + fileRec.storage_path);
  return fs.createReadStream(abs);
}

module.exports = { storeFile, getFileRecord, openFileStream };
