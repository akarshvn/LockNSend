import React, { useState, useEffect, useRef } from 'react'
import { useApi } from '../hooks/useApi'

export default function RecipientPicker({ selectedRecipients, onChange }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const api = useApi()
  const wrapperRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const timer = setTimeout(async () => {
      const q = query.trim()
      if (q.length < 2) {
        setResults([])
        return
      }

      setIsSearching(true)
      try {
        const users = await api.get(`/api/users/search?q=${encodeURIComponent(q)}`)
        // Filter out already selected
        const selectedIds = new Set(selectedRecipients.map(r => r.userId))
        setResults(users.filter(u => !selectedIds.has(u.userId)))
      } catch (err) {
        console.error('Search error', err)
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query, selectedRecipients])

  const addRecipient = (user) => {
    onChange([...selectedRecipients, user])
    setQuery('')
    setResults([])
    setShowDropdown(false)
  }

  const removeRecipient = (userId) => {
    onChange(selectedRecipients.filter(r => r.userId !== userId))
  }

  return (
    <div style={{ position: 'relative' }} ref={wrapperRef}>
      <label className="label">Recipients (Who can decrypt)</label>

      {/* Selected Chips */}
      {selectedRecipients.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
          {selectedRecipients.map(r => (
            <div key={r.userId} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '4px 6px 4px 10px',
              background: 'rgba(74,222,128,0.1)',
              border: '1px solid rgba(74,222,128,0.2)',
              borderRadius: '6px',
              fontSize: '13px', color: '#f0f0f0'
            }}>
              <span style={{ fontWeight: '500' }}>{r.username}</span>
              <button 
                type="button"
                onClick={() => removeRecipient(r.userId)}
                style={{
                  background: 'none', border: 'none', color: '#f87171',
                  cursor: 'pointer', padding: '2px', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', borderRadius: '4px'
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          className="input"
          placeholder="Search username to add..."
          value={query}
          onChange={e => {
            setQuery(e.target.value)
            setShowDropdown(true)
          }}
          onFocus={() => setShowDropdown(true)}
        />
        {isSearching && (
          <div style={{ position: 'absolute', right: '12px', top: '12px' }}>
            <div className="spinner" style={{ width: '14px', height: '14px', borderWidth: '1.5px' }} />
          </div>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && query.length >= 2 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0,
          marginTop: '4px', background: 'var(--surface)',
          border: '1px solid var(--border)', borderRadius: '8px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)', zIndex: 10,
          maxHeight: '200px', overflowY: 'auto'
        }}>
          {results.length > 0 ? (
            results.map(u => (
              <div
                key={u.userId}
                onClick={() => addRecipient(u)}
                style={{
                  padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px',
                  cursor: 'pointer', borderBottom: '1px solid var(--border)'
                }}
                onMouseOver={e => e.currentTarget.style.background = 'var(--surface-2)'}
                onMouseOut={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{
                  width: '24px', height: '24px', borderRadius: '50%',
                  background: 'rgba(74,222,128,0.1)', color: '#4ade80',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '11px', fontWeight: 'bold'
                }}>{u.username[0].toUpperCase()}</div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text)' }}>{u.username}</div>
                </div>
              </div>
            ))
          ) : !isSearching ? (
            <div style={{ padding: '12px 14px', fontSize: '13px', color: 'var(--muted)', textAlign: 'center' }}>
              No users found matching "{query}"
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
