import React, { useEffect, useState } from 'react'
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar'
import Sidebar from './components/Sidebar'
import Toast from './components/Toast'
import { useToast } from './hooks/useToast'
import useAuthStore from './store/authStore'

// Pages
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import SharedFiles from './pages/SharedFiles'
import Upload from './pages/Upload'
import FileDetail from './pages/FileDetail'

function AppLayout({ children }) {
  const { isAuthenticated } = useAuthStore()
  const { toasts, removeToast } = useToast()
  const location = useLocation()

  if (!isAuthenticated()) {
    return (
      <>
        {children}
        <Toast toasts={toasts} onRemove={removeToast} />
      </>
    )
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="app-main">
        <Navbar />
        <div className="app-content">
          {children}
        </div>
      </main>
      <Toast toasts={toasts} onRemove={removeToast} />
    </div>
  )
}

function AuthenticatedRoute({ children }) {
  const { isAuthenticated } = useAuthStore()
  if (!isAuthenticated()) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  const { setServerPort } = useAuthStore()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (window.electronAPI) {
      // 1. Listen for the Express server port from Electro main
      window.electronAPI.onServerPort((port) => {
        console.log('[App] Received server port:', port)
        setServerPort(port)
        setReady(true)
      })

      // 2. Request port if we didn't get it yet
      window.electronAPI.getServerPort().then(port => {
        if (port) {
          setServerPort(port)
          setReady(true)
        }
      })
    } else {
      // For browser testing (if applicable)
      setReady(true)
    }
  }, [setServerPort])

  if (!ready) {
    return (
      <div style={{ 
        height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', 
        background: '#0d0d0f', color: '#4ade80' 
      }}>
        <div className="spinner" style={{ width: '32px', height: '32px', borderWidth: '3px' }} />
      </div>
    )
  }

  return (
    <Router>
      <AppLayout>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route path="/dashboard" element={
            <AuthenticatedRoute><Dashboard /></AuthenticatedRoute>
          } />
          
          <Route path="/shared" element={
            <AuthenticatedRoute><SharedFiles /></AuthenticatedRoute>
          } />

          <Route path="/upload" element={
            <AuthenticatedRoute><Upload /></AuthenticatedRoute>
          } />

          <Route path="/file/:id" element={
            <AuthenticatedRoute><FileDetail /></AuthenticatedRoute>
          } />

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AppLayout>
    </Router>
  )
}
