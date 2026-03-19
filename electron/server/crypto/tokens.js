'use strict';

const crypto = require('crypto');

const TOKEN_SECRET = crypto.randomBytes(32); // in-process secret, never persisted

// ─── HMAC-SHA256 Session Tokens ───────────────────────────────────────────────

/**
 * Create a signed HMAC-SHA256 token.
 * Format: base64(userId:deviceFingerprint:expiresAt):signature
 */
function createToken(userId, deviceFingerprint) {
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24h
  const payload = Buffer.from(JSON.stringify({ userId, deviceFingerprint, expiresAt })).toString('base64url');
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

/**
 * Verify a token's HMAC and expiry. Returns payload object or null.
 */
function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;

  const expectedSig = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
  const expectedBuf = Buffer.from(expectedSig, 'base64url');
  const actualBuf = Buffer.from(sig, 'base64url');

  if (expectedBuf.length !== actualBuf.length) return null;
  if (!crypto.timingSafeEqual(expectedBuf, actualBuf)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (parsed.expiresAt < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Hash a token for DB storage (SHA-256 hex).
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// ─── RSA-PSS Request Signing ──────────────────────────────────────────────────

/**
 * Sign a request payload (string) using RSA-PSS with SHA-256.
 * Used server-side to verify incoming signed requests.
 */
function verifyRequestSignature(payload, signatureBase64, publicKeyPem) {
  try {
    const verify = crypto.createVerify('SHA256');
    verify.update(payload);
    return verify.verify(
      { key: publicKeyPem, padding: crypto.constants.RSA_PKCS1_PSS_PADDING, saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST },
      Buffer.from(signatureBase64, 'base64')
    );
  } catch {
    return false;
  }
}

module.exports = { createToken, verifyToken, hashToken, verifyRequestSignature };
