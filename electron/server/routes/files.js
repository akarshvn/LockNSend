'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const router = express.Router();

const { requireAuth } = require('../middleware/auth');
const { requireSigning } = require('../middleware/signing');
const { wrapFEK, unwrapFEK } = require('../crypto/keys');
const {
  insertFile, getFile, listFilesForUser,
  listOwnedFiles, listSharedFiles, deleteFile,
  insertFileAccess, getFileAccess, listFileAccessForFile, revokeAccess,
  findUserById, searchUsers
} = require('../db/queries');

let storageDir = null;

function setStorageDir(dir) {
  storageDir = dir;
  fs.mkdirSync(storageDir, { recursive: true });
}

// ─── List files ──────────────────────────────────────────────────────────────
// GET /api/files?view=owned|shared|all
router.get('/', requireAuth, (req, res) => {
  try {
    const view = req.query.view || 'all';
    let files;
    if (view === 'owned') files = listOwnedFiles(req.userId);
    else if (view === 'shared') files = listSharedFiles(req.userId);
    else files = listFilesForUser(req.userId);

    res.json(files.map(f => ({
      fileId: f.file_id,
      filename: f.filename,
      mimeType: f.mime_type,
      fileSize: f.file_size,
      uploadedAt: f.uploaded_at,
      ownerUsername: f.owner_username,
      isOwner: f.owner_id === req.userId,
      recipientCount: f.recipient_count || 0,
      ciphertextHash: f.ciphertext_hash,
    })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to list files' });
  }
});

// ─── Get file metadata + wrapped FEK ─────────────────────────────────────────
// GET /api/files/:id
router.get('/:id', requireAuth, (req, res) => {
  try {
    const file = getFile(req.params.id);
    if (!file) return res.status(404).json({ error: 'File not found' });

    const access = getFileAccess(req.params.id, req.userId);
    if (!access && file.owner_id !== req.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const recipients = listFileAccessForFile(req.params.id);

    res.json({
      fileId: file.file_id,
      filename: file.filename,
      mimeType: file.mime_type,
      fileSize: file.file_size,
      uploadedAt: file.uploaded_at,
      nonce: Buffer.from(file.nonce).toString('base64'),
      authTag: Buffer.from(file.auth_tag).toString('base64'),
      ciphertextHash: file.ciphertext_hash,
      isOwner: file.owner_id === req.userId,
      wrappedFek: access ? Buffer.from(access.wrapped_fek).toString('base64') : null,
      recipients: file.owner_id === req.userId
        ? recipients.map(r => ({ recipientId: r.recipient_id, username: r.recipient_username, grantedAt: r.granted_at }))
        : [],
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get file info' });
  }
});

// ─── Upload file (multipart: metadata JSON + ciphertext stream) ───────────────
// POST /api/files/upload
router.post('/upload', requireAuth, requireSigning, (req, res) => {
  let savedPath = null;
  try {
    const meta = JSON.parse(req.body.metadata);
    const { filename, mimeType, fileSize, nonce, authTag, ciphertextHash, recipients } = meta;

    if (!filename || !nonce || !authTag || !ciphertextHash) {
      return res.status(400).json({ error: 'Missing required metadata fields' });
    }

    // Support both real multer upload and local 'tmpPath' optimization
    const { tmpPath } = meta;
    if (tmpPath) {
      if (!fs.existsSync(tmpPath)) return res.status(400).json({ error: 'Local temp file missing' });
      savedPath = path.join(storageDir, path.basename(tmpPath));
      fs.renameSync(tmpPath, savedPath); // Move from tmp to storage
    } else {
      if (!req.file) return res.status(400).json({ error: 'No ciphertext file uploaded' });
      savedPath = req.file.path;
    }

    // Validate recipients include sender
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ error: 'Must include at least one recipient (yourself)' });
    }

    const fileId = insertFile({
      ownerId: req.userId,
      filename,
      mimeType: mimeType || 'application/octet-stream',
      fileSize: fileSize || 0,
      ciphertextPath: savedPath,
      nonce: Buffer.from(nonce, 'base64'),
      authTag: Buffer.from(authTag, 'base64'),
      ciphertextHash,
    });

    // Insert wrapped FEKs for all recipients
    for (const r of recipients) {
      const { recipientId, wrappedFek } = r;
      insertFileAccess({
        fileId,
        recipientId,
        wrappedFek: Buffer.from(wrappedFek, 'base64'),
      });
    }

    res.status(201).json({ ok: true, fileId });
  } catch (err) {
    // Cleanup uploaded file on error
    if (savedPath) try { fs.unlinkSync(savedPath); } catch (e) {}
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload failed: ' + err.message });
  }
});

// ─── Stream download ciphertext ───────────────────────────────────────────────
// GET /api/files/:id/download
router.get('/:id/download', requireAuth, (req, res) => {
  try {
    const file = getFile(req.params.id);
    if (!file) return res.status(404).json({ error: 'File not found' });

    const access = getFileAccess(req.params.id, req.userId);
    if (!access && file.owner_id !== req.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const ciphertextPath = file.ciphertext_path;
    if (!fs.existsSync(ciphertextPath)) {
      return res.status(404).json({ error: 'Ciphertext file missing from storage' });
    }

    const stat = fs.statSync(ciphertextPath);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.filename)}.enc"`);
    res.setHeader('x-file-size', stat.size);

    const readStream = fs.createReadStream(ciphertextPath);
    readStream.on('error', () => res.destroy());
    readStream.pipe(res);
  } catch (err) {
    res.status(500).json({ error: 'Download failed' });
  }
});

// ─── Delete file ──────────────────────────────────────────────────────────────
// DELETE /api/files/:id
router.delete('/:id', requireAuth, requireSigning, (req, res) => {
  try {
    const file = getFile(req.params.id);
    if (!file) return res.status(404).json({ error: 'File not found' });
    if (file.owner_id !== req.userId) return res.status(403).json({ error: 'Only owner can delete' });

    const deleted = deleteFile(req.params.id);
    if (deleted && deleted.ciphertext_path) {
      try { fs.unlinkSync(deleted.ciphertext_path); } catch (e) {}
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Delete failed' });
  }
});

// ─── Share file with new recipient ────────────────────────────────────────────
// POST /api/files/:id/share
router.post('/:id/share', requireAuth, requireSigning, async (req, res) => {
  try {
    const file = getFile(req.params.id);
    if (!file) return res.status(404).json({ error: 'File not found' });
    if (file.owner_id !== req.userId) return res.status(403).json({ error: 'Only owner can share' });

    const { recipientUsername, wrappedFek } = req.body;
    if (!recipientUsername || !wrappedFek) {
      return res.status(400).json({ error: 'recipientUsername and wrappedFek required' });
    }

    const { findUserByUsername } = require('../db/queries');
    const recipient = findUserByUsername(recipientUsername);
    if (!recipient) return res.status(404).json({ error: 'Recipient user not found' });

    // Check existing access
    const existing = getFileAccess(req.params.id, recipient.user_id);
    if (existing) return res.status(409).json({ error: 'User already has access' });

    insertFileAccess({
      fileId: req.params.id,
      recipientId: recipient.user_id,
      wrappedFek: Buffer.from(wrappedFek, 'base64'),
    });

    res.json({ ok: true, recipientId: recipient.user_id, username: recipient.username });
  } catch (err) {
    res.status(500).json({ error: 'Share failed' });
  }
});

// ─── Revoke access ────────────────────────────────────────────────────────────
// DELETE /api/files/:id/access/:recipient_id
router.delete('/:id/access/:recipientId', requireAuth, requireSigning, (req, res) => {
  try {
    const file = getFile(req.params.id);
    if (!file) return res.status(404).json({ error: 'File not found' });
    if (file.owner_id !== req.userId) return res.status(403).json({ error: 'Only owner can revoke access' });

    const revoked = revokeAccess(req.params.id, req.params.recipientId);
    if (!revoked) return res.status(404).json({ error: 'Access record not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Revoke failed' });
  }
});

module.exports = { router, setStorageDir };
