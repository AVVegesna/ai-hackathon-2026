import React, { useState, useEffect } from 'react'
import axios from 'axios'
import FleetView from './components/FleetView'
import VesselView from './components/VesselView'
import LoginView from './components/LoginView'
import ReviewQueueView from './components/ReviewQueueView'
import ReportsView from './components/ReportsView'
import './App.css'

const API_URL = 'http://localhost:3000/api'

function loadStoredSession() {
  const token = localStorage.getItem('portal_token')
  const rawUser = localStorage.getItem('portal_user')
  if (!token || !rawUser) return null

  try {
    const user = JSON.parse(rawUser)
    return { token, user }
  } catch {
    return null
  }
}

function App() {
  const [session, setSession] = useState(() => loadStoredSession())
  const [currentView, setCurrentView] = useState('fleet')
  const [selectedVessel, setSelectedVessel] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [authError, setAuthError] = useState(null)
  const [vessels, setVessels] = useState([])
  const [queueRecordings, setQueueRecordings] = useState([])
  const [queueFlags, setQueueFlags] = useState([])
  const [recordings, setRecordings] = useState([])
  const [flags, setFlags] = useState([])

  // Sync auth token with axios defaults.
  useEffect(() => {
    if (session?.token) {
      axios.defaults.headers.common.Authorization = `Bearer ${session.token}`
    } else {
      delete axios.defaults.headers.common.Authorization
    }
  }, [session])

  // Fetch all vessels when logged in.
  useEffect(() => {
    if (session?.token) {
      fetchVessels()
    } else {
      setLoading(false)
    }
  }, [session?.token])

  const handleLogin = async ({ username, password }) => {
    setAuthError(null)
    try {
      const response = await axios.post(`${API_URL}/auth/login`, { username, password })
      const nextSession = response.data
      localStorage.setItem('portal_token', nextSession.token)
      localStorage.setItem('portal_user', JSON.stringify(nextSession.user))
      setSession(nextSession)
      setCurrentView('fleet')
      setSelectedVessel(null)
    } catch (err) {
      const message = err.response?.data?.error || 'Login failed'
      setAuthError(message)
    }
  }

  const handleLogout = async () => {
    try {
      await axios.post(`${API_URL}/auth/logout`)
    } catch {
      // Best-effort logout: session is removed client-side regardless.
    } finally {
      localStorage.removeItem('portal_token')
      localStorage.removeItem('portal_user')
      setSession(null)
      setCurrentView('fleet')
      setSelectedVessel(null)
      setVessels([])
      setQueueRecordings([])
      setQueueFlags([])
      setRecordings([])
      setFlags([])
      setError(null)
    }
  }

  const fetchVessels = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await axios.get(`${API_URL}/vessels`)
      setVessels(response.data)
    } catch (err) {
      if (err.response?.status === 401) {
        handleLogout()
        return
      }
      setError('Failed to load vessels: ' + (err.message || 'Unknown error'))
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const fetchVesselDetails = async (vesselId) => {
    try {
      setLoading(true)
      setError(null)
      
      const [recordingsRes, flagsRes] = await Promise.all([
        axios.get(`${API_URL}/vessels/${vesselId}/recordings`),
        axios.get(`${API_URL}/flags`)
      ])
      
      setRecordings(recordingsRes.data)
      setFlags(flagsRes.data.filter(f => recordingsRes.data.some(r => r.id === f.recording_id)))
      
      const vessel = vessels.find(v => v.id === vesselId)
      setSelectedVessel(vessel)
    } catch (err) {
      if (err.response?.status === 401) {
        handleLogout()
        return
      }
      setError('Failed to load vessel details: ' + (err.message || 'Unknown error'))
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const fetchQueueData = async () => {
    try {
      setLoading(true)
      setError(null)

      const [recordingsRes, flagsRes] = await Promise.all([
        axios.get(`${API_URL}/recordings`),
        axios.get(`${API_URL}/flags`)
      ])

      setQueueRecordings(recordingsRes.data)
      setQueueFlags(flagsRes.data)
    } catch (err) {
      if (err.response?.status === 401) {
        handleLogout()
        return
      }
      setError('Failed to load review queue: ' + (err.message || 'Unknown error'))
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (!session?.token) {
    return <LoginView onLogin={handleLogin} error={authError} />
  }

  const handleSelectVessel = (vesselId) => {
    fetchVesselDetails(vesselId)
    setCurrentView('vessel')
  }

  const handleBackToFleet = () => {
    setCurrentView('fleet')
    setSelectedVessel(null)
  }

  const handleOpenReviewQueue = () => {
    setSelectedVessel(null)
    setCurrentView('review-queue')
    fetchQueueData()
  }

  const handleOpenReports = () => {
    setSelectedVessel(null)
    setCurrentView('reports')
    fetchQueueData()
  }

  return (
    <div>
      <nav style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-4)',
        padding: 'var(--space-3) var(--space-4)',
        borderBottom: '1px solid var(--color-divider)',
        backgroundColor: 'var(--color-bg)'
      }}>
        <div style={{
          fontFamily: 'var(--font-heading)',
          fontSize: '13px',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          fontWeight: '600'
        }}>
          FISHERIES MONITORING <span style={{ opacity: 0.45 }}>/ REVIEW PORTAL</span>
        </div>
        
        <a 
          style={{ 
            fontSize: '13px',
            padding: 'var(--space-2) var(--space-3)',
            borderRadius: 'var(--radius)',
            cursor: 'pointer',
            ...(currentView === 'fleet' && { background: 'color-mix(in srgb, var(--color-accent) 10%, transparent)' })
          }}
          onClick={(e) => {
            e.preventDefault()
            handleBackToFleet()
          }}
        >
          Fleet
        </a>
        
        <a 
          style={{ 
            fontSize: '13px',
            padding: 'var(--space-2) var(--space-3)',
            borderRadius: 'var(--radius)',
            cursor: 'pointer',
            ...(currentView === 'review-queue' && { background: 'color-mix(in srgb, var(--color-accent) 10%, transparent)' })
          }}
          onClick={(e) => {
            e.preventDefault()
            handleOpenReviewQueue()
          }}
        >
          Review queue
        </a>
        
        <a 
          style={{ 
            fontSize: '13px',
            padding: 'var(--space-2) var(--space-3)',
            borderRadius: 'var(--radius)',
            cursor: 'pointer',
            ...(currentView === 'reports' && { background: 'color-mix(in srgb, var(--color-accent) 10%, transparent)' })
          }}
          onClick={(e) => {
            e.preventDefault()
            handleOpenReports()
          }}
        >
          Reports
        </a>
        
        <span style={{ 
          marginLeft: 'auto',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '4px 8px',
          fontSize: '11px',
          letterSpacing: '0.08em',
          borderRadius: 'var(--radius)',
          fontWeight: '500',
          background: 'color-mix(in srgb, var(--color-text) 8%, transparent)',
          color: 'var(--color-text)'
        }}>
          {session.user.display_name.toUpperCase()} · {`${session.user.role} ${session.user.grade}`.toUpperCase()}
          <button className="btn btn-ghost" style={{ padding: '2px 6px', fontSize: '11px' }} onClick={handleLogout}>Logout</button>
        </span>
      </nav>

      {error && (
        <div style={{
          background: 'color-mix(in srgb, #ff6b6b 10%, transparent)',
          color: '#ff6b6b',
          padding: 'var(--space-3)',
          borderRadius: 'var(--radius)',
          border: '1px solid #ff6b6b',
          margin: 'var(--space-4)'
        }}>
          {error}
        </div>
      )}

      {loading && (
        <div style={{
          textAlign: 'center',
          padding: 'var(--space-6)',
          opacity: 0.6
        }}>
          Loading...
        </div>
      )}

      {!loading && currentView === 'fleet' && (
        <FleetView 
          vessels={vessels}
          onSelectVessel={handleSelectVessel}
          onRefresh={fetchVessels}
        />
      )}

      {!loading && currentView === 'vessel' && selectedVessel && (
        <VesselView 
          vessel={selectedVessel}
          recordings={recordings}
          flags={flags}
          onBack={handleBackToFleet}
        />
      )}

      {!loading && currentView === 'review-queue' && (
        <ReviewQueueView
          recordings={queueRecordings}
          flags={queueFlags}
          onOpenVessel={handleSelectVessel}
          onRefresh={fetchQueueData}
        />
      )}

      {!loading && currentView === 'reports' && (
        <ReportsView
          vessels={vessels}
          recordings={queueRecordings}
          flags={queueFlags}
        />
      )}
    </div>
  )
}

export default App
