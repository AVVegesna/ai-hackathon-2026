import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, mediaUrl } from '../lib/api'
import { timecode } from '../lib/format'
import { EmptyState, ErrorState, Skeleton } from '../components/ui/States'
import CompareVideos from '../components/CompareVideos'
import DetectionTimeline from '../components/DetectionTimeline'
import Stat from '../components/ui/Stat'
import VideoThumb from '../components/VideoThumb'

// Upload footage and run automated detection over it. Detection is a triage
// aid that proposes flags — a reviewer still makes every determination.
//
// Detection depends on a Python model that may not be installed, so the
// failure path is treated as a first-class state rather than an afterthought:
// it reports the backend's own reason and says what still works without it.

const POLL_MS = 900
const TERMINAL = ['completed', 'failed']

// The detector's model registry, mirrored for the picker. The two open-vocab
// YOLO-World models lead because protected-species bycatch is what the portal
// exists to catch; the fish counters are there for catch-composition context.
const MODELS = [
  {
    value: 'dolphin',
    label: 'Dolphin & marine mammal',
    hint: 'Open-vocabulary. Targets dolphins, porpoises and other marine mammals.',
  },
  {
    value: 'albatross',
    label: 'Albatross & seabird',
    hint: 'Open-vocabulary. Targets albatross, petrels and other seabirds.',
  },
  { value: 'tilapia', label: 'Tilapia counter', hint: 'Trained fish counter.' },
  {
    value: 'grayscale',
    label: 'Grayscale fish detector',
    hint: 'Tuned for low-colour underwater footage.',
  },
  { value: 'coco', label: 'Standard YOLOv8 (COCO)', hint: 'General objects, not fisheries-specific.' },
]

// Protected species the detector reports on regardless of which model ran — a
// fish count that catches a dolphin still has to raise it. Keyed by the meta
// fields the detector writes.
const PROTECTED_SPECIES = [
  {
    key: 'dolphin',
    noun: 'dolphin',
    badge: 'badge-dolphin',
    peak: 'peak_dolphin_count',
    frames: 'total_dolphin_frames',
    events: 'dolphin_events',
  },
  {
    key: 'albatross',
    noun: 'albatross',
    badge: 'badge-albatross',
    peak: 'peak_albatross_count',
    frames: 'total_albatross_frames',
    events: 'albatross_events',
  },
]

export default function UploadRoute() {
  const qc = useQueryClient()
  const fileInput = useRef(null)
  const compareRef = useRef(null)

  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const [selected, setSelected] = useState(null)
  const [status, setStatus] = useState(null)
  const [confidence, setConfidence] = useState(0.25)
  const [modelName, setModelName] = useState('dolphin')
  const [vesselId, setVesselId] = useState('')

  const videos = useQuery({ queryKey: ['videos'], queryFn: api.videos })
  const vessels = useQuery({ queryKey: ['vessels'], queryFn: api.vessels })

  // The processed video URL only comes back from /api/results, so fetch it
  // once a run has completed rather than guessing the filename.
  const results = useQuery({
    queryKey: ['detectionResults', selected],
    queryFn: () => api.detectionResults(selected),
    enabled: Boolean(selected) && status?.status === 'completed',
  })

  const selectedVideo = (videos.data || []).find((v) => v.video_id === selected)
  // Media is served as static files by the API, so it goes through mediaUrl
  // rather than the /api path — and picks up VITE_API_BASE_URL when the
  // frontend is hosted apart from the API.
  const rawOriginalUrl = selectedVideo?.url || (selected ? `/uploads/${selected}.mp4` : null)
  const originalUrl = rawOriginalUrl ? mediaUrl(rawOriginalUrl) : null
  const processedUrl = results.data?.processed_video_url
    ? mediaUrl(results.data.processed_video_url)
    : null

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

  // Opening footage that already has a result starts the controls from the run
  // that produced it. Otherwise the panel reads "Ran Albatross & Seabird" while
  // the picker still says Dolphin, and Re-run would quietly change species.
  const completedModel = status?.status === 'completed' ? status.result?.model_name : undefined
  const completedConfidence =
    status?.status === 'completed' ? status.result?.confidence_threshold : undefined

  useEffect(() => {
    if (completedModel && MODELS.some((m) => m.value === completedModel)) {
      setModelName(completedModel)
    }
    if (typeof completedConfidence === 'number') {
      setConfidence(completedConfidence)
    }
  }, [selected, completedModel, completedConfidence])

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
      await api.startDetection(selected, {
        model_name: modelName,
        confidence,
        vessel_id: vesselId || undefined,
      })
    } catch (err) {
      setStatus({ status: 'failed', progress: 100, message: err.message })
    }
  }, [selected, modelName, confidence, vesselId])

  const running = status && !TERMINAL.includes(status.status)
  const failed = status?.status === 'failed'
  const result = status?.status === 'completed' ? status.result : null

  // Which model produced this result — not which one the picker currently
  // shows, since the re-run control is free to have moved on since.
  const ranModel = result?.model_name ?? modelName

  // Report a species when the run targeted it, or when it was detected anyway.
  // A zero count reads differently in each case: "none found" only means
  // something if the model was looking. Results written before seabird
  // detection existed simply carry no albatross fields and report nothing.
  const reportedSpecies = (result ? PROTECTED_SPECIES : []).flatMap((s) => {
    const peakValue = result[s.peak] ?? 0
    const framesValue = result[s.frames] ?? 0
    if (ranModel !== s.key && peakValue === 0) return []
    return [{ ...s, peakValue, framesValue }]
  })

  // One chronological list across species, so a run that caught both reads in
  // the order a reviewer would scrub through it, not as two separate tables.
  const detectedEvents = (result ? PROTECTED_SPECIES : [])
    .flatMap((s) => (result[s.events] || []).map((ev) => ({ ...ev, species: s })))
    .sort((a, b) => a.timestamp - b.timestamp)

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
                    <p className="muted" style={{ fontSize: 13 }}>
                      Runs the detection model over the footage and proposes flags for review.
                      Nothing is determined automatically — every flag it raises still needs a
                      reviewer's determination.
                    </p>

                    {/* Which model runs decides which species can be found at
                        all, so it is the first choice, not a buried option. */}
                    <div className="field">
                      <label htmlFor="model">Detection model</label>
                      <select
                        id="model"
                        className="select"
                        value={modelName}
                        onChange={(e) => setModelName(e.target.value)}
                        aria-describedby="model-hint"
                      >
                        {MODELS.map((m) => (
                          <option key={m.value} value={m.value}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                      <span className="field-hint" id="model-hint">
                        {MODELS.find((m) => m.value === modelName)?.hint}
                      </span>
                    </div>

                    {/* Confidence is a recall/precision trade-off, so say which
                        way the slider moves rather than just showing a number. */}
                    <div className="field">
                      <label htmlFor="confidence">Detection confidence threshold</label>
                      <div className="slider-row">
                        <input
                          id="confidence"
                          type="range"
                          className="slider"
                          min={0.05}
                          max={0.9}
                          step={0.05}
                          value={confidence}
                          onChange={(e) => setConfidence(Number(e.target.value))}
                          aria-describedby="confidence-hint"
                        />
                        <span className="slider-value">{confidence.toFixed(2)}</span>
                      </div>
                      <span className="field-hint" id="confidence-hint">
                        {confidence <= 0.2
                          ? 'Low — catches more, including false positives. More to review.'
                          : confidence >= 0.5
                            ? 'High — only confident detections. Risks missing genuine events.'
                            : 'Balanced — the default for routine screening.'}
                      </span>
                    </div>

                    {/* Uploads carry no vessel of their own, and a flag has to
                        hang off a recording that belongs to one. Ask, rather
                        than attribute footage to a vessel by guesswork. */}
                    <div className="field">
                      <label htmlFor="vessel">Attribute this footage to</label>
                      <select
                        id="vessel"
                        className="select"
                        value={vesselId}
                        onChange={(e) => setVesselId(e.target.value)}
                      >
                        <option value="">Leave unattributed</option>
                        {(vessels.data || [])
                          .filter((v) => v.imo !== 'UNASSIGNED')
                          .map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name} · IMO {v.imo}
                            </option>
                          ))}
                      </select>
                      <span className="field-hint">
                        {vesselId
                          ? 'Flags will appear on this vessel’s record.'
                          : 'Flags will be held against “Unattributed uploads” until assigned.'}
                      </span>
                    </div>

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
                    {/* Name the run that produced these figures. Once re-running
                        can change the model, "peak albatross: 0" is meaningless
                        without knowing whether that run was looking for one. */}
                    {result.model_label ? (
                      <p className="muted" style={{ fontSize: 12 }}>
                        Ran <b>{result.model_label}</b>
                        {typeof result.confidence_threshold === 'number'
                          ? ` at a ${result.confidence_threshold.toFixed(2)} confidence threshold`
                          : null}
                        .
                      </p>
                    ) : null}

                    {/* Re-evaluation. A first pass at one threshold is not the
                        last word: a reviewer who suspects the model missed
                        something needs to run it again lower without
                        re-uploading. Flags are added to the same recording. */}
                    <div className="rerun">
                      {/* A reviewer who suspects a different species is present
                          needs to swap the model here too, not re-upload. */}
                      <div className="field">
                        <label htmlFor="rerun-model">Model</label>
                        <select
                          id="rerun-model"
                          className="select"
                          value={modelName}
                          onChange={(e) => setModelName(e.target.value)}
                        >
                          {MODELS.map((m) => (
                            <option key={m.value} value={m.value}>
                              {m.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="field grow">
                        <label htmlFor="rerun-confidence">
                          Re-evaluate at a different threshold
                        </label>
                        <div className="slider-row">
                          <input
                            id="rerun-confidence"
                            type="range"
                            className="slider"
                            min={0.05}
                            max={0.9}
                            step={0.05}
                            value={confidence}
                            onChange={(e) => setConfidence(Number(e.target.value))}
                          />
                          <span className="slider-value">{confidence.toFixed(2)}</span>
                        </div>
                        <span className="field-hint">
                          Replaces the annotated render and adds any new events to this
                          recording. Determinations already recorded are untouched.
                        </span>
                      </div>
                      <button type="button" className="btn" onClick={startDetection}>
                        Re-run detection
                      </button>
                    </div>

                    <div className="stats">
                      {/* Report a species when the run targeted it or when it
                          turned up anyway. Suppressing an untargeted species
                          that was detected would hide the bycatch. */}
                      {reportedSpecies.map((s) => (
                        <React.Fragment key={s.key}>
                          <Stat
                            label={`Peak ${s.noun} count`}
                            value={s.peakValue}
                            note="Most in a single frame"
                            alert={s.peakValue > 0}
                          />
                          <Stat
                            label={`Frames with ${s.noun}`}
                            value={s.framesValue}
                            note={`of ${result.total_frames ?? 0} sampled`}
                          />
                        </React.Fragment>
                      ))}
                      <Stat
                        label="Peak all species"
                        value={result.peak_count ?? 0}
                        note={`avg ${(result.average_count ?? 0).toFixed(1)} per frame`}
                      />
                      <Stat
                        label="Clip length"
                        value={timecode(result.duration_seconds)}
                        note={`${result.fps ?? '—'} fps`}
                      />
                    </div>

                    {/* Before and after, on one playhead. */}
                    {processedUrl ? (
                      <>
                        <h3 className="kicker">Detections drawn on the footage</h3>
                        <CompareVideos
                          ref={compareRef}
                          originalUrl={originalUrl}
                          processedUrl={processedUrl}
                        />
                      </>
                    ) : null}

                    <h3 className="kicker">Detections across the clip</h3>
                    <DetectionTimeline
                      dolphinCounts={result.dolphin_frame_counts}
                      albatrossCounts={result.albatross_frame_counts}
                      fishCounts={result.fish_frame_counts}
                      totalCounts={result.frame_counts}
                      durationSeconds={result.duration_seconds}
                      onSeek={(t) => compareRef.current?.seek(t)}
                    />
                    <div className="legend">
                      <span>
                        <i style={{ background: 'var(--species-dolphin)' }} />
                        Dolphin present
                      </span>
                      <span>
                        <i style={{ background: 'var(--species-albatross)' }} />
                        Albatross present
                      </span>
                      <span>
                        <i style={{ background: 'var(--accent)' }} />
                        Other species
                      </span>
                    </div>

                    {detectedEvents.length > 0 ? (
                      <>
                        <h3 className="kicker">
                          Flags raised — {detectedEvents.length} event
                          {detectedEvents.length === 1 ? '' : 's'}
                        </h3>
                        <div className="table-wrap">
                          <table className="data">
                            <thead>
                              <tr>
                                <th scope="col">At</th>
                                <th scope="col">Species</th>
                                <th scope="col">Count</th>
                                <th scope="col">Proposed flag</th>
                                <th scope="col" />
                              </tr>
                            </thead>
                            <tbody>
                              {detectedEvents.map((ev, i) => (
                                <tr key={`${ev.species.key}-${i}`} className="static-row">
                                  <td className="mono-time">{timecode(ev.timestamp)}</td>
                                  <td>
                                    <span className={`badge ${ev.species.badge}`}>
                                      {ev.species.noun}
                                    </span>
                                  </td>
                                  <td>{ev.count}</td>
                                  <td>
                                    <span className="badge badge-high">
                                      <span className="badge-glyph" aria-hidden="true">
                                        ▲
                                      </span>
                                      Bycatch species
                                    </span>
                                  </td>
                                  <td className="cell-num">
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-ghost"
                                      onClick={() => compareRef.current?.seek(ev.timestamp)}
                                      disabled={!processedUrl}
                                    >
                                      Jump to
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {/* Every distinct sighting is raised, but a continuous
                            sighting spans many sampled frames and produces one
                            flag rather than one per frame. Say so, or the event
                            count above looks like it disagrees with the queue. */}
                        <p className="field-hint">
                          Consecutive detections are grouped into distinct sightings, so the review
                          queue holds one flag per sighting rather than one per event listed here.
                        </p>
                        <p>
                          <Link to="/queue?severity=High">Review the flags this raised →</Link>
                        </p>
                      </>
                    ) : (
                      <div className="row">
                        <span className="badge badge-ok">
                          No{' '}
                          {PROTECTED_SPECIES.find((s) => s.key === ranModel)?.noun ??
                            'protected species'}{' '}
                          detected
                        </span>
                        <span className="muted" style={{ fontSize: 12 }}>
                          Nothing was added to the review queue.
                        </span>
                      </div>
                    )}
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
            <div className="footage-list">
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
                  <VideoThumb url={v.url} at={1} alt={`Still from ${v.filename}`} />
                  <span className="footage-meta">
                    <span className="footage-name">{v.filename}</span>
                    {v.has_dolphin ? (
                      <span className="badge badge-high">
                        <span className="badge-glyph" aria-hidden="true">
                          ▲
                        </span>
                        {v.peak_dolphin_count} dolphin
                      </span>
                    ) : v.has_results ? (
                      <span className="badge badge-ok">Screened · clear</span>
                    ) : (
                      <span className="badge badge-neutral">Not screened</span>
                    )}
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
