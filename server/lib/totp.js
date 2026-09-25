'use strict';
const crypto = require('crypto');

/** RFC 6238 TOTP (SHA1, 6 digits, 30s step) — MFA-ready authentication. */
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function generateSecret(bytes = 20) {
  const buf = crypto.randomBytes(bytes);
  let bits = '';
  for (const b of buf) bits += b.toString(2).padStart(8, '0');
  let out = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5), 2)];
  return out;
}

function hotp(secretB32, counter) {
  const key = [];
  for (const c of secretB32.replace(/=+$/, '')) {
    const v = B32.indexOf(c.toUpperCase());
    if (v < 0) continue;
    key.push(v.toString(2).padStart(5, '0'));
  }
  const bits = key.join('');
  const bytes = Buffer.alloc(Math.floor(bits.length / 8));
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter % 0x100000000, 4);
  const hmac = crypto.createHmac('sha1', bytes).update(buf).digest();
  const off = hmac[hmac.length - 1] & 0xf;
  const code = ((hmac[off] & 0x7f) << 24 | hmac[off + 1] << 16 | hmac[off + 2] << 8 | hmac[off + 3]) % 1000000;
  return String(code).padStart(6, '0');
}

function totpNow(secretB32, step = 30) {
  return hotp(secretB32, Math.floor(Date.now() / 1000 / step));
}

function verifyTotp(secretB32, code, window = 1, step = 30) {
  const counter = Math.floor(Date.now() / 1000 / step);
  for (let i = -window; i <= window; i++) {
    if (hotp(secretB32, counter + i) === String(code).trim()) return true;
  }
  return false;
}

module.exports = { generateSecret, totpNow, verifyTotp };
