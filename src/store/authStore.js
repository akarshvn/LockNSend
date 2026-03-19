import { create } from 'zustand'

const useAuthStore = create((set, get) => ({
  user: null,          // { userId, username, publicKey }
  token: null,         // HMAC token string
  sessionId: null,     // session UUID
  privateKeyPem: null, // decrypted private key PEM — only in memory
  serverPort: null,    // Express server port received from Electron

  setAuth: ({ user, token, sessionId, privateKeyPem }) => {
    set({ user, token, sessionId, privateKeyPem })
    // Store private key in Electron main process memory (extra isolation)
    if (window.electronAPI && sessionId && privateKeyPem) {
      window.electronAPI.storeKey({ sessionId, privateKeyPem })
    }
  },

  setServerPort: (port) => set({ serverPort: port }),

  clearAuth: () => {
    const { sessionId, token, serverPort } = get()
    // Clear key from Electron main process memory
    if (window.electronAPI && sessionId) {
      window.electronAPI.clearKey({ sessionId })
    }
    // Logout from API if we have a token
    if (token && serverPort) {
      fetch(`http://127.0.0.1:${serverPort}/api/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {})
    }
    set({ user: null, token: null, sessionId: null, privateKeyPem: null })
  },

  isAuthenticated: () => !!get().token,
}))

export default useAuthStore
