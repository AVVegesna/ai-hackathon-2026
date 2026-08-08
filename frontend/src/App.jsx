import React from 'react'
import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from './lib/api'
import { useSession } from './lib/prefs'
import QueueRoute from './routes/QueueRoute'
import ReviewRoute from './routes/ReviewRoute'
import FleetRoute from './routes/FleetRoute'
import FleetOverviewRoute from './routes/FleetOverviewRoute'
import VesselRoute from './routes/VesselRoute'
import ReportsRoute from './routes/ReportsRoute'
import UploadRoute from './routes/UploadRoute'
import './styles/app.css'

// Routes replace the old `currentView` state, so every screen has an address:
// a flag under review, or a filtered queue, is a link someone can be sent.

export default function App() {
  const session = useSession()

  // The open-flag count sits in the nav because it is the one number that
  // should follow a reviewer around the app.
  const stats = useQuery({
    queryKey: ['queueStats'],
    queryFn: api.queueStats,
    refetchInterval: 60000,
  })
  const open = stats.data?.totals?.flags_open

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          Fisheries Monitoring <span>/ Review Portal</span>
        </div>

        <nav className="topnav" aria-label="Main">
          <NavLink to="/queue">
            Review queue
            {open > 0 ? <span className="count">{open}</span> : null}
          </NavLink>
          <NavLink to="/fleet">Overview</NavLink>
          <NavLink to="/vessels">Fleet</NavLink>
          <NavLink to="/ingest">Ingest</NavLink>
          <NavLink to="/reports">Reports</NavLink>
        </nav>

        <div className="topbar-end">
          <div className="whoami">
            <b>{session.name}</b>
            <span>{session.role}</span>
          </div>
        </div>
      </header>

      <main className="main">
        <Routes>
          {/* The queue is home: the work list, not the vessel roster. */}
          <Route path="/" element={<Navigate to="/queue" replace />} />
          <Route path="/queue" element={<QueueRoute />} />
          <Route path="/review/:flagId" element={<ReviewRoute />} />
          <Route path="/fleet" element={<FleetOverviewRoute />} />
          <Route path="/vessels" element={<FleetRoute />} />
          <Route path="/vessels/:vesselId" element={<VesselRoute />} />
          <Route path="/ingest" element={<UploadRoute />} />
          <Route path="/reports" element={<ReportsRoute />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  )
}

function NotFound() {
  return (
    <div className="page">
      <div className="state">
        <h3>That page does not exist</h3>
        <p>The link may be out of date.</p>
        <div className="state-actions">
          <NavLink className="btn btn-primary" to="/queue">
            Go to the review queue
          </NavLink>
        </div>
      </div>
    </div>
  )
}
