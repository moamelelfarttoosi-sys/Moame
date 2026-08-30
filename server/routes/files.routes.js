'use strict';
const express = require('express');
const path = require('path');
const fs = require('fs');
const config = require('../config');
const { q } = require('../db');
const { ah, notFound, forbidden } = require('../lib/http');
const { requireAuth, assertCanSeeDocument } = require('../lib/auth');
const { getFileRecord, openFileStream } = require('../lib/storage');
const { audit } = require('../lib/audit');

const router = express.Router();
router.use(requireAuth);

/** Resolve which document (if any) a file belongs to, for authorization */
function docForFile(fileId) {
  return q.get(
    `SELECT d.* FROM documents d
     WHERE d.id IN (
       SELECT document_id FROM document_revisions WHERE file_id=? OR id IN
         (SELECT revision_id FROM document_versions WHERE file_id=?)
       UNION SELECT entity_id FROM attachments WHERE entity_type='DOCUMENT' AND file_id=?
     ) LIMIT 1`, fileId, fileId, fileId);
}

router.get('/:fileId', ah(async (req, res) => {
  const fileId = Number(req.params.fileId);
  const f = getFileRecord(fileId);
  if (!f) throw notFound('File not found');
  const doc = docForFile(fileId);
  if (doc) assertCanSeeDocument(req.user, doc);
  const inline = req.query.inline === '1';
  res.setHeader('Content-Type', f.mime_type);
  res.setHeader(
    'Content-Disposition',
    `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(f.original_name)}`
  );
  audit({
    user: req.user, action: 'DOWNLOAD', entityType: 'FILE', entityId: fileId,
    details: JSON.stringify({ name: f.original_name, document: doc ? doc.doc_number : null })
  });
  openFileStream(f).pipe(res);
}));

router.get('/export/:filename', ah(async (req, res) => {
  const safe = path.basename(req.params.filename);
  const abs = path.join(config.exportDir, safe);
  if (!fs.existsSync(abs)) throw notFound('Export not found');
  const ext = path.extname(safe).toLowerCase();
  const mimes = { '.csv': 'text/csv', '.xls': 'application/vnd.ms-excel', '.html': 'text/html' };
  res.setHeader('Content-Type', mimes[ext] || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${safe}"`);
  fs.createReadStream(abs).pipe(res);
}));

module.exports = router;
