import React, { useState, useEffect } from 'react'
import axios from 'axios'
import FleetView from './components/FleetView'
import VesselView from './components/VesselView'
import UploadView from './components/UploadView'
import './App.css'

const API_URL = 'http://localhost:3000/api'

function App() {
  const [currentView, setCurrentView] = useState('fleet')
  const [selectedVessel, setSelectedVessel] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [vessels, setVessels] = useState([])
  const [recordings, setRecordings] = useState([])
  const [flags, setFlags] = useState([])

  // Fetch all vessels on load
  useEffect(() => {
    fetchVessels()
  }, [])

  const fetchVessels = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await axios.get(`${API_URL}/vessels`)
      setVessels(response.data)
    } catch (err) {
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
      setError('Failed to load vessel details: ' + (err.message || 'Unknown error'))
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectVessel = (vesselId) => {
    fetchVesselDetails(vesselId)
    setCurrentView('vessel')
  }

  const handleBackToFleet = () => {
    setCurrentView('fleet')
    setSelectedVessel(null)
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
            fontWeight: currentView === 'fleet' ? '600' : '400',
            ...(currentView === 'fleet' && { background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)', color: 'var(--color-accent)' })
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
            fontWeight: currentView === 'upload' ? '600' : '400',
            ...(currentView === 'upload' && { background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)', color: 'var(--color-accent)' })
          }}
          onClick={(e) => {
            e.preventDefault()
            setCurrentView('upload')
          }}
        >
          📹 Upload Video & AI Detection
        </a>

        <a 
          style={{ 
            fontSize: '13px',
            padding: 'var(--space-2) var(--space-3)',
            borderRadius: 'var(--radius)',
            cursor: 'pointer'
          }}
        >
          Review queue
        </a>
        
        <a 
          style={{ 
            fontSize: '13px',
            padding: 'var(--space-2) var(--space-3)',
            borderRadius: 'var(--radius)',
            cursor: 'pointer'
          }}
        >
          Reports
        </a>
        
        <span style={{ 
          marginLeft: 'auto',
          display: 'inline-block',
          padding: '4px 8px',
          fontSize: '11px',
          letterSpacing: '0.08em',
          borderRadius: 'var(--radius)',
          fontWeight: '500',
          background: 'color-mix(in srgb, var(--color-text) 8%, transparent)',
          color: 'var(--color-text)'
        }}>
          M. OKAFOR · OBSERVER GRADE 2
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

      {!loading && currentView === 'upload' && (
        <UploadView 
          onRefreshFleet={fetchVessels}
        />
      )}
    </div>
  )
}

export default App
