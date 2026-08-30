'use strict';
const path = require('path');

const ROOT = path.join(__dirname, '..');

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '8088', 10),
  dbFile: path.join(ROOT, 'storage', 'idms.db'),
  storageDir: path.join(ROOT, 'storage', 'files'),
  outboxDir: path.join(ROOT, 'storage', 'outbox'),
  exportDir: path.join(ROOT, 'storage', 'exports'),
  jwtSecret: process.env.IDMS_JWT_SECRET || 'idms-dev-secret-change-in-production-9f2c',
  jwtTtlSeconds: parseInt(process.env.IDMS_JWT_TTL || String(60 * 60 * 12), 10), // 12h sessions
  bcryptRounds: 12,
  maxUploadMb: parseInt(process.env.IDMS_MAX_UPLOAD_MB || '200', 10),
  escalationIntervalMs: parseInt(process.env.IDMS_ESCALATION_MS || String(60 * 1000), 10),
  smtp: {
    // Real SMTP can be plugged here; outbox delivery writes .eml files.
    mode: process.env.IDMS_SMTP_MODE || 'outbox', // 'outbox' | 'smtp'
    host: process.env.IDMS_SMTP_HOST || '',
    from: process.env.IDMS_SMTP_FROM || 'idms-noreply@company.local'
  }
};

module.exports = config;
