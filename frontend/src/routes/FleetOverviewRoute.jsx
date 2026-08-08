import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { formatDate, durationLabel } from '../lib/format'
import FleetMap from '../components/FleetMap'
import Stat from '../components/ui/Stat'
import { EmptyState, ErrorState, Skeleton } from '../components/ui/States'

// Situational awareness across the fleet: where the vessels are, how much
// footage is on file, and where the review load sits. Every figure is
// aggregated in SQL — see backend/routes/fleet.js.

const ACTIVITY_LABEL = {
  fishing: 'Fishing',
  transit: 'In transit',
  in_port: 'In port',
  unknown: 'Unknown',
}

export default function FleetOverviewRoute() {
  const navigate = useNavigate()
  const overview = useQuery({ queryKey: ['fleetOverview'], queryFn: api.fleetOverview })

  if (overview.isLoading) {
    return (
      <div className="page">
        <Skeleton width={220} height={26} />
        <div style={{ marginTop: 'var(--space-4)' }}>
          <Skeleton height={320} />
        </div>
      </div>
    )
  }

  if (overview.isError) {
    return (
      <div className="page">
        <ErrorState
          title="Could not load the fleet overview"
          error={overview.error}
          onRetry={overview.refetch}
        />
      </div>
    )
  }

  const { totals: t, by_activity, by_gear, positions, coverage, workload } = overview.data
  const maxGear = Math.max(1, ...by_gear.map((g) => g.count))
  const maxLoad = Math.max(1, ...workload.map((w) => w.count))
  const neverRecorded = coverage.filter((c) => !c.last_recording_date)

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="kicker">Fleet position and monitoring coverage</div>
          <h1>Overview</h1>
        </div>
        <div className="page-head-end">
          <button type="button" className="btn" onClick={() => navigate('/vessels')}>
            Vessel roster →
          </button>
        </div>
      </div>

      <div className="stats">
        <Stat label="Vessels" value={t.vessels_total} note="In the programme" />
        <Stat
          label="With a position"
          value={t.vessels_with_fix}
          note={`of ${t.vessels_total} — rest not plotted`}
        />
        <Stat
          label="Footage on file"
          value={durationLabel(t.minutes_recorded)}
          note={`${t.recordings_with_media} of ${t.recordings_total} recordings hold video`}
        />
        <Stat
          label="Open flags"
          value={t.flags_open}
          note={`${t.flags_overdue} past the review window`}
          alert={t.flags_overdue > 0}
        />
      </div>

      <div className="split" style={{ marginTop: 'var(--space-4)' }}>
        <div className="card">
          <div className="card-head">
            <h2>Last known positions</h2>
            <div className="card-head-end">
              {positions.length} plotted
            </div>
          </div>
          <div className="card-body">
            <FleetMap
              positions={positions}
              vesselsTotal={t.vessels_total}
              onSelect={(v) => navigate(`/vessels/${v.id}`)}
            />
          </div>
        </div>

        <div className="col">
          <div className="card">
            <div className="card-head">
              <h2>Reported activity</h2>
            </div>
            <div className="card-body">
              {by_activity.length === 0 ? (
                <EmptyState title="No activity reported" />
              ) : (
                <div className="bars">
                  {by_activity.map((a) => (
                    <div className="bar-row" key={a.activity}>
                      <span>{ACTIVITY_LABEL[a.activity] || a.activity}</span>
                      <span className="bar-track">
                        <span
                          className="bar-fill"
                          data-tone={a.activity === 'fishing' ? 'high' : undefined}
                          style={{ width: `${(a.count / t.vessels_total) * 100}%` }}
                        />
                      </span>
                      <span className="bar-value">{a.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h2>Gear type</h2>
            </div>
            <div className="card-body">
              <div className="bars">
                {by_gear.map((g) => (
                  <div className="bar-row" key={g.gear}>
                    <span>{g.gear}</span>
                    <span className="bar-track">
                      <span className="bar-fill" style={{ width: `${(g.count / maxGear) * 100}%` }} />
                    </span>
                    <span className="bar-value">{g.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h2>Open review load</h2>
            </div>
            <div className="card-body">
              {workload.length === 0 ? (
                <EmptyState title="Nothing outstanding" />
              ) : (
                <div className="bars">
                  {workload.map((w) => (
                    <div className="bar-row" key={w.assignee}>
                      <span>{w.assignee}</span>
                      <span className="bar-track">
                        <span
                          className="bar-fill"
                          data-tone={w.assignee === 'Unassigned' ? 'medium' : undefined}
                          style={{ width: `${(w.count / maxLoad) * 100}%` }}
                        />
                      </span>
                      <span className="bar-value">{w.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Monitoring gaps are the point of a fleet view: which vessels have not
          been observed, ordered oldest-first. */}
      <div className="card" style={{ marginTop: 'var(--space-4)' }}>
        <div className="card-head">
          <h2>Monitoring coverage — least recent first</h2>
          <div className="card-head-end">
            {neverRecorded.length > 0 ? (
              <span className="badge badge-high">
                {neverRecorded.length} with no footage at all
              </span>
            ) : (
              <span className="badge badge-ok">Every vessel has footage on file</span>
            )}
          </div>
        </div>
        <div className="table-wrap" style={{ border: 'none' }}>
          <table className="data">
            <thead>
              <tr>
                <th scope="col">Vessel</th>
                <th scope="col">IMO</th>
                <th scope="col">Recordings</th>
                <th scope="col">Last recording</th>
              </tr>
            </thead>
            <tbody>
              {coverage.map((c) => (
                <tr key={c.id} onClick={() => navigate(`/vessels/${c.id}`)}>
                  <td className="cell-strong">{c.name}</td>
                  <td className="cell-muted">{c.imo}</td>
                  <td className="cell-muted">{c.recordings_count}</td>
                  <td>
                    {c.last_recording_date ? (
                      <span className="cell-muted">{formatDate(c.last_recording_date)}</span>
                    ) : (
                      <span className="badge badge-high">Never recorded</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
