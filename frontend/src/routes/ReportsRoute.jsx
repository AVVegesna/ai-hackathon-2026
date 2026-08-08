import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { formatDateTime } from '../lib/format'
import { EmptyState, ErrorState, Skeleton } from '../components/ui/States'

// Reports and the audit trail. Deliberately shallow: an append-only log and a
// CSV export. What makes this screen worth having is that it is complete and
// verifiable, not that it has charts.

function toCsv(rows) {
  const cols = ['created_at', 'entity_type', 'entity_id', 'action', 'actor', 'vessel_name', 'detail']
  const escape = (val) => {
    const s = val == null ? '' : String(val)
    // Quote when the value contains a delimiter, quote or newline, and double
    // any embedded quotes — otherwise a reason field with a comma shifts every
    // later column in the exported record.
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [cols.join(','), ...rows.map((r) => cols.map((c) => escape(r[c])).join(','))].join('\r\n')
}

export default function ReportsRoute() {
  const audit = useQuery({ queryKey: ['audit', { limit: 500 }], queryFn: () => api.audit({ limit: 500 }) })
  const stats = useQuery({ queryKey: ['queueStats'], queryFn: api.queueStats })

  const rows = audit.data || []

  const download = () => {
    const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    // Timestamp in the filename so successive exports do not overwrite.
    a.download = `audit-trail-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const byType = stats.data?.by_type || []
  const maxType = useMemo(() => Math.max(1, ...byType.map((t) => t.count)), [byType])

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="kicker">Audit trail and programme figures</div>
          <h1>Reports</h1>
        </div>
        <div className="page-head-end">
          <button type="button" className="btn" onClick={download} disabled={rows.length === 0}>
            Export audit trail (CSV)
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 2fr) minmax(260px, 1fr)',
          gap: 'var(--space-4)',
          alignItems: 'start',
        }}
      >
        <div className="card record-marks">
          <div className="card-head">
            <h2>Audit trail</h2>
            <div className="card-head-end">
              {audit.isSuccess ? `${rows.length} entries` : ''}
            </div>
          </div>

          {audit.isLoading ? (
            <div className="card-body">
              <Skeleton />
            </div>
          ) : audit.isError ? (
            <ErrorState title="Could not load the audit trail" error={audit.error} onRetry={audit.refetch} />
          ) : rows.length === 0 ? (
            <EmptyState title="Nothing recorded yet">
              Determinations and vessel reviews write an entry here as they are made. Work an item
              from the review queue and it will appear.
            </EmptyState>
          ) : (
            <div className="table-wrap" style={{ border: 'none' }}>
              <table className="data">
                <thead>
                  <tr>
                    <th scope="col">When</th>
                    <th scope="col">Action</th>
                    <th scope="col">By</th>
                    <th scope="col">Vessel</th>
                    <th scope="col">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((a) => (
                    <tr key={a.id} style={{ cursor: 'default' }}>
                      <td className="cell-muted">{formatDateTime(a.created_at)}</td>
                      <td>
                        <span className="badge badge-neutral">{a.action.replace(/_/g, ' ')}</span>
                      </td>
                      <td className="cell-muted">{a.actor}</td>
                      <td className="cell-muted">{a.vessel_name || '—'}</td>
                      <td className="cell-muted">{a.detail || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Open flags by type</h2>
          </div>
          <div className="card-body">
            {stats.isLoading ? (
              <Skeleton />
            ) : stats.isError ? (
              <ErrorState error={stats.error} onRetry={stats.refetch} />
            ) : byType.length === 0 ? (
              <EmptyState title="No open flags" />
            ) : (
              <div className="bars">
                {byType.map((t) => (
                  <div className="bar-row" key={t.type}>
                    <span>{t.type}</span>
                    <span className="bar-track">
                      <span
                        className="bar-fill"
                        style={{ width: `${(t.count / maxType) * 100}%` }}
                      />
                    </span>
                    <span className="bar-value">{t.count}</span>
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
