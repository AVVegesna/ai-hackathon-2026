import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { timecode } from '../lib/format'
import { EmptyState, ErrorState, Skeleton } from '../components/ui/States'

// Upload footage and run automated detection over it. Detection is a triage
// aid that proposes flags — a reviewer still makes every determination.
//
// Detection depends on a Python model that may not be installed, so the
// failure path is treated as a first-class state rather than an afterthought:
// it reports the backend's own reason and says what still works without it.

const POLL_MS = 900
const TERMINAL = ['completed', 'failed']

export default function UploadRoute() {
  const qc = useQueryClient()
  const fileInput = useRef(null)

  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const [selected, setSelected] = useState(null)
  const [status, setStatus] = useState(null)

  const videos = useQuery({ queryKey: ['videos'], queryFn: api.videos })

  // Poll only while a run is genuinely in flight, and stop the moment it
  // reaches a terminal state.
  useEffect(() => {
    if (!selected || !status || TERMINAL.includes(status.status)) return
    const t = setInterval(async () => {
      try {
        const next = await api.detectionStatus(selected)
        setStatus(next)
        if (TERMINAL.includes(next.status)) {
          qc.invalidateQueries({ queryKey: ['videos'] })
          qc.invalidateQueries({ queryKey: ['queue'] })
          qc.invalidateQueries({ queryKey: ['queueStats'] })
        }
      } catch (err) {
        setStatus({ status: 'failed', progress: 100, message: err.message })
      }
    }, POLL_MS)
    return () => clearInterval(t)
  }, [selected, status, qc])

  const upload = useCallback(
    async (file) => {
      if (!file) return
      if (!file.type.startsWith('video/')) {
        setUploadError(new Error(`${file.name} is not a video file.`))
        return
      }
      setUploading(true)
      setUploadError(null)
      setStatus(null)
      try {
        const form = new FormData()
        form.append('file', file)
        // FormData must not carry the JSON content-type the api client sets,
        // so this one request goes direct.
        const res = await fetch('/api/upload', { method: 'POST', body: form })
        if (!res.ok) throw new Error(`Upload failed (${res.status})`)
        const data = await res.json()
        setSelected(data.video_id)
        qc.invalidateQueries({ queryKey: ['videos'] })
      } catch (err) {
        setUploadError(err)
      } finally {
        setUploading(false)
      }
    },
    [qc]
  )

  const startDetection = useCallback(async () => {
    if (!selected) return
    setStatus({ status: 'starting', progress: 0, message: 'Requesting detection…' })
    try {
      await api.startDetection(selected, { model_name: 'dolphin', confidence: 0.25 })
    } catch (err) {
      setStatus({ status: 'failed', progress: 100, message: err.message })
    }
  }, [selected])

  const running = status && !TERMINAL.includes(status.status)
  const failed = status?.status === 'failed'
  const result = status?.status === 'completed' ? status.result : null

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="kicker">Automated detection over uploaded footage</div>
          <h1>Ingest</h1>
        </div>
      </div>

      <div className="split split-wide">
        <div className="col">
          {/* Drop zone */}
          <div
            className="card"
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              upload(e.dataTransfer.files?.[0])
            }}
            style={{
              borderStyle: 'dashed',
              borderWidth: 2,
              borderColor: dragging ? 'var(--accent)' : 'var(--line-strong)',
              background: dragging ? 'var(--accent-tint)' : 'var(--surface)',
            }}
          >
            <div className="card-body" style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
              <h2 style={{ fontSize: 16, marginBottom: 4 }}>Drop a recording here</h2>
              <p className="muted" style={{ margin: '0 0 var(--space-3)', fontSize: 13 }}>
                MP4 footage from a vessel camera. It is stored against the programme and can then
                be run through detection.
              </p>
              <input
                ref={fileInput}
                type="file"
                accept="video/*"
                className="sr-only"
                onChange={(e) => upload(e.target.files?.[0])}
              />
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => fileInput.current?.click()}
                disabled={uploading}
              >
                {uploading ? 'Uploading…' : 'Choose a file'}
              </button>
            </div>
          </div>

          {uploadError ? <ErrorState title="Upload failed" error={uploadError} /> : null}

          {/* Detection run */}
          {selected ? (
            <div className="card">
              <div className="card-head">
                <h2>Detection</h2>
                <div className="card-head-end">{selected}</div>
              </div>
              <div className="card-body col">
                {!status ? (
                  <>
                    <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                      Runs the dolphin detection model over the footage and proposes flags for
                      review. Nothing is determined automatically.
                    </p>
                    <div className="row">
                      <button type="button" className="btn btn-primary" onClick={startDetection}>
                        Run detection
                      </button>
                    </div>
                  </>
                ) : null}

                {running ? (
                  <div className="col" aria-live="polite">
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 13 }}>{status.message}</span>
                      <span className="mono-time muted" style={{ fontSize: 12 }}>
                        {status.progress ?? 0}%
                      </span>
                    </div>
                    <span className="bar-track" style={{ height: 6 }}>
                      <span className="bar-fill" style={{ width: `${status.progress ?? 0}%` }} />
                    </span>
                  </div>
                ) : null}

                {/* Report the backend's actual reason rather than guessing at
                    a cause — the failure can be a missing interpreter, a
                    missing model, or the detector erroring mid-run. */}
                {failed ? (
                  <div className="state state-error" role="alert" style={{ padding: 'var(--space-3)' }}>
                    <h3>Detection could not run</h3>
                    <p>{status.message}</p>
                    <p>
                      The upload itself succeeded — the footage is stored and can be reviewed
                      manually in the meantime.
                    </p>
                    <div className="state-actions">
                      <button type="button" className="btn" onClick={startDetection}>
                        Try again
                      </button>
                      <Link className="btn" to="/queue">
                        Go to the review queue
                      </Link>
                    </div>
                  </div>
                ) : null}

                {result ? (
                  <div className="col">
                    <div className="row">
                      {result.has_dolphin ? (
                        <span className="badge badge-high">
                          Detections found · peak {result.peak_dolphin_count ?? 0}
                        </span>
                      ) : (
                        <span className="badge badge-ok">No detections</span>
                      )}
                    </div>
                    {(result.dolphin_events || []).length > 0 ? (
                      <div className="table-wrap">
                        <table className="data">
                          <thead>
                            <tr>
                              <th scope="col">At</th>
                              <th scope="col">Count</th>
                            </tr>
                          </thead>
                          <tbody>
                            {result.dolphin_events.slice(0, 10).map((ev, i) => (
                              <tr key={i} className="static-row">
                                <td className="mono-time">{timecode(ev.timestamp)}</td>
                                <td>{ev.count}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : null}
                    <p>
                      <Link to="/queue">Review the flags this raised →</Link>
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        {/* Held footage */}
        <div className="card">
          <div className="card-head">
            <h2>Held footage</h2>
            <div className="card-head-end">{videos.data?.length ?? 0}</div>
          </div>
          {videos.isLoading ? (
            <div className="card-body">
              <Skeleton />
            </div>
          ) : videos.isError ? (
            <ErrorState error={videos.error} onRetry={videos.refetch} />
          ) : (videos.data || []).length === 0 ? (
            <EmptyState title="No footage uploaded">
              Uploaded recordings will be listed here.
            </EmptyState>
          ) : (
            <div className="flaglist">
              {videos.data.map((v) => (
                <button
                  key={v.video_id}
                  type="button"
                  aria-current={v.video_id === selected}
                  onClick={() => {
                    setSelected(v.video_id)
                    setStatus(v.has_results ? { status: 'idle', progress: 0, message: '' } : null)
                  }}
                >
                  <span className="fl-top">
                    <span style={{ fontWeight: 600, fontSize: 12 }}>{v.filename}</span>
                  </span>
                  <span className="fl-type">
                    {v.has_dolphin ? `Detections · peak ${v.peak_dolphin_count}` : v.status}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
