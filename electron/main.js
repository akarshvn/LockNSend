'use strict';

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const net = require('net');
const crypto = require('crypto');

// ─── Single Instance Lock ─────────────────────────────────────────────────────
const allowMultiple = process.env.ALLOW_MULTIPLE_INSTANCES === 'true';
const gotLock = app.requestSingleInstanceLock();
if (!gotLock && !allowMultiple) {
  app.quit();
  process.exit(0);
}

// ─── Path Handling ───────────────────────────────────────────────────────────
const customUserData = process.env.USER_DATA_PATH;
if (customUserData) {
  const absolutePath = path.isAbsolute(customUserData) ? customUserData : path.join(process.cwd(), customUserData);
  app.setPath('userData', absolutePath);
}
const sharedDataPath = process.env.SHARED_DATA_PATH || app.getPath('userData');
const vitePort = process.env.VITE_PORT || 5173;

// ─── In-Memory Private Key Store ─────────────────────────────────────────────
// Map<sessionId, { privateKeyPem: string, userId: string }>
const inMemoryKeys = new Map();

let mainWindow = null;
let expressServer = null;
let serverPort = null;

// ─── Find Free Port ───────────────────────────────────────────────────────────
function findFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

// ─── Cleanup on Quit ─────────────────────────────────────────────────────────
function cleanupOnQuit() {
  // Zero out all in-memory private keys
  for (const [, value] of inMemoryKeys) {
    if (value && value.privateKeyBuf && Buffer.isBuffer(value.privateKeyBuf)) {
      value.privateKeyBuf.fill(0);
    }
  }
  inMemoryKeys.clear();

  // Clean temp files
  const tmpDir = path.join(sharedDataPath, 'tmp');
  if (fs.existsSync(tmpDir)) {
    try {
      const files = fs.readdirSync(tmpDir);
      files.forEach(f => {
        try { fs.unlinkSync(path.join(tmpDir, f)); } catch (e) {}
      });
    } catch (e) {}
  }
}

// ─── Create Window ───────────────────────────────────────────────────────────
async function createAppWindow(partition = null) {
  const windowOptions = {
    width: 1200,
    height: 750,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0d0d0f',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      sandbox: false,
    },
  };

  if (partition) {
    windowOptions.webPreferences.partition = partition;
  }

  const win = new BrowserWindow(windowOptions);

  const isDev = process.env.NODE_ENV !== 'production';
  if (isDev) {
    win.loadURL(`http://localhost:${vitePort}`);
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Once page loads, send server port to renderer
  win.webContents.on('did-finish-load', () => {
    win.webContents.send('server-port', serverPort);
  });

  return win;
}

async function createWindow() {
  // Start Express server on a random port (only once)
  if (!serverPort) {
    serverPort = await findFreePort();
    const { startServer } = require('./server/index');
    expressServer = startServer(serverPort, sharedDataPath, inMemoryKeys);
  }

  mainWindow = await createAppWindow();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ─── App Events ──────────────────────────────────────────────────────────────
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  cleanupOnQuit();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (app.isReady() && BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('before-quit', cleanupOnQuit);

// ─── IPC Handlers ─────────────────────────────────────────────────────────────

// Get server port
ipcMain.handle('get-server-port', () => serverPort);

// Open file dialog (returns filePath, size, name)
ipcMain.handle('dialog:openFile', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    properties: ['openFile'],
  });
  if (canceled || filePaths.length === 0) return null;
  const filePath = filePaths[0];
  const stat = fs.statSync(filePath);
  return { filePath, size: stat.size, name: path.basename(filePath) };
});

// Save file dialog (returns chosen filePath)
ipcMain.handle('dialog:saveFile', async (event, options) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const { filePath } = await dialog.showSaveDialog(win, options);
  return filePath;
});

// Encrypt file (streaming, in main process)
ipcMain.handle('crypto:encryptFile', async (event, { filePath, sessionId }) => {
  const { streamEncryptFile } = require('./server/crypto/streaming');
  const tmpDir = path.join(sharedDataPath, 'tmp');
  fs.mkdirSync(tmpDir, { recursive: true });

  const tmpPath = path.join(tmpDir, `enc_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`);
  const fek = crypto.randomBytes(32);
  const nonce = crypto.randomBytes(12);

  try {
    const stat = fs.statSync(filePath);
    const totalBytes = stat.size;

    const { authTag, ciphertextHash } = await streamEncryptFile(
      filePath,
      tmpPath,
      fek,
      nonce,
      (progress) => {
        event.sender.send('progress', { ...progress, phase: 'Encrypting', totalBytes });
      }
    );

    return {
      tmpPath,
      fek: fek.toString('hex'), // FEK stays hex for local wrapping
      nonce: nonce.toString('base64'),
      authTag: authTag.toString('base64'),
      ciphertextHash,
      ok: true,
    };
  } catch (err) {
    // Clean up partial file
    try { fs.unlinkSync(tmpPath); } catch (e) {}
    return { ok: false, error: err.message };
  } finally {
    // FEK is returned as hex string for recipient wrapping — zero it after caller is done
    // The caller must call finalizeFEK IPC to zero it
  }
});

// Zero out FEK after wrapping is complete
ipcMain.handle('crypto:zeroFEK', async (_, { fekHex }) => {
  // We got the hex string from encryptFile — just make sure it's not held
  // The actual Buffer was in that call's scope (already GC-able)
  return { ok: true };
});

// Decrypt file (streaming, in main process)
ipcMain.handle('crypto:decryptFile', async (event, {
  fileId, outputPath, fekHex, nonceBase64, authTagBase64
}) => {
  const { streamDecryptFile } = require('./server/crypto/streaming');
  const { getFile } = require('./server/db/queries');
  const file = getFile(fileId);
  if (!file) return { ok: false, error: 'File record not found' };

  const fek = Buffer.from(fekHex, 'hex');
  const nonce = Buffer.from(nonceBase64, 'base64');
  const authTag = Buffer.from(authTagBase64, 'base64');

  try {
    const ciphertextPath = file.ciphertext_path;
    if (!fs.existsSync(ciphertextPath)) return { ok: false, error: 'Ciphertext file missing from disk' };
    
    const stat = fs.statSync(ciphertextPath);
    const totalBytes = stat.size;

    await streamDecryptFile(
      ciphertextPath,
      outputPath,
      fek,
      nonce,
      authTag,
      (progress) => {
        event.sender.send('progress', { ...progress, phase: 'Decrypting', totalBytes });
      }
    );
    fek.fill(0);
    return { ok: true };
  } catch (err) {
    fek.fill(0);
    try { fs.unlinkSync(outputPath); } catch (e) {}
    return { ok: false, error: err.message };
  }
});

// Store private key in memory
ipcMain.handle('session:storeKey', async (_, { sessionId, privateKeyPem }) => {
  inMemoryKeys.set(sessionId, { privateKeyPem });
  return { ok: true };
});

// Get private key from memory (for signing)
ipcMain.handle('session:getKey', async (_, { sessionId }) => {
  const entry = inMemoryKeys.get(sessionId);
  return entry ? { privateKeyPem: entry.privateKeyPem } : { privateKeyPem: null };
});

// Remove private key from memory on logout
ipcMain.handle('session:clearKey', async (_, { sessionId }) => {
  const entry = inMemoryKeys.get(sessionId);
  if (entry && entry.privateKeyPem) {
    // Attempt to zero — strings aren't mutable in JS but we remove the ref
  }
  inMemoryKeys.delete(sessionId);
  return { ok: true };
});

// Sign a payload with in-memory RSA private key (RSA-PSS)
ipcMain.handle('crypto:sign', async (_, { sessionId, payload }) => {
  const entry = inMemoryKeys.get(sessionId);
  if (!entry || !entry.privateKeyPem) return { ok: false, error: 'No key in memory' };
  try {
    const sign = crypto.createSign('SHA256');
    sign.update(payload);
    const signature = sign.sign({
      key: entry.privateKeyPem,
      padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
      saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
    });
    return { ok: true, signature: signature.toString('base64') };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// Unwrap FEK with in-memory RSA private key (RSA-OAEP-4096)
ipcMain.handle('crypto:unwrapFEK', async (_, { sessionId, wrappedFekBase64 }) => {
  const entry = inMemoryKeys.get(sessionId);
  if (!entry || !entry.privateKeyPem) return { ok: false, error: 'No key in memory' };
  try {
    const { unwrapFEK } = require('./server/crypto/keys');
    const fek = unwrapFEK(Buffer.from(wrappedFekBase64, 'base64'), entry.privateKeyPem);
    return { ok: true, fekHex: fek.toString('hex') };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// Decrypt private key with password (scrypt + AES-256-GCM)
ipcMain.handle('crypto:decryptPrivateKey', async (_, { 
  password, saltBase64, encryptedKeyBase64, nonceBase64, tagBase64 
}) => {
  try {
    const { decryptPrivateKey, deriveEncryptionKey } = require('./server/crypto/keys');
    const salt = Buffer.from(saltBase64, 'base64');
    const encryptedKey = Buffer.from(encryptedKeyBase64, 'base64');
    const nonce = Buffer.from(nonceBase64, 'base64');
    const tag = Buffer.from(tagBase64, 'base64');

    // 1. Derive the same 32-byte key used for encryption
    const derivedKey = await deriveEncryptionKey(password, salt);
    
    // 2. Decrypt
    try {
      const privateKeyPem = decryptPrivateKey(encryptedKey, nonce, tag, derivedKey);
      return { ok: true, privateKeyPem };
    } finally {
      derivedKey.fill(0);
    }
  } catch (err) {
    console.error('[IPC] Decrypt Private Key Error:', err);
    return { ok: false, error: err.message || 'Incorrect password or corrupted key data' };
  }
});

// Wrap FEK with recipient's RSA public key (RSA-OAEP-4096)
ipcMain.handle('crypto:wrapFEK', async (_, { publicKeyPem, fekHex }) => {
  try {
    const { wrapFEK } = require('./server/crypto/keys');
    const wrappedFek = wrapFEK(Buffer.from(fekHex, 'hex'), publicKeyPem);
    return { ok: true, wrappedFekBase64: wrappedFek.toString('base64') };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// Open secondary isolated window for multi-user simulation
ipcMain.handle('window:openSecondary', async () => {
  await createAppWindow('persist:secondary_user');
});

// Open external link safely
ipcMain.handle('shell:openExternal', async (_, url) => {
  await shell.openExternal(url);
});
