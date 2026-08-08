import React, { useMemo, useState } from 'react'
import coastline from '../assets/nz-coastline.json'

// Real geography: the coastline is Natural Earth 1:10m (public domain),
// simplified to ~1.3 km and bundled, so the map needs no tile server, no API
// key and no network at run time.
//
// Positions are whatever the API holds. Vessels without a fix are not drawn and
// are counted in the caption instead — a map that silently omits vessels is
// worse than one that admits the gap.

// Equirectangular with a cos(lat) correction on longitude. At this latitude and
// extent that is close enough, and it keeps the projection to two lines rather
// than pulling in a mapping library.
const BOUNDS = { west: 165.6, east: 179.4, south: -47.5, north: -33.9 }
const REF_LAT = ((BOUNDS.north + BOUNDS.south) / 2) * (Math.PI / 180)
const LON_SCALE = Math.cos(REF_LAT)

const VIEW_W = 1000
const spanX = (BOUNDS.east - BOUNDS.west) * LON_SCALE
const spanY = BOUNDS.north - BOUNDS.south
const VIEW_H = Math.round((VIEW_W * spanY) / spanX)

function project(lon, lat) {
  const x = ((lon - BOUNDS.west) * LON_SCALE * VIEW_W) / spanX
  const y = ((BOUNDS.north - lat) * VIEW_H) / spanY
  return [x, y]
}

const ACTIVITY = {
  fishing: { label: 'Fishing', token: 'var(--sev-high)' },
  transit: { label: 'In transit', token: 'var(--accent)' },
  in_port: { label: 'In port', token: 'var(--ink-3)' },
  unknown: { label: 'Activity unknown', token: 'var(--line-strong)' },
}

export default function FleetMap({ positions = [], vesselsTotal = 0, onSelect }) {
  const [hover, setHover] = useState(null)

  const paths = useMemo(
    () =>
      coastline.features.map((f) =>
        f.geometry.coordinates[0]
          .map(([lon, lat], i) => `${i === 0 ? 'M' : 'L'}${project(lon, lat).map((n) => n.toFixed(1)).join(' ')}`)
          .join('') + 'Z'
      ),
    []
  )

  const plotted = positions.filter(
    (p) => p.latitude != null && p.longitude != null
  )
  const missing = Math.max(0, vesselsTotal - plotted.length)
  const sampled = plotted.some((p) => p.position_source === 'sample')

  return (
    <div className="map">
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="map-svg"
        role="img"
        aria-label={`Map of New Zealand showing ${plotted.length} vessel positions`}
      >
        {/* Graticule at 5° — enough to read scale, faint enough to stay behind */}
        <g className="map-grid">
          {[170, 175].map((lon) => {
            const [x] = project(lon, 0)
            return <line key={`lon${lon}`} x1={x} y1={0} x2={x} y2={VIEW_H} />
          })}
          {[-35, -40, -45].map((lat) => {
            const [, y] = project(0, lat)
            return <line key={`lat${lat}`} x1={0} y1={y} x2={VIEW_W} y2={y} />
          })}
        </g>

        <g className="map-land">
          {paths.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>

        {plotted.map((v) => {
          const [x, y] = project(v.longitude, v.latitude)
          const tone = (ACTIVITY[v.activity] || ACTIVITY.unknown).token
          const flagged = v.unresolved_flags > 0
          return (
            <g
              key={v.id}
              className="map-vessel"
              transform={`translate(${x} ${y})`}
              onMouseEnter={() => setHover(v)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onSelect?.(v)}
              tabIndex={0}
              role="button"
              aria-label={`${v.name}, ${(ACTIVITY[v.activity] || ACTIVITY.unknown).label}, ${v.unresolved_flags} open flags`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelect?.(v)
                }
              }}
            >
              {/* A ring marks vessels carrying open flags, so the map answers
                  "where is the work" and not just "where is the fleet". */}
              {flagged ? <circle r={11} className="map-ring" /> : null}
              <circle r={5.5} fill={tone} className="map-dot" />
            </g>
          )
        })}
      </svg>

      {hover ? (
        <div className="map-tip" role="status">
          <b>{hover.name}</b>
          <span>
            IMO {hover.imo} · {(ACTIVITY[hover.activity] || ACTIVITY.unknown).label}
          </span>
          <span>
            {hover.latitude.toFixed(2)}°, {hover.longitude.toFixed(2)}°
          </span>
          {hover.unresolved_flags > 0 ? (
            <span className="badge badge-high">{hover.unresolved_flags} open flags</span>
          ) : (
            <span className="badge badge-ok">No open flags</span>
          )}
        </div>
      ) : null}

      <div className="map-foot">
        <div className="legend">
          {Object.entries(ACTIVITY).map(([key, a]) => (
            <span key={key}>
              <i style={{ background: a.token, borderRadius: '50%' }} />
              {a.label}
            </span>
          ))}
          <span>
            <i className="legend-ring" />
            Has open flags
          </span>
        </div>
        {/* Provenance stated on the map itself, not buried in a tooltip. */}
        <p className="map-note">
          Coastline: Natural Earth 1:10m, simplified.{' '}
          {sampled
            ? 'Positions are sample data — no AIS feed is connected.'
            : 'Positions from last AIS fix.'}
          {missing > 0
            ? ` ${missing} vessel${missing === 1 ? '' : 's'} without a position ${missing === 1 ? 'is' : 'are'} not shown.`
            : ''}
        </p>
      </div>
    </div>
  )
}
