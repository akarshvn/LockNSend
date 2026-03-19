'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Server port
  getServerPort: () => ipcRenderer.invoke('get-server-port'),
  onServerPort: (callback) => ipcRenderer.on('server-port', (_, port) => callback(port)),

  // File dialogs
  openFileDialog: () => ipcRenderer.invoke('dialog:openFile'),
  saveFileDialog: (opts) => ipcRenderer.invoke('dialog:saveFile', opts),

  // Crypto operations (run in main process)
  encryptFile: (params) => ipcRenderer.invoke('crypto:encryptFile', params),
  decryptFile: (args) => ipcRenderer.invoke('crypto:decryptFile', args),
  unwrapFEK: (args) => ipcRenderer.invoke('crypto:unwrapFEK', args),
  wrapFEK: (args) => ipcRenderer.invoke('crypto:wrapFEK', args),
  decryptPrivateKey: (args) => ipcRenderer.invoke('crypto:decryptPrivateKey', args),
  openSecondary: () => ipcRenderer.invoke('window:openSecondary'),
  sign: (params) => ipcRenderer.invoke('crypto:sign', params),

  // Session key management
  storeKey: (params) => ipcRenderer.invoke('session:storeKey', params),
  getKey: (params) => ipcRenderer.invoke('session:getKey', params),
  clearKey: (params) => ipcRenderer.invoke('session:clearKey', params),

  // Progress events from main process
  onProgress: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on('progress', handler);
    // Return cleanup function
    return () => ipcRenderer.removeListener('progress', handler);
  },

  // Shell
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
});
