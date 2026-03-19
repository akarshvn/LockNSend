import React from 'react'

export default function ProgressBar({ phase = 'Processing', percent = 0, mbps = 0, filename = '' }) {
  const clampedPercent = Math.min(100, Math.max(0, percent))

  const phaseColors = {
    Encrypting: '#4ade80',
    Uploading:  '#60a5fa',
    Downloading:'#60a5fa',
    Decrypting: '#a78bfa',
    Processing: '#4ade80',
  }
  const color = phaseColors[phase] || '#4ade80'

  return (
    <div style={{
      background: 'var(--surface-2)',
      border: '1px solid var(--border)',
      borderRadius: '10px',
      padding: '16px',
    }}>
      {filename && (
        <div style={{
          fontSize: '12px',
          color: 'var(--muted)',
          marginBottom: '10px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontFamily: 'JetBrains Mono, monospace',
        }}>
          {filename}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '6px', height: '6px', borderRadius: '50%',
            background: color,
            boxShadow: `0 0 6px ${color}`,
            animation: clampedPercent < 100 ? 'pulse 1.5s ease-in-out infinite' : 'none',
          }} />
          <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text)' }}>{phase}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {mbps > 0 && clampedPercent < 100 && (
            <span style={{ fontSize: '12px', color: 'var(--muted)', fontFamily: 'JetBrains Mono, monospace' }}>
              {mbps} MB/s
            </span>
          )}
          <span style={{
            fontSize: '13px',
            fontWeight: '600',
            color: clampedPercent === 100 ? color : 'var(--text)',
            fontFamily: 'JetBrains Mono, monospace',
          }}>
            {clampedPercent}%
          </span>
        </div>
      </div>

      {/* Track */}
      <div style={{
        height: '4px',
        background: 'rgba(255,255,255,0.07)',
        borderRadius: '2px',
        overflow: 'hidden',
      }}>
        {/* Fill */}
        <div style={{
          height: '100%',
          width: `${clampedPercent}%`,
          background: clampedPercent === 100
            ? `linear-gradient(90deg, ${color}, ${color})`
            : `linear-gradient(90deg, ${color}aa, ${color})`,
          borderRadius: '2px',
          transition: 'width 0.3s ease',
          boxShadow: `0 0 8px ${color}60`,
        }} />
      </div>
    </div>
  )
}
