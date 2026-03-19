import React, { useEffect, useState } from 'react'

function ToastItem({ toast, onRemove }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Trigger slide-in
    requestAnimationFrame(() => setVisible(true))
  }, [])

  const icons = {
    success: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <path d="M12.5 3.5L6 10.5L2.5 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    error: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <path d="M3.5 3.5L11.5 11.5M11.5 3.5L3.5 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    info: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <circle cx="7.5" cy="7.5" r="6" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M7.5 5V5.5M7.5 7V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  }

  const colors = {
    success: { bg: 'rgba(22,26,22,0.95)', border: 'rgba(74,222,128,0.25)', icon: '#4ade80' },
    error:   { bg: 'rgba(26,16,16,0.95)', border: 'rgba(248,113,113,0.25)', icon: '#f87171' },
    info:    { bg: 'rgba(22,22,26,0.95)', border: 'rgba(255,255,255,0.1)', icon: '#a1a1aa' },
  }

  const c = colors[toast.type] || colors.info

  return (
    <div
      style={{
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: '10px',
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
        maxWidth: '340px',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        transform: visible ? 'translateX(0)' : 'translateX(24px)',
        opacity: visible ? 1 : 0,
        transition: 'transform 0.25s ease, opacity 0.25s ease',
        cursor: 'pointer',
      }}
      onClick={() => onRemove(toast.id)}
    >
      <span style={{ color: c.icon, marginTop: '1px', flexShrink: 0 }}>
        {icons[toast.type]}
      </span>
      <span style={{ color: '#f0f0f0', fontSize: '13px', lineHeight: '1.5', flex: 1 }}>
        {toast.message}
      </span>
    </div>
  )
}

export default function Toast({ toasts, onRemove }) {
  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      pointerEvents: 'none',
    }}>
      {toasts.map(t => (
        <div key={t.id} style={{ pointerEvents: 'auto' }}>
          <ToastItem toast={t} onRemove={onRemove} />
        </div>
      ))}
    </div>
  )
}
