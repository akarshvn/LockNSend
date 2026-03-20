import React from 'react'
import useAuthStore from '../store/authStore'
import useThemeStore from '../store/themeStore'

function AvatarInitial({ username }) {
  const initial = username ? username[0].toUpperCase() : '?'
  const colors = ['#4ade80', '#60a5fa', '#a78bfa', '#fb923c', '#f472b6']
  const colorIdx = (username || '').charCodeAt(0) % colors.length
  return (
    <div style={{
      width: '30px', height: '30px',
      borderRadius: '50%',
      background: `${colors[colorIdx]}22`,
      border: `1px solid ${colors[colorIdx]}44`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '13px', fontWeight: '600',
      color: colors[colorIdx],
      flexShrink: 0,
    }}>
      {initial}
    </div>
  )
}

export default function Navbar() {
  const { user, clearAuth } = useAuthStore()
  const { theme, setTheme } = useThemeStore()
  const [showLogoutConfirm, setShowLogoutConfirm] = React.useState(false)

  const toggleTheme = () => {
    if (theme === 'amoled') setTheme('gray')
    else if (theme === 'gray') setTheme('light')
    else setTheme('amoled')
  }

  const getThemeIcon = () => {
    if (theme === 'amoled') return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-11.314l.707.707m11.314 11.314l.707.707M12 8a4 4 0 100 8 4 4 0 000-8z"/></svg>
    )
    if (theme === 'gray') return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
    )
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
    )
  }

  return (
    <div className="app-navbar titlebar-drag" style={{ justifyContent: 'space-between' }}>
      {/* Left: Logo + Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }} className="titlebar-no-drag">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <rect x="4" y="9" width="12" height="8" rx="2" stroke="var(--accent)" strokeWidth="1.5"/>
          <path d="M7 9V6.5a3 3 0 016 0V9" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round"/>
          <circle cx="10" cy="13" r="1.2" fill="var(--accent)"/>
        </svg>
        <span style={{ fontWeight: '700', fontSize: '15px', letterSpacing: '-0.02em', color: 'var(--text)' }}>
          Lock<span style={{ color: 'var(--accent)' }}>N</span>Send
        </span>
      </div>

      {/* Right Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} className="titlebar-no-drag">
        {/* Theme Switcher - More Prominent */}
        <button
          onClick={toggleTheme}
          className="btn-icon"
          title={`Theme: ${theme}`}
          style={{ 
            width: '32px', height: '32px',
            background: 'var(--surface-2)',
            borderColor: 'var(--border-2)',
            color: 'var(--text)'
          }}
        >
          {getThemeIcon()}
        </button>

        {/* Multi-user Simulation */}
        <button
          onClick={() => window.electronAPI.openSecondary()}
          className="btn-icon"
          title="Open New Secure Window"
          style={{ width: '32px', height: '32px' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="8.5" cy="7" r="4"></circle>
            <line x1="20" y1="8" x2="20" y2="14"></line>
            <line x1="23" y1="11" x2="17" y2="11"></line>
          </svg>
        </button>

        {user && (
          <>
            <div style={{ width: '1px', height: '16px', background: 'var(--border)', margin: '0 4px' }} />
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '4px' }}>
              <AvatarInitial username={user.username} />
              <span style={{ fontSize: '13px', color: 'var(--text-2)', fontWeight: '500' }}>
                {user.username}
              </span>
            </div>

            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="btn btn-ghost btn-sm"
              style={{ padding: '4px 10px', color: 'var(--danger)', borderColor: 'rgba(248,113,113,0.2)' }}
            >
              Logout
            </button>
          </>
        )}
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="card slide-up" style={{ width: '360px', padding: '32px', textAlign: 'center' }}>
            <div style={{ 
              width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(248,113,113,0.1)', 
              color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', 
              margin: '0 auto 20px' 
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>Log Out?</h2>
            <p style={{ color: 'var(--text-2)', fontSize: '14px', marginBottom: '32px', lineHeight: '1.5' }}>
              Are you sure you want to end your secure session? Your private key will be cleared from memory.
            </p>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <button className="btn btn-ghost" onClick={() => setShowLogoutConfirm(false)}>Cancel</button>
              <button 
                className="btn btn-primary" 
                style={{ background: 'var(--danger)', color: 'white' }} 
                onClick={() => {
                  setShowLogoutConfirm(false)
                  clearAuth()
                }}
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
