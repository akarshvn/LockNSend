import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import { useToast } from '../hooks/useToast'
import ProgressBar from '../components/ProgressBar'
import useAuthStore from '../store/authStore'

export default function SharedFiles() {
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  
  // Download progress state
  const [downloadingId, setDownloadingId] = useState(null)
  const [dlProgress, setDlProgress] = useState(null)
  const [dlPhase, setDlPhase] = useState('Processing')

  const api = useApi()
  const { toast } = useToast()
  const { sessionId } = useAuthStore()

  const fetchFiles = async () => {
    setLoading(true)
    try {
      // Specifically fetch shared view
      const data = await api.get('/api/files?view=shared')
      setFiles(data)
    } catch (err) {
      toast.error('Failed to load shared files')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFiles()
  }, [])

  const handleDownload = async (file) => {
    if (!window.electronAPI) return toast.error('Running in browser without Electron API')

    try {
      setDownloadingId(file.fileId)
      setDlPhase('Downloading')
      setDlProgress({ percent: 0, mbps: 0 })

      const meta = await api.get(`/api/files/${file.fileId}`)
      
      const savePath = await window.electronAPI.saveFileDialog({
        defaultPath: meta.filename,
        title: 'Save Decrypted File'
      })
      if (!savePath) return

      setDlPhase('Processing')
      const unwrapRes = await window.electronAPI.unwrapFEK({
        sessionId,
        wrappedFekBase64: meta.wrappedFek
      })
      if (!unwrapRes.ok) throw new Error('Key unwrapping failed: ' + unwrapRes.error)

      setDlPhase('Decrypting')
      const cleanup = window.electronAPI.onProgress((p) => {
        if (p.phase === 'Decrypting') {
          setDlProgress({ percent: p.percent, mbps: p.mbps })
        }
      })

      const decResult = await window.electronAPI.decryptFile({
        fileId: file.fileId,
        outputPath: savePath,
        fekHex: unwrapRes.fekHex,
        nonceBase64: meta.nonce,
        authTagBase64: meta.authTag
      })

      cleanup()
      if (!decResult.ok) throw new Error(decResult.error)

      toast.success(`Saved to ${savePath}`)
    } catch (err) {
      toast.error(`Download failed: ${err.message}`)
    } finally {
      setDownloadingId(null)
      setDlProgress(null)
    }
  }

  return (
    <div className="fade-in">
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '8px' }}>Shared With Me</h1>
        <p style={{ color: 'var(--text-2)', fontSize: '14px' }}>
          Files that have been securely shared with you by other users.
        </p>
      </div>

      {dlProgress && (
        <div style={{ marginBottom: '24px' }}>
          <ProgressBar phase={dlPhase} percent={dlProgress.percent} mbps={dlProgress.mbps} />
        </div>
      )}

      {loading ? (
        <div style={{ padding: '64px', textAlign: 'center' }}><div className="spinner" /></div>
      ) : files.length === 0 ? (
        <div className="empty-state card" style={{ padding: '80px 40px', background: 'rgba(255,255,255,0.02)' }}>
          <div style={{ 
            width: '64px', height: '64px', borderRadius: '50%', background: 'var(--bg-2)', 
            display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px',
            color: 'var(--muted)', opacity: 0.6
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          </div>
          <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>No shared files</h2>
          <p style={{ color: 'var(--muted)', fontSize: '14px', maxWidth: '320px', lineHeight: '1.5' }}>
            When someone shares an end-to-end encrypted file with you, it will appear here.
          </p>
        </div>
      ) : (
        <div className="slide-up" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
          {files.map(f => (
            <div key={f.fileId} className="card hover-lift" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ 
                  width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(74,222,128,0.1)', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' 
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                    <polyline points="13 2 13 9 20 9"></polyline>
                  </svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: '600', fontSize: '15px', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={f.filename}>
                    {f.filename}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                    {(f.fileSize / 1024 / 1024).toFixed(2)} MB
                  </div>
                </div>
              </div>

              <div style={{ padding: '12px', background: 'var(--bg-2)', borderRadius: '8px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: 'var(--muted)' }}>From:</span>
                  <span style={{ color: 'var(--text)', fontWeight: '500' }}>{f.ownerUsername}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--muted)' }}>Received:</span>
                  <span style={{ color: 'var(--text)' }}>{new Date(f.uploadedAt).toLocaleDateString()}</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <button 
                  className="btn btn-primary" 
                  style={{ flex: 1, height: '36px', fontSize: '13px' }}
                  onClick={() => handleDownload(f)}
                  disabled={downloadingId === f.fileId}
                >
                  {downloadingId === f.fileId ? <div className="spinner" style={{ width: '14px', height: '14px' }} /> : 'Download'}
                </button>
                <Link 
                  to={`/file/${f.fileId}`} 
                  className="btn btn-ghost" 
                  style={{ width: '36px', height: '36px', padding: 0, justifyContent: 'center', textDecoration: 'none' }}
                  title="View Details"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="16" x2="12" y2="12"></line>
                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                  </svg>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
