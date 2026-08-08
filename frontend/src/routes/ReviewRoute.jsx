import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { formatDate, formatDateTime, timecode, durationLabel } from '../lib/format'
import { useSession } from '../lib/prefs'
import VideoPlayer from '../components/VideoPlayer'
import { SeverityBadge, StatusBadge, DueBadge, Kbd } from '../components/ui/Badges'
import { ErrorState, SaveIndicator, Skeleton } from '../components/ui/States'
import '../styles/workspace.css'

// One flag at a time. The reviewer sees the footage, the context, and the
// decision on a single screen, then moves to the next item without returning
// to the list.

const CHOICES = [
  { value: 'upheld', key: 'u', label: 'Uphold', hint: 'The flag is a genuine compliance concern' },
  { value: 'dismissed', key: 'd', label: 'Dismiss', hint: 'No compliance issue on review' },
  { value: 'escalated', key: 's', label: 'Escalate', hint: 'Refer onward — stays open' },
]

export default function ReviewRoute() {
  const { flagId } = useParams()
  const navigate = useNavigate()
  const [search] = useSearchParams()
  const qc = useQueryClient()
  const session = useSession()
  const playerRef = useRef(null)

  const [showShortcuts, setShowShortcuts] = useState(false)
  const [determination, setDetermination] = useState('')
  const [reason, setReason] = useState('')
  const [validation, setValidation] = useState('')

  const flag = useQuery({
    queryKey: ['flag', flagId],
    queryFn: () => api.flag(flagId),
  })

  // The queue this flag was opened from, so next/previous follows the same
  // ordering and filters the reviewer was working through.
  const queueArgs = useMemo(() => {
    const o = Object.fromEntries(search.entries())
    return { ...o, limit: 200 }
  }, [search])

  const queue = useQuery({
    queryKey: ['queue', queueArgs],
    queryFn: () => api.queue(queueArgs),
  })

  const siblings = queue.data?.rows || []
  const position = siblings.findIndex((f) => String(f.id) === String(flagId))
  const prevFlag = position > 0 ? siblings[position - 1] : null
  const nextFlag = position >= 0 && position < siblings.length - 1 ? siblings[position + 1] : null

  // All flags on this recording, so every marker on the scrubber is present —
  // not just the one being reviewed.
  const recordingFlags = useQuery({
    queryKey: ['recordingFlags', flag.data?.recording_id],
    queryFn: () => api.recordingFlags(flag.data.recording_id),
    enabled: Boolean(flag.data?.recording_id),
  })

  useEffect(() => {
    setDetermination('')
    setReason('')
    setValidation('')
  }, [flagId])

  const resolve = useMutation({
    mutationFn: (body) => api.resolveFlag(flagId, body),
    onSuccess: (updated) => {
      qc.setQueryData(['flag', flagId], updated)
      qc.invalidateQueries({ queryKey: ['queue'] })
      qc.invalidateQueries({ queryKey: ['queueStats'] })
      qc.invalidateQueries({ queryKey: ['recordingFlags'] })
      qc.invalidateQueries({ queryKey: ['audit'] })
    },
  })

  const goTo = useCallback(
    (target) => {
      if (!target) return
      navigate(`/review/${target.id}?${search.toString()}`)
    },
    [navigate, search]
  )

  const submit = useCallback(() => {
    if (!determination) {
      setValidation('Choose a determination before submitting.')
      return
    }
    if (!reason.trim()) {
      setValidation('A reason is required — determinations must be justifiable on the record.')
      return
    }
    setValidation('')
    resolve.mutate(
      { determination, resolution: reason.trim(), resolved_by: session.name },
      { onSuccess: () => nextFlag && goTo(nextFlag) }
    )
  }, [determination, reason, resolve, session.name, nextFlag, goTo])

  // Keyboard model. The whole screen is operable without a mouse; the goal is
  // a determination in a handful of keystrokes once the footage is seen.
  useEffect(() => {
    const onKey = (e) => {
      const typing =
        e.target instanceof HTMLElement &&
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)

      if (e.key === '?' && !typing) {
        e.preventDefault()
        setShowShortcuts((s) => !s)
        return
      }
      if (e.key === 'Escape') {
        setShowShortcuts(false)
        return
      }
      // Cmd/Ctrl+Enter submits from anywhere, including the reason field.
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        submit()
        return
      }
      if (typing) return

      const p = playerRef.current
      switch (e.key) {
        case ' ':
          e.preventDefault()
          p?.togglePlay()
          break
        case 'ArrowLeft':
          e.preventDefault()
          p?.seekBy(e.shiftKey ? -10 : -1)
          break
        case 'ArrowRight':
          e.preventDefault()
          p?.seekBy(e.shiftKey ? 10 : 1)
          break
        case ',':
          e.preventDefault()
          p?.seekBy(-1 / 25)
          break
        case '.':
          e.preventDefault()
          p?.seekBy(1 / 25)
          break
        case 'g':
          e.preventDefault()
          p?.toggleGrid()
          break
        case 'n':
          e.preventDefault()
          goTo(nextFlag)
          break
        case 'p':
          e.preventDefault()
          goTo(prevFlag)
          break
        case 'u':
          setDetermination('upheld')
          break
        case 'd':
          setDetermination('dismissed')
          break
        case 's':
          setDetermination('escalated')
          break
        default:
          if (/^[1-4]$/.test(e.key)) {
            e.preventDefault()
            p?.setCamera(Number(e.key) - 1)
          }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [submit, goTo, nextFlag, prevFlag])

  if (flag.isLoading) {
    return (
      <div className="ws">
        <div className="ws-bar">
          <Skeleton width={220} height={18} />
        </div>
        <div className="ws-col-center" style={{ padding: 'var(--space-3)' }}>
          <Skeleton height={320} />
        </div>
      </div>
    )
  }

  if (flag.isError) {
    return (
      <div className="page">
        <ErrorState title="Could not load this flag" error={flag.error} onRetry={flag.refetch} />
        <p style={{ marginTop: 'var(--space-3)' }}>
          <Link to="/queue">← Back to the queue</Link>
        </p>
      </div>
    )
  }

  const f = flag.data
  const isClosed = Boolean(f.resolved)
  const saveState = resolve.isPending
    ? 'saving'
    : resolve.isError
      ? 'error'
      : resolve.isSuccess
        ? 'saved'
        : 'idle'

  return (
    <div className="ws">
      <div className="ws-bar">
        <Link to={`/queue?${search.toString()}`} className="btn btn-sm btn-ghost">
          ← Queue
        </Link>
        <h1>{f.vessel_name}</h1>
        <SeverityBadge severity={f.severity} />
        <StatusBadge flag={f} />
        <DueBadge dueAt={f.due_at} />

        <div className="ws-bar-end">
          <span className="ws-pos">
            {position >= 0 ? `${position + 1} of ${siblings.length}` : ''}
          </span>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => goTo(prevFlag)}
            disabled={!prevFlag}
            title="Previous flag (p)"
          >
            ← Prev
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => goTo(nextFlag)}
            disabled={!nextFlag}
            title="Next flag (n)"
          >
            Next →
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={() => setShowShortcuts(true)}
            aria-label="Keyboard shortcuts"
            title="Keyboard shortcuts (?)"
          >
            ?
          </button>
        </div>
      </div>

      <div className="ws-body">
        {/* Left: the other flags on this recording */}
        <div className="ws-col ws-col-left">
          <div className="ws-section" style={{ borderBottom: 'none', paddingBottom: 0 }}>
            <h2>Flags on this recording</h2>
          </div>
          <div className="flaglist">
            {(recordingFlags.data || []).map((rf) => (
              <button
                key={rf.id}
                type="button"
                aria-current={String(rf.id) === String(flagId)}
                onClick={() => navigate(`/review/${rf.id}?${search.toString()}`)}
              >
                <span className="fl-top">
                  <span className="mono-time">{timecode(rf.timestamp_seconds)}</span>
                  <SeverityBadge severity={rf.severity} />
                </span>
                <span className="fl-type">{rf.flag_type}</span>
                {rf.resolved ? <span className="badge badge-ok">Determined</span> : null}
              </button>
            ))}
            {recordingFlags.isLoading ? (
              <div style={{ padding: 'var(--space-3)' }}>
                <Skeleton />
              </div>
            ) : null}
          </div>
        </div>

        {/* Centre: the footage */}
        <div className="ws-col ws-col-center">
          <VideoPlayer
            ref={playerRef}
            mediaUrl={f.media_url}
            camerasCount={f.cameras_count}
            flags={recordingFlags.data || []}
            activeFlagId={f.id}
            onSelectFlag={(sel) => navigate(`/review/${sel.id}?${search.toString()}`)}
            recordedMinutes={f.duration_minutes}
            recordingLabel={`${formatDate(f.recording_date)} · ${f.start_time}`}
          />

          <div className="card">
            <div className="card-head">
              <h2>Flag detail</h2>
              <div className="card-head-end">
                Raised {formatDateTime(f.created_at)}
              </div>
            </div>
            <div className="card-body">
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{f.flag_type}</div>
              <p style={{ margin: 0, color: 'var(--ink-2)' }}>
                {f.description || 'No description was recorded when this flag was raised.'}
              </p>
              <ul className="meta-list" style={{ marginTop: 'var(--space-3)' }}>
                <li>
                  <b>At</b>
                  <span className="mono-time">{timecode(f.timestamp_seconds)}</span>
                </li>
                <li>
                  <b>Camera</b>
                  <span>{f.camera_id ? `CAM ${f.camera_id}` : '—'}</span>
                </li>
                <li>
                  <b>Assigned</b>
                  <span>{f.assigned_to || 'Unassigned'}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Right: the decision */}
        <div className="ws-col ws-col-right">
          <div className="ws-section record-marks">
            <h2>Determination</h2>

            {isClosed ? (
              <div className="det-resolved">
                <b>Determination recorded</b>
                <div>
                  <StatusBadge flag={f} /> by {f.resolved_by}
                </div>
                <div className="muted">{formatDateTime(f.resolved_at)}</div>
                {f.resolution ? <p style={{ margin: 0 }}>{f.resolution}</p> : null}
                <p className="muted" style={{ margin: 0, fontSize: 11 }}>
                  Records are append-only. Raise a new flag if this needs revisiting.
                </p>
              </div>
            ) : (
              <div className="determination" style={{ padding: 0 }}>
                <div className="det-choices" role="radiogroup" aria-label="Determination">
                  {CHOICES.map((c) => (
                    <label
                      key={c.value}
                      className="det-choice"
                      data-checked={determination === c.value}
                    >
                      <input
                        type="radio"
                        name="determination"
                        value={c.value}
                        checked={determination === c.value}
                        onChange={() => setDetermination(c.value)}
                      />
                      <span className="det-choice-text">
                        <b>
                          {c.label} <Kbd>{c.key}</Kbd>
                        </b>
                        <span>{c.hint}</span>
                      </span>
                    </label>
                  ))}
                </div>

                <div className="field">
                  <label htmlFor="reason">Reason (required)</label>
                  <textarea
                    id="reason"
                    className="textarea"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="What you observed, and why it supports this determination."
                    aria-describedby="reason-hint"
                  />
                  <span className="field-hint" id="reason-hint">
                    Written to the audit trail against your name.
                  </span>
                </div>

                {validation ? (
                  <p className="field-error" role="alert" style={{ margin: 0 }}>
                    {validation}
                  </p>
                ) : null}

                {resolve.isError ? (
                  <p className="field-error" role="alert" style={{ margin: 0 }}>
                    Not saved: {resolve.error.message}
                  </p>
                ) : null}

                <div className="row">
                  <button
                    type="button"
                    className="btn btn-primary grow"
                    onClick={submit}
                    disabled={resolve.isPending || !session.can.determineFlags}
                    title={
                      session.can.determineFlags
                        ? 'Submit determination (Cmd+Enter)'
                        : `${session.role} cannot record determinations`
                    }
                  >
                    {resolve.isPending ? 'Submitting…' : 'Submit determination'}
                  </button>
                </div>

                <div className="row">
                  <SaveIndicator state={saveState} error={resolve.error} />
                  <span className="muted grow" style={{ fontSize: 11, textAlign: 'right' }}>
                    <Kbd>⌘</Kbd>
                    <Kbd>↵</Kbd> submit
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="ws-section">
            <h2>Vessel</h2>
            <div style={{ fontWeight: 600 }}>{f.vessel_name}</div>
            <ul className="meta-list" style={{ marginTop: 6, flexDirection: 'column', gap: 2 }}>
              <li>
                <b>IMO</b>
                <span>{f.imo}</span>
              </li>
              <li>
                <b>Licence</b>
                <span>{f.licence}</span>
              </li>
              <li>
                <b>Gear</b>
                <span>{f.gear}</span>
              </li>
            </ul>
            <p style={{ marginTop: 'var(--space-2)', marginBottom: 0 }}>
              <Link to={`/vessels/${f.vessel_id}`}>Vessel record →</Link>
            </p>
          </div>
        </div>
      </div>

      {showShortcuts ? <ShortcutSheet onClose={() => setShowShortcuts(false)} /> : null}
    </div>
  )
}

function ShortcutSheet({ onClose }) {
  const groups = [
    {
      title: 'Playback',
      items: [
        [['Space'], 'Play / pause'],
        [['←', '→'], 'Step 1 second'],
        [['⇧', '←/→'], 'Step 10 seconds'],
        [[',', '.'], 'Frame step'],
        [['1', '4'], 'Select camera'],
        [['g'], 'All cameras / single'],
      ],
    },
    {
      title: 'Determination',
      items: [
        [['u'], 'Uphold'],
        [['d'], 'Dismiss'],
        [['s'], 'Escalate'],
        [['⌘', '↵'], 'Submit'],
      ],
    },
    {
      title: 'Navigation',
      items: [
        [['n'], 'Next flag'],
        [['p'], 'Previous flag'],
        [['?'], 'This sheet'],
        [['Esc'], 'Close'],
      ],
    },
  ]

  return (
    <div
      className="overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      onClick={onClose}
    >
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>Keyboard shortcuts</h2>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            style={{ marginLeft: 'auto' }}
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div className="sheet-body">
          {groups.map((g) => (
            <div className="shortcut-group" key={g.title}>
              <h3>{g.title}</h3>
              <dl>
                {g.items.map(([keys, desc]) => (
                  <div key={desc}>
                    <dt>
                      {keys.map((k) => (
                        <Kbd key={k}>{k}</Kbd>
                      ))}
                    </dt>
                    <dd>{desc}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
