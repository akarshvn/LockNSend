import React, { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import { useToast } from '../hooks/useToast'
import ProgressBar from '../components/ProgressBar'
import RecipientPicker from '../components/RecipientPicker'
import useAuthStore from '../store/authStore'

export default function Upload() {
  const [file, setFile] = useState(null)
  const [recipients, setRecipients] = useState([])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(null)
  const [phase, setPhase] = useState('')

  const api = useApi()
  const { toast } = useToast()
  const { user, sessionId } = useAuthStore()
  const navigate = useNavigate()

  const onFileSelect = async () => {
    if (!window.electronAPI) return
    const selected = await window.electronAPI.openFileDialog()
    if (selected) {
      setFile(selected)
      // Always add self as recipient
      if (!recipients.find(r => r.userId === user.userId)) {
        setRecipients(prev => [...prev, { userId: user.userId, username: user.username, publicKey: user.publicKey }])
      }
    }
  }

  const handleUpload = async () => {
    if (!file || recipients.length === 0) return
    
    setUploading(true)
    setProgress({ percent: 0, mbps: 0 })
    
    try {
      // 1. Encrypt file via Electron IPC (streaming)
      setPhase('Encrypting')
      const cleanup = window.electronAPI.onProgress((p) => {
        if (p.phase === 'Encrypting') {
          setProgress({ percent: p.percent, mbps: p.mbps })
        }
      })

      const encResult = await window.electronAPI.encryptFile({
        filePath: file.filePath,
        sessionId
      })

      cleanup()
      if (!encResult.ok) throw new Error(encResult.error)

      // 2. Wrap FEK for each recipient using RSA-OAEP
      setPhase('Processing')
      const wrappedRecipients = await Promise.all(recipients.map(async r => {
        const wrapRes = await window.electronAPI.wrapFEK({
          publicKeyPem: r.publicKey,
          fekHex: encResult.fek
        })
        if (!wrapRes.ok) throw new Error(`Failed to wrap key for ${r.username}`)
        return {
          recipientId: r.userId,
          wrappedFek: wrapRes.wrappedFekBase64
        }
      }))

      // 3. Upload ciphertext to local server
      setPhase('Uploading')
      setProgress({ percent: 0, mbps: 0 })

      const formData = new FormData()
      formData.append('metadata', JSON.stringify({
        filename: file.name,
        mimeType: 'application/octet-stream',
        fileSize: file.size,
        nonce: encResult.nonce,
        authTag: encResult.authTag,
        ciphertextHash: encResult.ciphertextHash,
        tmpPath: encResult.tmpPath,
        recipients: wrappedRecipients
      }))

      // Real call to server to finalize metadata
      await api.postForm(`/api/files/upload`, formData)

      toast.success('File secured and uploaded successfully')
      navigate('/dashboard')
    } catch (err) {
      toast.error(err.message || 'Upload failed')
      setUploading(false)
      setProgress(null)
    }
  }

  return (
    <div className="fade-in" style={{ maxWidth: '600px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '24px', marginBottom: '8px' }}>Secure Upload</h1>
      <p style={{ color: 'var(--text-2)', marginBottom: '32px' }}>
        Files are encrypted locally before being stored. Only recipients can decrypt them.
      </p>

      <div className="card" style={{ padding: '24px' }}>
        {!file ? (
          <div className="drop-zone" onClick={onFileSelect}>
            <div style={{ marginBottom: '16px', color: 'var(--accent)' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
            </div>
            <div style={{ fontWeight: '600', marginBottom: '4px' }}>Select File</div>
            <div style={{ fontSize: '13px', color: 'var(--muted)' }}>No size limit for streaming encryption</div>
          </div>
        ) : (
          <div style={{ marginBottom: '24px' }}>
            <div className="label">Selected File</div>
            <div style={{ 
              display: 'flex', alignItems: 'center', gap: '12px', 
              padding: '12px', background: 'var(--surface-2)', 
              borderRadius: '8px', border: '1px solid var(--border)' 
            }}>
              <div style={{ color: 'var(--accent)' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: '600', fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{(file.size / 1024 / 1024).toFixed(2)} MB</div>
              </div>
              <button 
                className="btn-icon" 
                onClick={() => setFile(null)}
                disabled={uploading}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
          </div>
        )}

        <div style={{ marginBottom: '32px' }}>
          <RecipientPicker 
            selectedRecipients={recipients} 
            onChange={setRecipients} 
          />
        </div>

        {progress ? (
          <ProgressBar 
            phase={phase} 
            percent={progress.percent} 
            mbps={progress.mbps} 
            filename={file?.name}
          />
        ) : (
          <button 
            className="btn btn-primary" 
            style={{ width: '100%', padding: '12px', justifyContent: 'center' }}
            disabled={!file || recipients.length === 0}
            onClick={handleUpload}
          >
            Encrypt & Upload
          </button>
        )}
      </div>
    </div>
  )
}
