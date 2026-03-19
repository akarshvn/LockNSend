'use strict';

const crypto = require('crypto');
const { promisify } = require('util');

const scryptAsync = promisify(crypto.scrypt);

// ─── Password Hashing ─────────────────────────────────────────────────────────

async function hashPassword(password, salt) {
  // scrypt with N=16384, r=8, p=1 — strong but fast enough for <300ms login
  const hash = await scryptAsync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return hash;
}

async function deriveEncryptionKey(password, salt) {
  // aes-256-gcm needs exactly 32 bytes
  const key = await scryptAsync(password, salt, 32, { N: 16384, r: 8, p: 1 });
  return key;
}

function generateSalt() {
  return crypto.randomBytes(32);
}

// Constant-time comparison of two password hashes
function comparePasswordHashes(hashA, hashB) {
  if (!Buffer.isBuffer(hashA)) hashA = Buffer.from(hashA);
  if (!Buffer.isBuffer(hashB)) hashB = Buffer.from(hashB);
  if (hashA.length !== hashB.length) return false;
  return crypto.timingSafeEqual(hashA, hashB);
}

// ─── RSA-4096 Key Generation ──────────────────────────────────────────────────

function generateRSAKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 4096,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return { publicKey, privateKey };
}

// ─── Private Key Protect / Recover ───────────────────────────────────────────

/**
 * Derives a key from password+salt using scrypt, then AES-256-GCM encrypts the PEM.
 */
async function encryptPrivateKey(privateKeyPem, password, salt) {
  const derivedKey = await deriveEncryptionKey(password, salt);
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey, nonce);
  const encrypted = Buffer.concat([
    cipher.update(privateKeyPem, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  derivedKey.fill(0);
  return { encrypted, nonce, tag };
}

/**
 * Decrypts the AES-256-GCM-protected private key PEM.
 */
function decryptPrivateKey(encrypted, nonce, tag, derivedKey) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', derivedKey, nonce);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

// ─── FEK Wrapping / Unwrapping ────────────────────────────────────────────────

/**
 * Wrap (encrypt) a FEK using recipient's RSA-OAEP public key.
 */
function wrapFEK(fek, publicKeyPem) {
  return crypto.publicEncrypt(
    { key: publicKeyPem, oaepHash: 'sha256', padding: crypto.constants.RSA_PKCS1_OAEP_PADDING },
    fek
  );
}

/**
 * Unwrap (decrypt) a FEK using user's RSA private key.
 */
function unwrapFEK(wrappedFek, privateKeyPem) {
  return crypto.privateDecrypt(
    { key: privateKeyPem, oaepHash: 'sha256', padding: crypto.constants.RSA_PKCS1_OAEP_PADDING },
    wrappedFek
  );
}

module.exports = {
  hashPassword,
  deriveEncryptionKey,
  generateSalt,
  comparePasswordHashes,
  generateRSAKeyPair,
  encryptPrivateKey,
  decryptPrivateKey,
  wrapFEK,
  unwrapFEK,
};
