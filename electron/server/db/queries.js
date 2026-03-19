'use strict';

const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

let db = null;

function getDb() {
  if (!db) throw new Error('DB not initialized');
  return db;
}

function initDb(userDataPath) {
  const Database = require('better-sqlite3');
  const dataDir = path.join(userDataPath, 'data');
  fs.mkdirSync(dataDir, { recursive: true });

  db = new Database(path.join(dataDir, 'locknsend.db'));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      user_id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash BLOB NOT NULL,
      password_salt BLOB NOT NULL,
      public_key TEXT NOT NULL,
      encrypted_private_key BLOB,
      private_key_nonce BLOB,
      private_key_tag BLOB,
      created_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS sessions (
      session_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash BLOB NOT NULL,
      expires_at INTEGER NOT NULL,
      device_fingerprint TEXT,
      FOREIGN KEY(user_id) REFERENCES users(user_id)
    );

    CREATE TABLE IF NOT EXISTS files (
      file_id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      mime_type TEXT,
      file_size INTEGER,
      ciphertext_path TEXT NOT NULL,
      nonce BLOB NOT NULL,
      auth_tag BLOB NOT NULL,
      ciphertext_hash TEXT NOT NULL,
      uploaded_at INTEGER,
      FOREIGN KEY(owner_id) REFERENCES users(user_id)
    );

    CREATE TABLE IF NOT EXISTS file_access (
      access_id TEXT PRIMARY KEY,
      file_id TEXT NOT NULL,
      recipient_id TEXT NOT NULL,
      wrapped_fek BLOB NOT NULL,
      granted_at INTEGER,
      FOREIGN KEY(file_id) REFERENCES files(file_id),
      FOREIGN KEY(recipient_id) REFERENCES users(user_id)
    );

    CREATE TABLE IF NOT EXISTS used_nonces (
      nonce TEXT PRIMARY KEY,
      used_at INTEGER NOT NULL
    );
  `);

  // Cleanup stale nonces (older than 1 hour)
  const oneHourAgo = Date.now() - 3600 * 1000;
  db.prepare('DELETE FROM used_nonces WHERE used_at < ?').run(oneHourAgo);

  // Cleanup expired sessions
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());

  return db;
}

// ─── User Queries ─────────────────────────────────────────────────────────────

function createUser({ username, passwordHash, passwordSalt, publicKey, encryptedPrivateKey, privateKeyNonce, privateKeyTag }) {
  const userId = uuidv4();
  getDb().prepare(`
    INSERT INTO users (user_id, username, password_hash, password_salt, public_key, encrypted_private_key, private_key_nonce, private_key_tag, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(userId, username, passwordHash, passwordSalt, publicKey, encryptedPrivateKey, privateKeyNonce, privateKeyTag, Date.now());
  return userId;
}

function findUserByUsername(username) {
  return getDb().prepare('SELECT * FROM users WHERE username = ?').get(username);
}

function findUserById(userId) {
  return getDb().prepare('SELECT * FROM users WHERE user_id = ?').get(userId);
}

function searchUsers(query, excludeUserId) {
  return getDb().prepare(`
    SELECT user_id, username, public_key FROM users
    WHERE username LIKE ? AND user_id != ?
    LIMIT 10
  `).all(`%${query}%`, excludeUserId);
}

// ─── Session Queries ──────────────────────────────────────────────────────────

function createSession({ userId, tokenHash, expiresAt, deviceFingerprint }) {
  const sessionId = uuidv4();
  getDb().prepare(`
    INSERT INTO sessions (session_id, user_id, token_hash, expires_at, device_fingerprint)
    VALUES (?, ?, ?, ?, ?)
  `).run(sessionId, userId, tokenHash, expiresAt, deviceFingerprint);
  return sessionId;
}

function findSessionByTokenHash(tokenHash) {
  return getDb().prepare(`
    SELECT s.*, u.user_id, u.username, u.public_key
    FROM sessions s
    JOIN users u ON s.user_id = u.user_id
    WHERE s.token_hash = ? AND s.expires_at > ?
  `).get(tokenHash, Date.now());
}

function deleteSession(sessionId) {
  getDb().prepare('DELETE FROM sessions WHERE session_id = ?').run(sessionId);
}

function deleteSessionsForUser(userId) {
  getDb().prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
}

// ─── File Queries ─────────────────────────────────────────────────────────────

function insertFile({ ownerId, filename, mimeType, fileSize, ciphertextPath, nonce, authTag, ciphertextHash }) {
  const fileId = uuidv4();
  getDb().prepare(`
    INSERT INTO files (file_id, owner_id, filename, mime_type, file_size, ciphertext_path, nonce, auth_tag, ciphertext_hash, uploaded_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(fileId, ownerId, filename, mimeType, fileSize, ciphertextPath, nonce, authTag, ciphertextHash, Date.now());
  return fileId;
}

function getFile(fileId) {
  return getDb().prepare('SELECT * FROM files WHERE file_id = ?').get(fileId);
}

function listFilesForUser(userId) {
  // Files owned by user OR shared with user
  return getDb().prepare(`
    SELECT DISTINCT f.*, u.username as owner_username,
      (SELECT COUNT(*) FROM file_access fa2 WHERE fa2.file_id = f.file_id) as recipient_count
    FROM files f
    JOIN users u ON f.owner_id = u.user_id
    LEFT JOIN file_access fa ON fa.file_id = f.file_id AND fa.recipient_id = ?
    WHERE f.owner_id = ? OR fa.recipient_id = ?
    ORDER BY f.uploaded_at DESC
  `).all(userId, userId, userId);
}

function listOwnedFiles(userId) {
  return getDb().prepare(`
    SELECT f.*, u.username as owner_username,
      (SELECT COUNT(*) FROM file_access fa2 WHERE fa2.file_id = f.file_id) as recipient_count
    FROM files f
    JOIN users u ON f.owner_id = u.user_id
    WHERE f.owner_id = ?
    ORDER BY f.uploaded_at DESC
  `).all(userId);
}

function listSharedFiles(userId) {
  return getDb().prepare(`
    SELECT f.*, u.username as owner_username,
      (SELECT COUNT(*) FROM file_access fa2 WHERE fa2.file_id = f.file_id) as recipient_count
    FROM files f
    JOIN users u ON f.owner_id = u.user_id
    JOIN file_access fa ON fa.file_id = f.file_id
    WHERE fa.recipient_id = ? AND f.owner_id != ?
    ORDER BY f.uploaded_at DESC
  `).all(userId, userId);
}

function deleteFile(fileId) {
  const file = getFile(fileId);
  if (file) {
    getDb().prepare('DELETE FROM file_access WHERE file_id = ?').run(fileId);
    getDb().prepare('DELETE FROM files WHERE file_id = ?').run(fileId);
  }
  return file;
}

// ─── File Access Queries ──────────────────────────────────────────────────────

function insertFileAccess({ fileId, recipientId, wrappedFek }) {
  const accessId = uuidv4();
  getDb().prepare(`
    INSERT INTO file_access (access_id, file_id, recipient_id, wrapped_fek, granted_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(accessId, fileId, recipientId, wrappedFek, Date.now());
  return accessId;
}

function getFileAccess(fileId, recipientId) {
  return getDb().prepare(`
    SELECT fa.*, u.username as recipient_username, u.public_key as recipient_public_key
    FROM file_access fa
    JOIN users u ON fa.recipient_id = u.user_id
    WHERE fa.file_id = ? AND fa.recipient_id = ?
  `).get(fileId, recipientId);
}

function listFileAccessForFile(fileId) {
  return getDb().prepare(`
    SELECT fa.*, u.username as recipient_username
    FROM file_access fa
    JOIN users u ON fa.recipient_id = u.user_id
    WHERE fa.file_id = ?
    ORDER BY fa.granted_at ASC
  `).all(fileId);
}

function revokeAccess(fileId, recipientId) {
  const result = getDb().prepare(`
    DELETE FROM file_access WHERE file_id = ? AND recipient_id = ?
  `).run(fileId, recipientId);
  return result.changes > 0;
}

// ─── Nonce Queries ────────────────────────────────────────────────────────────

function insertNonce(nonce) {
  try {
    getDb().prepare('INSERT INTO used_nonces (nonce, used_at) VALUES (?, ?)').run(nonce, Date.now());
    return true;
  } catch (e) {
    return false; // UNIQUE constraint = duplicate nonce
  }
}

function nonceExists(nonce) {
  const row = getDb().prepare('SELECT 1 FROM used_nonces WHERE nonce = ?').get(nonce);
  return !!row;
}

module.exports = {
  initDb,
  getDb,
  // Users
  createUser, findUserByUsername, findUserById, searchUsers,
  // Sessions
  createSession, findSessionByTokenHash, deleteSession, deleteSessionsForUser,
  // Files
  insertFile, getFile, listFilesForUser, listOwnedFiles, listSharedFiles, deleteFile,
  // File Access
  insertFileAccess, getFileAccess, listFileAccessForFile, revokeAccess,
  // Nonces
  insertNonce, nonceExists,
};
