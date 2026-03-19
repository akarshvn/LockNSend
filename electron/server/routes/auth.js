'use strict';

const express = require('express');
const crypto = require('crypto');
const router = express.Router();

const {
  hashPassword, generateSalt, comparePasswordHashes,
  generateRSAKeyPair, encryptPrivateKey, decryptPrivateKey
} = require('../crypto/keys');
const { createToken, hashToken } = require('../crypto/tokens');
const {
  createUser, findUserByUsername,
  createSession, findSessionByTokenHash, deleteSession
} = require('../db/queries');

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    if (username.length < 3 || username.length > 32) return res.status(400).json({ error: 'Username must be 3–32 characters' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    if (!/^[a-zA-Z0-9_.-]+$/.test(username)) return res.status(400).json({ error: 'Username may only contain letters, numbers, _ . -' });

    const existing = findUserByUsername(username);
    if (existing) return res.status(409).json({ error: 'Username already taken' });

    const salt = generateSalt();
    const passwordHash = await hashPassword(password, salt);

    // Generate RSA-4096 keypair (used for both OAEP encryption and PSS signing)
    const { publicKey, privateKey } = generateRSAKeyPair();

    // Encrypt private key with password-derived key
    const { encrypted, nonce, tag } = await encryptPrivateKey(privateKey, password, salt);

    const userId = createUser({
      username,
      passwordHash,
      passwordSalt: salt,
      publicKey,
      encryptedPrivateKey: encrypted,
      privateKeyNonce: nonce,
      privateKeyTag: tag,
    });

    res.status(201).json({ ok: true, userId, username });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

    const user = findUserByUsername(username);
    // Always hash even if user doesn't exist (timing-attack resistant)
    const salt = user ? user.password_salt : crypto.randomBytes(32);
    const hash = await hashPassword(password, salt);

    if (!user || !comparePasswordHashes(hash, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Issue token
    const deviceFingerprint = req.headers['x-device-fingerprint'] || 'unknown';
    const token = createToken(user.user_id, deviceFingerprint);
    const tokenHash = hashToken(token);
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000;

    const sessionId = createSession({ userId: user.user_id, tokenHash, expiresAt, deviceFingerprint });

    res.json({
      ok: true,
      token,
      sessionId,
      user: { userId: user.user_id, username: user.username, publicKey: user.public_key },
      // Return encrypted private key blob for client to decrypt in memory
      encryptedPrivateKey: Buffer.from(user.encrypted_private_key).toString('base64'),
      privateKeyNonce: Buffer.from(user.private_key_nonce).toString('base64'),
      privateKeyTag: Buffer.from(user.private_key_tag).toString('base64'),
      passwordSalt: Buffer.from(user.password_salt).toString('base64'),
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const tokenHash = hashToken(token);
      const { findSessionByTokenHash: fsbt, deleteSession: ds } = require('../db/queries');
      const session = fsbt(tokenHash);
      if (session) ds(session.session_id);
    }
    res.json({ ok: true });
  } catch (err) {
    res.json({ ok: true }); // Always succeed on logout
  }
});

module.exports = router;
