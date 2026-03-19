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
  const { user } = useAuthStore()

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
        sessionId: user.sessionId || localStorage.getItem('locknsend_session_id') || '', // Adjust as needed
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
              {file.recipients.map(r => (
                <div key={r.recipientId} style={{ 
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px', background: 'var(--surface-2)', borderRadius: '8px', 
                  border: '1px solid var(--border)' 
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(74,222,128,0.1)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '12px' }}>
                      {r.username[0].toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '500' }}>{r.username}</div>
                      <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Granted {new Date(r.grantedAt).toLocaleDateString()}</div>
                    </div>
                  </div>
                  {file.isOwner && r.recipientId !== user.userId && (
                    <button 
                      className="btn-icon" 
                      style={{ color: 'var(--danger)' }}
                      onClick={() => handleRevoke(r.recipientId)}
                      disabled={revokingId === r.recipientId}
                    >
                      {revokingId === r.recipientId ? <div className="spinner" style={{ width: '14px', height: '14px' }} /> : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                      )}
                    </button>
                  )}
                  {r.recipientId === user.userId && (
                    <span className="badge badge-gray">Owner</span>
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
    </div>
  )
}
