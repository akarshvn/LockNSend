import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import { useToast } from '../hooks/useToast'
import FileRow from '../components/FileRow'
import ProgressBar from '../components/ProgressBar'
import useAuthStore from '../store/authStore'

export default function Dashboard() {
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState(null)
  
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
      const data = await api.get('/api/files?view=owned')
      setFiles(data)
    } catch (err) {
      toast.error('Failed to load files')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFiles()
  }, [])

  const handleDelete = async (fileId) => {
    setDeletingId(fileId)
    try {
      await api.del(`/api/files/${fileId}`)
      setFiles(files.filter(f => f.fileId !== fileId))
      toast.success('File deleted')
    } catch (err) {
      toast.error(err.message || 'Failed to delete file')
    } finally {
      setDeletingId(null)
    }
  }

  const handleDownload = async (file) => {
    if (!window.electronAPI) return toast.error('Running in browser without Electron API')

    try {
      setDownloadingId(file.fileId)
      setDlPhase('Downloading')
      setDlProgress({ percent: 0, mbps: 0 })

      // 1. Get file metadata (which includes wrappedFEK, nonce, authTag)
      const meta = await api.get(`/api/files/${file.fileId}`)
      
      // 2. Ask user where to save
      const savePath = await window.electronAPI.saveFileDialog({
        defaultPath: meta.filename,
        title: 'Save Decrypted File'
      })
      if (!savePath) return // User cancelled

      // 3. Unwrap the FEK using our session private key
      setDlPhase('Processing')
      const unwrapRes = await window.electronAPI.unwrapFEK({
        sessionId,
        wrappedFekBase64: meta.wrappedFek
      })
      if (!unwrapRes.ok) throw new Error('Key unwrapping failed: ' + unwrapRes.error)

      // 4. Trigger decryption IPC
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px' }}>Dashboard</h1>
        <Link to="/upload" className="btn btn-primary" style={{ textDecoration: 'none' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Upload New File
        </Link>
      </div>

      <div style={{ paddingBottom: '12px', marginBottom: '24px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ color: 'var(--text)', fontSize: '14px', fontWeight: '500' }}>My Uploads</div>
      </div>

      {dlProgress && (
        <div style={{ marginBottom: '24px' }}>
          <ProgressBar phase={dlPhase} percent={dlProgress.percent} mbps={dlProgress.mbps} />
        </div>
      )}

      {loading ? (
        <div style={{ padding: '64px', textAlign: 'center' }}><div className="spinner" /></div>
      ) : files.length === 0 ? (
        <div className="empty-state card">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--muted)', marginBottom: '16px', opacity: 0.5 }}>
            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
            <polyline points="13 2 13 9 20 9"></polyline>
          </svg>
          <div style={{ fontSize: '16px', color: 'var(--text)', fontWeight: '500', marginBottom: '8px' }}>No files found</div>
          <div style={{ fontSize: '13px', maxWidth: '300px' }}>
            You haven't uploaded any files yet.
          </div>
          <Link to="/upload" className="btn btn-primary" style={{ marginTop: '24px', textDecoration: 'none' }}>
            Upload your first file
          </Link>
        </div>
      ) : (
        <div className="slide-up">
          {files.map(f => (
            <FileRow
              key={f.fileId}
              file={f}
              onDelete={handleDelete}
              onDownload={handleDownload}
              isDeleting={deletingId === f.fileId}
            />
          ))}
        </div>
      )}
    </div>
  )
}
