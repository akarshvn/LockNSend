'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const crypto = require('crypto');

const { initDb } = require('./db/queries');
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const { router: filesRouter, setStorageDir } = require('./routes/files');

function startServer(port, userDataPath, inMemoryKeys) {
  const app = express();

  // Storage directories
  const storageDir = path.join(userDataPath, 'storage');
  const tmpDir = path.join(userDataPath, 'tmp');
  fs.mkdirSync(storageDir, { recursive: true });
  fs.mkdirSync(tmpDir, { recursive: true });

  setStorageDir(storageDir);

  // Initialize SQLite
  initDb(userDataPath);

  // Multer storage: save ciphertext uploads to storageDir with random name
  const upload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => cb(null, storageDir),
      filename: (req, file, cb) => {
        const name = `${Date.now()}_${crypto.randomBytes(8).toString('hex')}.enc`;
        cb(null, name);
      },
    }),
    limits: { fileSize: Infinity }, // No file size cap
  });

  // ─── Middleware ──────────────────────────────────────────────────────────────

  // CORS — only allow localhost
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS,PUT,PATCH');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,x-timestamp,x-nonce,x-signature,x-device-fingerprint');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
  });

  // Initialize rawBody to avoid undefined
  app.use((req, res, next) => {
    req.rawBody = '';
    next();
  });

  // JSON body parser with raw body capture
  app.use(express.json({
    limit: '1mb',
    verify: (req, res, buf) => {
      req.rawBody = buf.toString();
    }
  }));

  // ─── Routes ──────────────────────────────────────────────────────────────────

  app.use('/api/auth', authRoutes);
  app.use('/api/users', usersRoutes);

  // Upload route needs multer
  app.post('/api/files/upload', upload.single('ciphertext'), (req, res, next) => {
    // Parse metadata from form field
    if (req.body && req.body.metadata && typeof req.body.metadata === 'string') {
      // Already parsed by multer
    }
    filesRouter(req, res, next);
  });

  // All other file routes
  app.use('/api/files', filesRouter);

  // Health check
  app.get('/api/health', (req, res) => res.json({ ok: true, port }));

  // Error handler
  app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  });

  const server = app.listen(port, '127.0.0.1', () => {
    console.log(`[LockNSend] Express server listening on 127.0.0.1:${port}`);
  });

  server.on('error', (err) => {
    console.error('[LockNSend] Server error:', err);
  });

  return server;
}

module.exports = { startServer };
