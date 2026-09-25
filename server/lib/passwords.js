'use strict';
const crypto = require('crypto');

/** scrypt password hashing: scrypt$N$r$p$salt$hash */
function hashPassword(password) {
  const N = 16384, r = 8, p = 1, keylen = 64;
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password), salt, keylen, { N, r, p });
  return ['scrypt', N, r, p, salt.toString('hex'), hash.toString('hex')].join('$');
}

function verifyPassword(password, stored) {
  try {
    const [scheme, Ns, rs, ps, saltHex, hashHex] = String(stored).split('$');
    if (scheme !== 'scrypt') return false;
    const hash = crypto.scryptSync(String(password), Buffer.from(saltHex, 'hex'), hashHex.length / 2,
      { N: +Ns, r: +rs, p: +ps });
    const a = Buffer.from(hashHex, 'hex'), b = Buffer.from(hash);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

module.exports = { hashPassword, verifyPassword };
