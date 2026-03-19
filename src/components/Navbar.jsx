import React from 'react'
import useAuthStore from '../store/authStore'

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

  return (
    <div className="app-navbar titlebar-drag" style={{ justifyContent: 'space-between' }}>
      {/* Left: Logo + Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }} className="titlebar-no-drag">
        {/* Lock icon SVG */}
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <rect x="4" y="9" width="12" height="8" rx="2" stroke="#4ade80" strokeWidth="1.5"/>
          <path d="M7 9V6.5a3 3 0 016 0V9" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round"/>
          <circle cx="10" cy="13" r="1.2" fill="#4ade80"/>
        </svg>
        <span style={{ fontWeight: '700', fontSize: '15px', letterSpacing: '-0.02em', color: 'var(--text)' }}>
          Lock<span style={{ color: '#4ade80' }}>N</span>Send
        </span>
      </div>

      {/* Right: User info + logout */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }} className="titlebar-no-drag">
        {/* Multi-user window button */}
        <button
          onClick={() => window.electronAPI.openSecondary()}
          className="btn-icon"
          title="Open New Secure Window (Multi-User Simulation)"
          style={{ marginRight: '8px' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="8.5" cy="7" r="4"></circle>
            <line x1="20" y1="8" x2="20" y2="14"></line>
            <line x1="23" y1="11" x2="17" y2="11"></line>
          </svg>
        </button>

        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AvatarInitial username={user.username} />
              <span style={{ fontSize: '13px', color: 'var(--text-2)', fontWeight: '500' }}>
                {user.username}
              </span>
            </div>

            <button
              onClick={clearAuth}
              className="btn-icon"
              title="Sign out"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M5 2H2.5A1.5 1.5 0 001 3.5v7A1.5 1.5 0 002.5 12H5M9 10l3-3-3-3M13 7H5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
