import React from 'react'
import { NavLink } from 'react-router-dom'

const navItems = [
  {
    to: '/dashboard',
    label: 'My Files',
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <path d="M2 4.5A1.5 1.5 0 013.5 3h4.086a1.5 1.5 0 011.06.44l.915.915A1.5 1.5 0 0010.62 5H11.5A1.5 1.5 0 0113 6.5v5A1.5 1.5 0 0111.5 13h-8A1.5 1.5 0 012 11.5v-7z" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    ),
  },
  {
    to: '/shared',
    label: 'Shared With Me',
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <circle cx="5" cy="5" r="2" stroke="currentColor" strokeWidth="1.2" />
        <circle cx="10" cy="5" r="2" stroke="currentColor" strokeWidth="1.2" />
        <path d="M1 12c0-2.21 1.79-4 4-4M9 12c0-2.21 1.79-4 4-4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M7 8c.37.13.73.31 1.06.54" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    to: '/upload',
    label: 'Upload',
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <path d="M7.5 10V2M4 5.5L7.5 2 11 5.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M2 11.5v1A1.5 1.5 0 003.5 14h8a1.5 1.5 0 001.5-1.5v-1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
  },
]

const linkStyle = (isActive) => ({
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '8px 16px',
  margin: '1px 8px',
  borderRadius: '8px',
  fontSize: '13px',
  fontWeight: '500',
  textDecoration: 'none',
  transition: 'all 0.15s',
  color: isActive ? 'var(--accent)' : 'var(--text-2)',
  background: isActive ? 'rgba(var(--accent-rgb, 74, 222, 128), 0.08)' : 'transparent',
})

export default function Sidebar() {
  return (
    <div className="app-sidebar">
      <div style={{ padding: '24px 0 12px' }}>{/* Spacer for macOS traffic lights */}</div>

      <nav style={{ flex: 1 }}>
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            style={({ isActive }) => linkStyle(isActive)}
          >
            <span style={{ opacity: 0.8 }}>{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div style={{ padding: '24px 16px 16px' }}>
        <div style={{
          padding: '8px 12px',
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          fontSize: '10px',
          color: 'var(--accent)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontWeight: '600',
          opacity: 0.8,
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 11 11 13 15 9" />
          </svg>
          <span style={{ letterSpacing: '0.04em' }}>E2E ENCRYPTED</span>
        </div>
      </div>
    </div>
  )
}
