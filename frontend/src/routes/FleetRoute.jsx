import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { formatDate } from '../lib/format'
import { TableSkeleton, EmptyState, ErrorState } from '../components/ui/States'

// The vessel roster. Demoted from home — it is a directory, not the workflow.
// Every column here is a real database field; the mockup's invented "fishing
// now" count and placeholder map are gone rather than shown as fact.

export default function FleetRoute() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState({ key: 'unresolved_flags', dir: 'desc' })

  const vessels = useQuery({ queryKey: ['vessels'], queryFn: api.vessels })

  const rows = useMemo(() => {
    const list = vessels.data || []
    const needle = search.trim().toLowerCase()
    const filtered = needle
      ? list.filter((v) =>
          [v.name, v.imo, v.licence, v.gear, v.captain]
            .filter(Boolean)
            .some((field) => String(field).toLowerCase().includes(needle))
        )
      : list

    const { key, dir } = sort
    return [...filtered].sort((a, b) => {
      const av = a[key] ?? ''
      const bv = b[key] ?? ''
      const cmp =
        typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av).localeCompare(String(bv))
      return dir === 'asc' ? cmp : -cmp
    })
  }, [vessels.data, search, sort])

  const toggleSort = (key) =>
    setSort((s) => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }))
  const indicator = (key) => (sort.key === key ? (sort.dir === 'asc' ? '↑' : '↓') : '')

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="kicker">Registered vessels in the programme</div>
          <h1>Fleet</h1>
        </div>
        <div className="page-head-end">
          <label className="sr-only" htmlFor="fleet-search">
            Search vessels
          </label>
          <input
            id="fleet-search"
            className="input"
            style={{ width: 260 }}
            placeholder="Search name, IMO, licence or skipper"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {vessels.isLoading ? (
        <TableSkeleton rows={7} cols={7} />
      ) : vessels.isError ? (
        <ErrorState
          title="Could not load the fleet"
          error={vessels.error}
          onRetry={vessels.refetch}
        />
      ) : rows.length === 0 ? (
        <div className="table-wrap">
          <EmptyState
            title={search ? 'No vessels match that search' : 'No vessels registered'}
            action={
              search ? (
                <button type="button" className="btn" onClick={() => setSearch('')}>
                  Clear search
                </button>
              ) : null
            }
          />
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th scope="col">
                  <button type="button" onClick={() => toggleSort('name')}>
                    Vessel {indicator('name')}
                  </button>
                </th>
                <th scope="col">IMO</th>
                <th scope="col">Licence</th>
                <th scope="col">Gear</th>
                <th scope="col">Skipper</th>
                <th scope="col">
                  <button type="button" onClick={() => toggleSort('recordings_count')}>
                    Recordings {indicator('recordings_count')}
                  </button>
                </th>
                <th scope="col">
                  <button type="button" onClick={() => toggleSort('unresolved_flags')}>
                    Open flags {indicator('unresolved_flags')}
                  </button>
                </th>
                <th scope="col">Last recording</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((v) => (
                <tr key={v.id} onClick={() => navigate(`/vessels/${v.id}`)}>
                  <td className="cell-strong">{v.name}</td>
                  <td className="cell-muted">{v.imo}</td>
                  <td className="cell-muted">{v.licence}</td>
                  <td className="cell-muted">{v.gear}</td>
                  <td className="cell-muted">{v.captain || '—'}</td>
                  <td className="cell-muted">{v.recordings_count ?? 0}</td>
                  <td>
                    {v.unresolved_flags > 0 ? (
                      <span className="badge badge-high">{v.unresolved_flags} open</span>
                    ) : (
                      <span className="badge badge-ok">Clear</span>
                    )}
                  </td>
                  <td className="cell-muted">
                    {v.last_recording_date ? formatDate(v.last_recording_date) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
