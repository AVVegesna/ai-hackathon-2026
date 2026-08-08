import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { formatDate, timecode } from '../lib/format'
import { SeverityBadge, DueBadge, Kbd } from '../components/ui/Badges'
import { TableSkeleton, EmptyState, ErrorState } from '../components/ui/States'

// The queue is home. The unit of work is a flagged event with a deadline,
// not a vessel — so this is the list a reviewer starts their shift on.
//
// Filters live in the URL, which means a filtered queue is a shareable link
// and the browser's back button behaves.

const SEVERITIES = ['High', 'Medium', 'Low']

export default function QueueRoute() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()

  const severity = params.get('severity') || ''
  const overdue = params.get('overdue') === 'true'
  const q = params.get('q') || ''
  const sort = params.get('sort') || 'due_at'
  const dir = params.get('dir') || 'asc'

  const [searchDraft, setSearchDraft] = useState(q)
  const searchRef = useRef(null)

  // Debounce the text filter so typing does not fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (searchDraft) next.set('q', searchDraft)
          else next.delete('q')
          return next
        },
        { replace: true }
      )
    }, 250)
    return () => clearTimeout(t)
  }, [searchDraft, setParams])

  const queryArgs = useMemo(
    () => ({ severity, overdue: overdue || undefined, q, sort, dir, limit: 200 }),
    [severity, overdue, q, sort, dir]
  )

  const queue = useQuery({
    queryKey: ['queue', queryArgs],
    queryFn: () => api.queue(queryArgs),
  })

  const stats = useQuery({ queryKey: ['queueStats'], queryFn: api.queueStats })

  const rows = queue.data?.rows || []

  // Keyboard cursor. j/k move, Enter opens — the queue is meant to be worked
  // without reaching for the mouse.
  const [cursor, setCursor] = useState(0)
  useEffect(() => {
    setCursor(0)
  }, [queryArgs])

  useEffect(() => {
    const onKey = (e) => {
      const typing =
        e.target instanceof HTMLElement &&
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)

      if (e.key === '/' && !typing) {
        e.preventDefault()
        searchRef.current?.focus()
        return
      }
      if (typing) return

      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault()
        setCursor((c) => Math.min(c + 1, rows.length - 1))
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault()
        setCursor((c) => Math.max(c - 1, 0))
      } else if (e.key === 'Enter' && rows[cursor]) {
        e.preventDefault()
        navigate(`/review/${rows[cursor].id}${window.location.search}`)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [rows, cursor, navigate])

  // Keep the keyboard cursor in view as it moves.
  useEffect(() => {
    document
      .querySelector('tr[data-cursor="true"]')
      ?.scrollIntoView({ block: 'nearest' })
  }, [cursor])

  const setParam = useCallback(
    (key, value) => {
      setParams((prev) => {
        const next = new URLSearchParams(prev)
        if (value === null || value === '' || value === false) next.delete(key)
        else next.set(key, String(value))
        return next
      })
    },
    [setParams]
  )

  const toggleSort = (key) => {
    if (sort === key) setParam('dir', dir === 'asc' ? 'desc' : 'asc')
    else {
      setParam('sort', key)
      setParam('dir', 'asc')
    }
  }

  const sortIndicator = (key) => (sort === key ? (dir === 'asc' ? '↑' : '↓') : '')
  const totals = stats.data?.totals

  const hasFilters = Boolean(severity || overdue || q)

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="kicker">Flagged events awaiting determination</div>
          <h1>Review queue</h1>
        </div>
        <div className="page-head-end">
          <label className="sr-only" htmlFor="queue-search">
            Search the queue
          </label>
          <input
            id="queue-search"
            ref={searchRef}
            className="input"
            style={{ width: 260 }}
            placeholder="Search vessel, IMO, licence or flag"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
          />
        </div>
      </div>

      {/* Every figure below is computed in SQL from the flags table. */}
      <QueueStats query={stats} />

      <div className="toolbar" style={{ marginTop: 'var(--space-4)' }}>
        <div className="chips" role="group" aria-label="Filter by severity">
          <button
            type="button"
            className="chip"
            aria-pressed={severity === ''}
            onClick={() => setParam('severity', null)}
          >
            All
          </button>
          {SEVERITIES.map((s) => (
            <button
              key={s}
              type="button"
              className="chip"
              aria-pressed={severity === s}
              onClick={() => setParam('severity', severity === s ? null : s)}
            >
              {s}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="chip"
          style={{ border: '1px solid var(--line-strong)', borderRadius: 'var(--radius-sm)' }}
          aria-pressed={overdue}
          onClick={() => setParam('overdue', !overdue)}
        >
          Overdue only
          {totals?.flags_overdue != null ? ` (${totals.flags_overdue})` : ''}
        </button>

        {hasFilters ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setParams({})}>
            Clear filters
          </button>
        ) : null}

        <span className="result-count">
          {queue.isSuccess
            ? `${rows.length} of ${queue.data.total} shown`
            : queue.isLoading
              ? 'Loading…'
              : ''}
        </span>
      </div>

      {queue.isLoading ? (
        <TableSkeleton rows={8} cols={7} />
      ) : queue.isError ? (
        <ErrorState title="Could not load the queue" error={queue.error} onRetry={queue.refetch} />
      ) : rows.length === 0 ? (
        <div className="table-wrap">
          <EmptyState
            title={hasFilters ? 'No flags match these filters' : 'The queue is clear'}
            action={
              hasFilters ? (
                <button type="button" className="btn" onClick={() => setParams({})}>
                  Clear filters
                </button>
              ) : null
            }
          >
            {hasFilters
              ? 'Try widening the severity filter, or clear the search.'
              : 'Every flagged event has a determination recorded against it. New flags will appear here as recordings are processed.'}
          </EmptyState>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <caption className="sr-only">
              Flagged events awaiting determination. Use j and k to move, Enter to open.
            </caption>
            <thead>
              <tr>
                <th scope="col">
                  <button type="button" onClick={() => toggleSort('due_at')}>
                    Deadline {sortIndicator('due_at')}
                  </button>
                </th>
                <th scope="col">
                  <button type="button" onClick={() => toggleSort('severity')}>
                    Severity {sortIndicator('severity')}
                  </button>
                </th>
                <th scope="col">
                  <button type="button" onClick={() => toggleSort('type')}>
                    Flag {sortIndicator('type')}
                  </button>
                </th>
                <th scope="col">
                  <button type="button" onClick={() => toggleSort('vessel')}>
                    Vessel {sortIndicator('vessel')}
                  </button>
                </th>
                <th scope="col">Recording</th>
                <th scope="col">At</th>
                <th scope="col">Assigned</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((f, i) => (
                <tr
                  key={f.id}
                  data-cursor={i === cursor}
                  onClick={() => navigate(`/review/${f.id}${window.location.search}`)}
                >
                  <td>
                    <DueBadge dueAt={f.due_at} />
                  </td>
                  <td>
                    <SeverityBadge severity={f.severity} />
                  </td>
                  <td>
                    <div className="cell-strong">{f.flag_type}</div>
                    {f.description ? (
                      <div className="cell-muted" style={{ fontSize: 12 }}>
                        {f.description}
                      </div>
                    ) : null}
                  </td>
                  <td>
                    <div className="cell-strong">{f.vessel_name}</div>
                    <div className="cell-muted" style={{ fontSize: 12 }}>
                      IMO {f.imo}
                    </div>
                  </td>
                  <td className="cell-muted">{formatDate(f.recording_date)}</td>
                  <td className="mono-time cell-muted">{timecode(f.timestamp_seconds)}</td>
                  <td className="cell-muted">
                    {f.assigned_to || <span className="muted">Unassigned</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="muted" style={{ fontSize: 12, marginTop: 'var(--space-3)' }}>
        <Kbd>j</Kbd> <Kbd>k</Kbd> move · <Kbd>↵</Kbd> open · <Kbd>/</Kbd> search
      </p>
    </div>
  )
}

function QueueStats({ query }) {
  if (query.isLoading) {
    return (
      <div className="stats">
        {Array.from({ length: 4 }, (_, i) => (
          <div className="stat" key={i}>
            <div className="stat-label">&nbsp;</div>
            <div style={{ padding: '6px 0' }}>
              <div className="skeleton" style={{ height: 22, width: '52%' }} />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (query.isError) {
    return (
      <ErrorState title="Could not load queue figures" error={query.error} onRetry={query.refetch} />
    )
  }

  const t = query.data.totals
  const bySeverity = query.data.by_severity || []
  const high = bySeverity.find((s) => s.severity === 'High')?.count ?? 0

  return (
    <div className="stats">
      <Stat label="Open flags" value={t.flags_open} note="Awaiting determination" />
      <Stat label="Overdue" value={t.flags_overdue} note="Past review window" alert={t.flags_overdue > 0} />
      <Stat label="High severity" value={high} note="Open, highest priority" alert={high > 0} />
      <Stat label="Determined" value={t.flags_resolved} note="Recorded to date" />
    </div>
  )
}

function Stat({ label, value, note, alert }) {
  return (
    <div className={`stat${alert ? ' stat-alert' : ''}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-note">{note}</div>
    </div>
  )
}
