import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import useAuthStore from '../store/authStore'

export default function Login() {
  const [isRegister, setIsRegister] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const api = useApi()
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!username || !password) return setError('Username and password required')
    
    setError('')
    setLoading(true)

    try {
      if (isRegister) {
        await api.post('/api/auth/register', { username, password })
        // Auto-login after register
        const res = await api.post('/api/auth/login', { username, password })
        await handleLoginSuccess(res, password)
      } else {
        const res = await api.post('/api/auth/login', { username, password })
        await handleLoginSuccess(res, password)
      }
    } catch (err) {
      setError(err.message || 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  const handleLoginSuccess = async (res, pwd) => {
    try {
      if (!window.electronAPI) throw new Error('Electron API not available')

      const decryptRes = await window.electronAPI.decryptPrivateKey({
        password: pwd,
        saltBase64: res.passwordSalt,
        encryptedKeyBase64: res.encryptedPrivateKey,
        nonceBase64: res.privateKeyNonce,
        tagBase64: res.privateKeyTag
      })

      if (!decryptRes.ok) throw new Error(decryptRes.error)

      // 2. Store private key in Electron main process memory
      await window.electronAPI.storeKey({
        sessionId: res.sessionId,
        privateKeyPem: decryptRes.privateKeyPem
      })

      // 3. Update auth store
      setAuth({
        user: res.user,
        token: res.token,
        sessionId: res.sessionId,
        privateKeyPem: decryptRes.privateKeyPem,
      })

      navigate('/dashboard')
    } catch (e) {
      setError(e.message || 'Failed to decrypt private key locally')
    }
  }

  return (
    <div className="app-layout" style={{ alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
      {/* Invisible drag handle at the top */}
      <div className="titlebar-drag" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '40px', zIndex: 100 }} />

      <div className="card fade-in" style={{ width: '380px', padding: '32px', position: 'relative', zIndex: 1 }}>
        
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(74,222,128,0.1)', color: 'var(--accent)', marginBottom: '16px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          </div>
          <h1 style={{ fontSize: '24px', marginBottom: '8px' }}>Lock<span style={{ color: 'var(--accent)' }}>N</span>Send</h1>
          <p style={{ color: 'var(--muted)' }}>End-to-end encrypted file sharing</p>
        </div>

        {error && (
          <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', color: 'var(--danger)', padding: '12px', borderRadius: '8px', fontSize: '13px', marginBottom: '20px', textAlign: 'center' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label className="label">Username</label>
            <input
              type="text"
              className="input"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="e.g. alice"
              disabled={loading}
              autoFocus
            />
          </div>

          <div>
            <label className="label">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                className="input"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={isRegister ? 'At least 8 characters' : 'Your password'}
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}
                title={showPassword ? 'Hide' : 'Show'}
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', marginTop: '8px', padding: '12px' }}
            disabled={loading}
          >
            {loading ? <div className="spinner" /> : (isRegister ? 'Create Account' : 'Sign In')}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '13px', color: 'var(--text-2)' }}>
          {isRegister ? 'Already have an account?' : 'Need an account?'}
          {' '}
          <button
            onClick={() => { setIsRegister(!isRegister); setError(''); setPassword(''); }}
            style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: '500', padding: 0 }}
          >
            {isRegister ? 'Sign in' : 'Register'}
          </button>
        </div>

      </div>
    </div>
  )
}
