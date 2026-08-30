'use strict';

class ApiError extends Error {
  constructor(status, message, code, details) {
    super(message);
    this.status = status;
    this.code = code || 'ERROR';
    this.details = details;
  }
}
const badRequest = (m, d) => new ApiError(400, m, 'BAD_REQUEST', d);
const unauthorized = (m) => new ApiError(401, m || 'Authentication required', 'UNAUTHORIZED');
const forbidden = (m) => new ApiError(403, m || 'Not permitted', 'FORBIDDEN');
const notFound = (m) => new ApiError(404, m || 'Not found', 'NOT_FOUND');
const conflict = (m, d) => new ApiError(409, m, 'CONFLICT', d);

/** Wrap async route handlers */
const ah = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function pagination(query, defSize = 25, maxSize = 500) {
  let page = Math.max(1, parseInt(query.page || '1', 10) || 1);
  let pageSize = Math.min(maxSize, Math.max(1, parseInt(query.pageSize || String(defSize), 10) || defSize));
  return { page, pageSize, limit: pageSize, offset: (page - 1) * pageSize };
}

function ok(res, data, meta) {
  res.json(meta ? { data, meta } : { data });
}

module.exports = { ApiError, badRequest, unauthorized, forbidden, notFound, conflict, ah, ok, pagination };
