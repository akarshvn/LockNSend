import React, { useState } from 'react'
import { Link } from 'react-router-dom'

function formatBytes(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function formatDate(ms) {
  return new Date(ms).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function FileRow({ file, onDownload, onDelete, isDeleting }) {
  const [showConfirm, setShowConfirm] = useState(false)

  const isSharedView = !file.isOwner

  return (
    <div className="card card-hover" style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '16px 20px', marginBottom: '12px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, minWidth: 0 }}>
        {/* File Icon */}
        <div style={{
          width: '40px', height: '40px', borderRadius: '8px',
          background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', flexShrink: 0
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
            <polyline points="13 2 13 9 20 9"></polyline>
          </svg>
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <Link to={`/file/${file.fileId}`} style={{
              fontWeight: '600', color: 'var(--text)', fontSize: '14px', textDecoration: 'none',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block'
            }}>
              {file.filename}
            </Link>
            {!isSharedView && file.recipientCount > 1 && (
              <span className="badge badge-gray" title={`${file.recipientCount - 1} recipients`}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ marginRight: '4px' }}>
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
                {file.recipientCount - 1}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: 'var(--text-2)' }}>
            <span>{formatBytes(file.fileSize)}</span>
            <span>•</span>
            <span>{formatDate(file.uploadedAt)}</span>
            {isSharedView && (
              <>
                <span>•</span>
                <span>From: {file.ownerUsername}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        {showConfirm ? (
          <div className="slide-up" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button className="btn btn-sm btn-danger" onClick={() => onDelete(file.fileId)} disabled={isDeleting}>
              {isDeleting ? 'Deleting...' : 'Confirm'}
            </button>
            <button className="btn btn-sm btn-ghost" onClick={() => setShowConfirm(false)} disabled={isDeleting}>
              Cancel
            </button>
          </div>
        ) : (
          <>
            <button className="btn btn-sm btn-ghost" onClick={() => onDownload(file)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              Download
            </button>

            {!isSharedView && (
              <>
                <Link to={`/file/${file.fileId}`} className="btn btn-sm btn-ghost" style={{ textDecoration: 'none' }}>
                  Manage
                </Link>
                <button className="btn-icon" onClick={() => setShowConfirm(true)} title="Delete File">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
