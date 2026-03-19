'use strict';

const crypto = require('crypto');
const { insertNonce, nonceExists } = require('../db/queries');
const { verifyRequestSignature } = require('../crypto/tokens');

const TIMESTAMP_TOLERANCE_MS = 30 * 1000; // 30 seconds

/**
 * Signing middleware: verifies timestamp freshness, nonce uniqueness, and RSA-PSS signature.
 * Attach after requireAuth — needs req.userPublicKey.
 */
function requireSigning(req, res, next) {
  const timestamp = req.headers['x-timestamp'];
  const nonce = req.headers['x-nonce'];
  const signature = req.headers['x-signature'];

  if (!timestamp || !nonce || !signature) {
    return res.status(400).json({ error: 'Missing signing headers (x-timestamp, x-nonce, x-signature)' });
  }

  // Check timestamp freshness
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts) || Math.abs(Date.now() - ts) > TIMESTAMP_TOLERANCE_MS) {
    return res.status(400).json({ error: 'Request timestamp out of allowed window (±30s)' });
  }

  // Check nonce uniqueness (replay protection)
  if (nonceExists(nonce)) {
    return res.status(400).json({ error: 'Duplicate nonce — replay attack detected' });
  }

  // Build canonical payload: endpoint + raw body + timestamp + nonce
  const path = req.originalUrl.split('?')[0];
  const endpoint = req.method + ':' + path;
  const bodyStr = req.rawBody || '';
  const payload = `${endpoint}|${bodyStr}|${timestamp}|${nonce}`;

  // Verify RSA-PSS signature
  const valid = verifyRequestSignature(payload, signature, req.userPublicKey);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid request signature' });
  }

  // Record nonce so it cannot be replayed
  insertNonce(nonce);
  next();
}

module.exports = { requireSigning };
