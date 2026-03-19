'use strict';

const fs = require('fs');
const crypto = require('crypto');
const { Transform } = require('stream');
const { pipeline } = require('stream/promises');

/**
 * AES-256-GCM streaming encryption.
 * ReadStream → CipherGCM → WriteStream
 * Returns { authTag: Buffer, ciphertextHash: string }
 */
async function streamEncryptFile(inputPath, outputPath, fek, nonce, onProgress) {
  const stat = fs.statSync(inputPath);
  const totalBytes = stat.size;
  let bytesProcessed = 0;
  let lastProgressTime = Date.now();
  let lastBytes = 0;

  const readStream = fs.createReadStream(inputPath, { highWaterMark: 64 * 1024 });
  const writeStream = fs.createWriteStream(outputPath);
  const cipher = crypto.createCipheriv('aes-256-gcm', fek, nonce);

  // We also need the ciphertext hash — wrap writeStream with a hash passthrough
  const hasher = crypto.createHash('sha256');

  const progressTransform = new Transform({
    transform(chunk, encoding, callback) {
      bytesProcessed += chunk.length;
      hasher.update(chunk);

      const now = Date.now();
      const elapsed = (now - lastProgressTime) / 1000;
      if (elapsed >= 0.1 || bytesProcessed === totalBytes) {
        const bytesDelta = bytesProcessed - lastBytes;
        const mbps = elapsed > 0 ? (bytesDelta / 1024 / 1024) / elapsed : 0;
        const percent = totalBytes > 0 ? Math.min(100, Math.round((bytesProcessed / totalBytes) * 100)) : 100;
        if (onProgress) onProgress({ bytesProcessed, totalBytes, percent, mbps: Math.round(mbps) });
        lastProgressTime = now;
        lastBytes = bytesProcessed;
      }
      callback(null, chunk);
    }
  });

  await pipeline(readStream, cipher, progressTransform, writeStream);

  const authTag = cipher.getAuthTag();
  const ciphertextHash = hasher.digest('hex');

  return { authTag, ciphertextHash };
}

/**
 * AES-256-GCM streaming decryption.
 * ReadStream → DecipherGCM → WriteStream
 * Throws if auth tag verification fails (file tampered/corrupted).
 */
async function streamDecryptFile(inputPath, outputPath, fek, nonce, authTag, onProgress) {
  const stat = fs.statSync(inputPath);
  const totalBytes = stat.size;
  let bytesProcessed = 0;
  let lastProgressTime = Date.now();
  let lastBytes = 0;

  const readStream = fs.createReadStream(inputPath, { highWaterMark: 64 * 1024 });
  const writeStream = fs.createWriteStream(outputPath);
  const decipher = crypto.createDecipheriv('aes-256-gcm', fek, nonce);
  decipher.setAuthTag(authTag);

  const progressTransform = new Transform({
    transform(chunk, encoding, callback) {
      bytesProcessed += chunk.length;

      const now = Date.now();
      const elapsed = (now - lastProgressTime) / 1000;
      if (elapsed >= 0.1 || bytesProcessed === totalBytes) {
        const bytesDelta = bytesProcessed - lastBytes;
        const mbps = elapsed > 0 ? (bytesDelta / 1024 / 1024) / elapsed : 0;
        const percent = totalBytes > 0 ? Math.min(100, Math.round((bytesProcessed / totalBytes) * 100)) : 100;
        if (onProgress) onProgress({ bytesProcessed, totalBytes, percent, mbps: Math.round(mbps) });
        lastProgressTime = now;
        lastBytes = bytesProcessed;
      }
      callback(null, chunk);
    }
  });

  // GCM auth tag verification happens at stream end — pipeline will throw on tamper
  await pipeline(readStream, decipher, progressTransform, writeStream);
}

module.exports = { streamEncryptFile, streamDecryptFile };
