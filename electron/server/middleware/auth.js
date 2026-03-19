'use strict';

const { hashToken, verifyToken } = require('../crypto/tokens');
const { findSessionByTokenHash } = require('../db/queries');

/**
 * Auth middleware: validates Bearer token, attaches req.userId and req.user.
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.slice(7);
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const tokenHash = hashToken(token);
  const session = findSessionByTokenHash(tokenHash);
  if (!session) {
    return res.status(401).json({ error: 'Session not found or expired' });
  }

  req.userId = session.user_id;
  req.username = session.username;
  req.userPublicKey = session.public_key;
  req.sessionId = session.session_id;
  next();
}

module.exports = { requireAuth };
