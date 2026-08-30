'use strict';
const express = require('express');
const path = require('path');
const config = require('./config');
const { migrate } = require('./db');

migrate();

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '250mb' }));
app.use(express.urlencoded({ extended: true }));

// security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

// request logging
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    const t0 = Date.now();
    res.on('finish', () => console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - t0}ms)`));
  }
  next();
});

// ---- API routes ----
const api = express.Router();
api.use('/auth', require('./routes/auth.routes'));
api.use('/users', require('./routes/users.routes'));
api.use('/lookups', require('./routes/lookup.routes'));
api.use('/admin', require('./routes/admin.routes'));
api.use('/documents', require('./routes/documents.routes'));
api.use('/reviews', require('./routes/reviews.routes'));
api.use('/endorsements', require('./routes/endorsements.routes'));
api.use('/approvals', require('./routes/approvals.routes'));
api.use('/transmittals', require('./routes/transmittals.routes'));
api.use('/correspondence', require('./routes/correspondence.routes'));
api.use('/memos', require('./routes/memos.routes'));
api.use('/resolutions', require('./routes/resolutions.routes'));
api.use('/search', require('./routes/search.routes'));
api.use('/dashboard', require('./routes/dashboard.routes'));
api.use('/reports', require('./routes/reports.routes'));
api.use('/notifications', require('./routes/notifications.routes'));
api.use('/audit', require('./routes/audit.routes'));
api.use('/files', require('./routes/files.routes'));
api.use('/archive', require('./routes/archive.routes'));
api.use('/allocations', require('./routes/allocations.routes'));
api.use('/codes', require('./routes/codes.routes'));
api.use('/registers', require('./routes/registers.routes'));
api.use('/corrections', require('./routes/corrections.routes'));
api.use('/ddm', require('./routes/ddm.routes'));

app.use('/api', api);

// health probe
app.get('/healthz', (req, res) => res.json({ status: 'ok' }));

// static SPA
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get(/^\/(?!api|healthz).*/, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// error handler
app.use((err, req, res, next) => {
  const status = err.status || (String(err.message).includes('UNIQUE') ? 409 : 500);
  if (status >= 500) console.error('[error]', err);
  res.status(status).json({
    error: {
      message: err.message || 'Internal server error',
      code: err.code || 'ERROR',
      details: err.details
    }
  });
});

// First-run convenience: if the database has no users yet (e.g. a fresh cloud
// deploy), seed the demonstration data automatically so the app is usable the
// moment it comes up. Disable with IDMS_AUTOSEED=0.
if (process.env.IDMS_AUTOSEED !== '0') {
  try {
    const { q } = require('./db');
    const hasUsers = q.get('SELECT COUNT(*) c FROM users').c > 0;
    if (!hasUsers) {
      console.log('[IDMS] Empty database detected — seeding demonstration data…');
      require('child_process').execFileSync(
        process.execPath, ['--experimental-sqlite', path.join(__dirname, 'seed.js')],
        { stdio: 'inherit' });
    }
  } catch (e) {
    console.error('[IDMS] Auto-seed skipped:', e.message);
  }
}

require('./lib/scheduler').start(config.escalationIntervalMs);

app.listen(config.port, () => {
  console.log(`IDMS server listening on http://localhost:${config.port}`);
});
