import React, { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { formatDate, formatDateTime, durationLabel } from '../lib/format'
import { useSession } from '../lib/prefs'
import { EmptyState, ErrorState, Skeleton, SaveIndicator } from '../components/ui/States'

// The vessel record: history and prior determinations. Reference material,
// not the review workflow.

export default function VesselRoute() {
  const { vesselId } = useParams()
  const qc = useQueryClient()
  const session = useSession()

  const vessel = useQuery({ queryKey: ['vessel', vesselId], queryFn: () => api.vessel(vesselId) })
  const recordings = useQuery({
    queryKey: ['vesselRecordings', vesselId],
    queryFn: () => api.vesselRecordings(vesselId),
  })
  const reviews = useQuery({
    queryKey: ['vesselReviews', vesselId],
    queryFn: () => api.vesselReviews(vesselId),
  })
  const audit = useQuery({
    queryKey: ['audit', { vessel_id: vesselId }],
    queryFn: () => api.audit({ vessel_id: vesselId, limit: 50 }),
  })

  const [notes, setNotes] = useState('')
  const submitReview = useMutation({
    mutationFn: (body) => api.createReview(body),
    onSuccess: () => {
      setNotes('')
      qc.invalidateQueries({ queryKey: ['vesselReviews', vesselId] })
      qc.invalidateQueries({ queryKey: ['audit'] })
    },
  })

  if (vessel.isLoading) {
    return (
      <div className="page">
        <Skeleton width={260} height={26} />
      </div>
    )
  }

  if (vessel.isError) {
    return (
      <div className="page">
        <ErrorState title="Could not load this vessel" error={vessel.error} onRetry={vessel.refetch} />
        <p style={{ marginTop: 'var(--space-3)' }}>
          <Link to="/vessels">← Back to the fleet</Link>
        </p>
      </div>
    )
  }

  const v = vessel.data
  const saveState = submitReview.isPending
    ? 'saving'
    : submitReview.isError
      ? 'error'
      : submitReview.isSuccess
        ? 'saved'
        : 'idle'

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="kicker">
            <Link to="/vessels">Fleet</Link> / Vessel record
          </div>
          <h1>{v.name}</h1>
          <ul className="meta-list" style={{ marginTop: 4 }}>
            <li>
              <b>IMO</b>
              <span>{v.imo}</span>
            </li>
            <li>
              <b>Licence</b>
              <span>{v.licence}</span>
            </li>
            <li>
              <b>Gear</b>
              <span>{v.gear}</span>
            </li>
            <li>
              <b>Skipper</b>
              <span>{v.captain || '—'}</span>
            </li>
            <li>
              <b>Crew</b>
              <span>{v.crew_count ?? '—'}</span>
            </li>
          </ul>
        </div>
        <div className="page-head-end">
          {v.unresolved_flags > 0 ? (
            <Link className="btn btn-primary" to={`/queue?q=${encodeURIComponent(v.name)}`}>
              Review {v.unresolved_flags} open flag{v.unresolved_flags === 1 ? '' : 's'}
            </Link>
          ) : (
            <span className="badge badge-ok">No open flags</span>
          )}
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 2fr) minmax(280px, 1fr)',
          gap: 'var(--space-4)',
          alignItems: 'start',
        }}
      >
        <div className="col">
          <div className="card">
            <div className="card-head">
              <h2>Recordings</h2>
              <div className="card-head-end">{recordings.data?.length ?? 0} on file</div>
            </div>
            {recordings.isLoading ? (
              <div className="card-body">
                <Skeleton />
              </div>
            ) : recordings.isError ? (
              <ErrorState error={recordings.error} onRetry={recordings.refetch} />
            ) : (recordings.data || []).length === 0 ? (
              <EmptyState title="No recordings on file">
                Nothing has been uploaded against this vessel yet.
              </EmptyState>
            ) : (
              <div className="table-wrap" style={{ border: 'none' }}>
                <table className="data">
                  <thead>
                    <tr>
                      <th scope="col">Date</th>
                      <th scope="col">Window</th>
                      <th scope="col">Duration</th>
                      <th scope="col">Cameras</th>
                      <th scope="col">Hauls</th>
                      <th scope="col">Footage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recordings.data.map((r) => (
                      <tr key={r.id} style={{ cursor: 'default' }}>
                        <td className="cell-strong">{formatDate(r.recording_date)}</td>
                        <td className="cell-muted mono-time">
                          {String(r.start_time).slice(0, 5)}–{String(r.end_time).slice(0, 5)}
                        </td>
                        <td className="cell-muted">{durationLabel(r.duration_minutes)}</td>
                        <td className="cell-muted">{r.cameras_count}</td>
                        <td className="cell-muted">{r.hauls_count}</td>
                        <td>
                          {r.media_url ? (
                            <span className="badge badge-ok">Held</span>
                          ) : (
                            <span className="badge badge-neutral">Metadata only</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-head">
              <h2>Activity on this vessel</h2>
            </div>
            {audit.isLoading ? (
              <div className="card-body">
                <Skeleton />
              </div>
            ) : (audit.data || []).length === 0 ? (
              <EmptyState title="No recorded activity">
                Determinations and reviews for this vessel will appear here.
              </EmptyState>
            ) : (
              <div className="table-wrap" style={{ border: 'none' }}>
                <table className="data">
                  <thead>
                    <tr>
                      <th scope="col">When</th>
                      <th scope="col">Action</th>
                      <th scope="col">By</th>
                      <th scope="col">Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audit.data.map((a) => (
                      <tr key={a.id} style={{ cursor: 'default' }}>
                        <td className="cell-muted">{formatDateTime(a.created_at)}</td>
                        <td>
                          <span className="badge badge-neutral">{a.action.replace(/_/g, ' ')}</span>
                        </td>
                        <td className="cell-muted">{a.actor}</td>
                        <td className="cell-muted">{a.detail || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="col">
          <div className="card record-marks">
            <div className="card-head">
              <h2>Vessel review</h2>
            </div>
            <div className="card-body col">
              <div className="field">
                <label htmlFor="vessel-notes">Reviewer notes</label>
                <textarea
                  id="vessel-notes"
                  className="textarea"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Summary of this vessel's compliance position."
                  disabled={!session.can.submitVesselReview}
                />
              </div>

              {/* The role genuinely cannot do this, so the control is disabled
                  with the reason stated — not hidden, and not a dead button. */}
              {!session.can.submitVesselReview ? (
                <p className="field-hint" style={{ margin: 0 }}>
                  {session.role} can record flag determinations but cannot sign off a vessel
                  review. Ask a Grade 3 reviewer to submit.
                </p>
              ) : null}

              {submitReview.isError ? (
                <p className="field-error" role="alert" style={{ margin: 0 }}>
                  Not saved: {submitReview.error.message}
                </p>
              ) : null}

              <div className="row">
                <button
                  type="button"
                  className="btn btn-primary grow"
                  disabled={
                    !session.can.submitVesselReview || !notes.trim() || submitReview.isPending
                  }
                  onClick={() =>
                    submitReview.mutate({
                      vessel_id: Number(vesselId),
                      reviewed_by: session.name,
                      notes: notes.trim(),
                      status: 'submitted',
                    })
                  }
                >
                  Submit review
                </button>
              </div>
              <SaveIndicator state={saveState} error={submitReview.error} />
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h2>Previous reviews</h2>
            </div>
            {reviews.isLoading ? (
              <div className="card-body">
                <Skeleton />
              </div>
            ) : (reviews.data || []).length === 0 ? (
              <EmptyState title="No reviews submitted">
                This vessel has no signed-off review on record.
              </EmptyState>
            ) : (
              <div className="card-body col">
                {reviews.data.map((r) => (
                  <div key={r.id} style={{ borderBottom: '1px solid var(--line)', paddingBottom: 8 }}>
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <b style={{ fontSize: 13 }}>{r.reviewed_by}</b>
                      <span className="muted" style={{ fontSize: 11 }}>
                        {formatDateTime(r.created_at)}
                      </span>
                    </div>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--ink-2)' }}>
                      {r.notes}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
