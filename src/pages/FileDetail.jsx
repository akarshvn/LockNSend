import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import { useToast } from '../hooks/useToast'
import RecipientPicker from '../components/RecipientPicker'
import useAuthStore from '../store/authStore'

export default function FileDetail() {
  const { id } = useParams()
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [revokingId, setRevokingId] = useState(null)
  const [showShareModal, setShowShareModal] = useState(false)
  const [newRecipients, setNewRecipients] = useState([])
  const [sharing, setSharing] = useState(false)

  const api = useApi()
  const { toast } = useToast()
  const navigate = useNavigate()
  const { user, sessionId } = useAuthStore()
  const [revokingConfirm, setRevokingConfirm] = useState(null) // { recipientId, username }

  const fetchFile = async () => {
    try {
      const data = await api.get(`/api/files/${id}`)
      setFile(data)
    } catch (err) {
      toast.error('Failed to load file details')
      navigate('/dashboard')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFile()
  }, [id])

  const handleRevoke = async (recipientId) => {
    setRevokingId(recipientId)
    try {
      await api.del(`/api/files/${id}/access/${recipientId}`)
      setFile(prev => ({
        ...prev,
        recipients: prev.recipients.filter(r => r.recipientId !== recipientId)
      }))
      toast.success('Access revoked')
    } catch (err) {
      toast.error(err.message || 'Revoke failed')
    } finally {
      setRevokingId(null)
    }
  }

  const handleShare = async () => {
    if (newRecipients.length === 0) return
    setSharing(true)
    try {
      if (!window.electronAPI) throw new Error('Electron API not available')

      // 1. Unwrap my own FEK from the file metadata
      const unwrapRes = await window.electronAPI.unwrapFEK({
        sessionId,
        wrappedFekBase64: file.wrappedFek
      })
      if (!unwrapRes.ok) throw new Error('Failed to unwrap your key: ' + unwrapRes.error)

      // 2. Wrap it for each new recipient
      for (const r of newRecipients) {
        const wrapRes = await window.electronAPI.wrapFEK({
          publicKeyPem: r.publicKey,
          fekHex: unwrapRes.fekHex
        })
        if (!wrapRes.ok) throw new Error(`Failed to wrap key for ${r.username}`)

        await api.postMutating(`/api/files/${id}/share`, {
          recipientUsername: r.username,
          wrappedFek: wrapRes.wrappedFekBase64
        })
      }
      toast.success('File shared successfully')
      setShowShareModal(false)
      setNewRecipients([])
      fetchFile()
    } catch (err) {
      toast.error(err.message || 'Sharing failed')
    } finally {
      setSharing(false)
    }
  }

  const confirmRevoke = (recipient) => {
    setRevokingConfirm(recipient)
  }

  const executeRevoke = async () => {
    const { recipientId } = revokingConfirm
    setRevokingConfirm(null)
    handleRevoke(recipientId)
  }

  const copyHash = () => {
    if (file?.ciphertextHash) {
      navigator.clipboard.writeText(file.ciphertextHash)
      toast.info('Hash copied to clipboard', 2000)
    }
  }

  if (loading) return <div style={{ padding: '64px', textAlign: 'center' }}><div className="spinner" /></div>
  if (!file) return null

  return (
    <div className="fade-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <Link to="/dashboard" className="btn-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
        </Link>
        <h1 style={{ fontSize: '24px' }}>{file.filename}</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '24px' }}>
        
        {/* Main Info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Metadata Card */}
          <div className="card" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '16px', marginBottom: '16px' }}>File Intelligence</h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label className="label">Ciphertext SHA-256</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <code className="hash-display" style={{ flex: 1 }}>{file.ciphertextHash}</code>
                  <button className="btn-icon" onClick={copyHash} title="Copy hash">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label className="label">GCM Nonce (IV)</label>
                  <code className="hash-display" style={{ display: 'block' }}>{file.nonce}</code>
                </div>
                <div>
                  <label className="label">GCM Auth Tag</label>
                  <code className="hash-display" style={{ display: 'block' }}>{file.authTag}</code>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <label className="label">Size</label>
                  <div style={{ fontSize: '14px', fontWeight: '600' }}>{(file.fileSize / 1024 / 1024).toFixed(2)} MB</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <label className="label">Uploaded</label>
                  <div style={{ fontSize: '14px', color: 'var(--text-2)' }}>{new Date(file.uploadedAt).toLocaleString()}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Access List Card */}
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '16px' }}>Access Control</h2>
              {file.isOwner && (
                <button className="btn btn-sm btn-primary" onClick={() => setShowShareModal(true)}>
                  Add Recipient
                </button>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Always show owner at the top */}
              <div style={{ 
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px', background: 'rgba(74,222,128,0.03)', borderRadius: '8px', 
                border: '1px solid rgba(74,222,128,0.1)' 
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(74,222,128,0.1)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '12px' }}>
                    {(file.ownerUsername || '?')[0].toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text)' }}>{file.ownerUsername}</div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)' }}>File Owner</div>
                  </div>
                </div>
                <span className="badge badge-accent">Owner</span>
              </div>

              {!file.isOwner && (
                <div style={{ 
                  padding: '12px', background: 'var(--surface-2)', borderRadius: '8px', 
                  border: '1px dashed var(--border)', fontSize: '12px', color: 'var(--muted)',
                  textAlign: 'center', marginTop: '4px'
                }}>
                  You are a recipient of this file. Only the owner can manage access.
                </div>
              )}

              {file.recipients.filter(r => r.username !== file.ownerUsername).map(r => (
                <div key={r.recipientId} style={{ 
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px', background: 'var(--surface-2)', borderRadius: '8px', 
                  border: '1px solid var(--border)' 
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--bg-2)', color: 'var(--text-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '12px' }}>
                      {r.username[0].toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '500' }}>{r.username}</div>
                      <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Granted {new Date(r.grantedAt).toLocaleDateString()}</div>
                    </div>
                  </div>
                  {file.isOwner && r.recipientId !== user.userId && (
                    <button 
                      className="btn btn-sm" 
                      style={{ 
                        color: 'var(--danger)', 
                        background: 'rgba(248,113,113,0.05)', 
                        border: '1px solid rgba(248,113,113,0.2)',
                        padding: '6px 12px',
                        fontSize: '11px',
                        fontWeight: '600'
                      }}
                      onClick={() => confirmRevoke(r)}
                      disabled={revokingId === r.recipientId}
                    >
                      {revokingId === r.recipientId ? <div className="spinner" style={{ width: '12px', height: '12px' }} /> : 'Remove'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar Info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="card" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: '600', marginBottom: '16px', color: 'var(--accent)' }}>Privacy Details</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-2)', lineHeight: '1.6' }}>
              This file is encrypted with AES-256-GCM. The File Encryption Key (FEK) is wrapped using the RSA-OAEP-4096 public keys of each recipient.
              The ciphertext never leaves your local system unencrypted.
            </p>
          </div>
        </div>

      </div>

      {/* Share Modal */}
      {showShareModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="card slide-up" style={{ width: '500px', padding: '32px', position: 'relative' }}>
            <h2 style={{ fontSize: '18px', marginBottom: '8px' }}>Add Recipients</h2>
            <p style={{ color: 'var(--text-2)', fontSize: '13px', marginBottom: '24px' }}>Search for users to share decryption access.</p>
            
            <RecipientPicker selectedRecipients={newRecipients} onChange={setNewRecipients} />
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '32px' }}>
              <button className="btn btn-ghost" onClick={() => setShowShareModal(false)} disabled={sharing}>Cancel</button>
              <button 
                className="btn btn-primary" 
                onClick={handleShare} 
                disabled={sharing || newRecipients.length === 0}
              >
                {sharing ? 'Sharing...' : 'Confirm Share'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Revoke Confirmation Modal */}
      {revokingConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="card slide-up" style={{ width: '400px', padding: '32px', textAlign: 'center' }}>
            <div style={{ 
              width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(248,113,113,0.1)', 
              color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', 
              margin: '0 auto 20px' 
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <line x1="17" y1="8" x2="23" y2="14"></line>
                <line x1="23" y1="8" x2="17" y2="14"></line>
              </svg>
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>Remove Access?</h2>
            <p style={{ color: 'var(--text-2)', fontSize: '14px', marginBottom: '32px', lineHeight: '1.5' }}>
              Are you sure you want to remove decryption access for <strong>{revokingConfirm.username}</strong>?
            </p>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <button className="btn btn-ghost" onClick={() => setRevokingConfirm(null)}>Cancel</button>
              <button className="btn" style={{ background: 'var(--danger)', color: 'white' }} onClick={executeRevoke}>Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
