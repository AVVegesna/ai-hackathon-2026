import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import coastline from '../assets/nz-coastline.json'

// Real geography: the coastline is Natural Earth 1:10m (public domain),
// simplified to ~440 m and bundled (51 KB), so the map needs no tile server,
// no API key and no network at run time. The detail level is what caps
// MAX_ZOOM below.
//
// Interaction is done by moving the SVG viewBox rather than transforming a
// group: the vectors stay crisp at every zoom level, and hit testing keeps
// working without any coordinate maths in the event handlers.
//
// Positions are whatever the API holds. Vessels without a fix are not drawn and
// are counted in the caption instead — a map that silently omits vessels is
// worse than one that admits the gap.

const BOUNDS = { west: 165.6, east: 179.4, south: -47.5, north: -33.9 }
const REF_LAT = ((BOUNDS.north + BOUNDS.south) / 2) * (Math.PI / 180)
const LON_SCALE = Math.cos(REF_LAT)

const VIEW_W = 1000
const spanX = (BOUNDS.east - BOUNDS.west) * LON_SCALE
const spanY = BOUNDS.north - BOUNDS.south
const VIEW_H = Math.round((VIEW_W * spanY) / spanX)

const HOME = { x: 0, y: 0, w: VIEW_W, h: VIEW_H }
// Capped to what the simplified coastline actually supports (~440 m): past
// this the shoreline reads as polygons rather than coast.
const MAX_ZOOM = 10
const ZOOM_STEP = 1.6
// Above this magnification there is room for vessel names beside the dots.
const LABEL_AT = 2.6

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

// Keep the view inside the world and within the zoom range, so the map can
// never be scrolled or scaled into empty space.
function clampView(v) {
  const w = Math.min(VIEW_W, Math.max(VIEW_W / MAX_ZOOM, v.w))
  const h = w * (VIEW_H / VIEW_W)
  return {
    w,
    h,
    x: Math.min(Math.max(0, v.x), VIEW_W - w),
    y: Math.min(Math.max(0, v.y), VIEW_H - h),
  }
}

export default function FleetMap({ positions = [], vesselsTotal = 0, onOpen }) {
  const svgRef = useRef(null)
  const drag = useRef(null)

  const [view, setView] = useState(HOME)
  const [hover, setHover] = useState(null)
  const [selected, setSelected] = useState(null)
  const [panning, setPanning] = useState(false)

  const scale = VIEW_W / view.w
  const atHome = view.w === HOME.w && view.x === 0 && view.y === 0

  const paths = useMemo(
    () =>
      coastline.features.map(
        (f) =>
          f.geometry.coordinates[0]
            .map(
              ([lon, lat], i) =>
                `${i === 0 ? 'M' : 'L'}${project(lon, lat)
                  .map((n) => n.toFixed(1))
                  .join(' ')}`
            )
            .join('') + 'Z'
      ),
    []
  )

  const plotted = useMemo(
    () => positions.filter((p) => p.latitude != null && p.longitude != null),
    [positions]
  )
  const missing = Math.max(0, vesselsTotal - plotted.length)
  const sampled = plotted.some((p) => p.position_source === 'sample')

  // Client pixel -> viewBox unit, so zoom can be anchored under the cursor.
  const toViewBox = useCallback(
    (clientX, clientY) => {
      const r = svgRef.current.getBoundingClientRect()
      return {
        x: view.x + ((clientX - r.left) / r.width) * view.w,
        y: view.y + ((clientY - r.top) / r.height) * view.h,
      }
    },
    [view]
  )

  // Zoom about a fixed point: that point keeps the same screen position, which
  // is what makes wheel zoom feel anchored rather than jumpy.
  const zoomAbout = useCallback((factor, anchor) => {
    setView((v) => {
      const w = v.w / factor
      const next = clampView({ ...v, w, h: w * (VIEW_H / VIEW_W) })
      const a = anchor || { x: v.x + v.w / 2, y: v.y + v.h / 2 }
      const ratioX = (a.x - v.x) / v.w
      const ratioY = (a.y - v.y) / v.h
      return clampView({
        ...next,
        x: a.x - ratioX * next.w,
        y: a.y - ratioY * next.h,
      })
    })
  }, [])

  // Wheel is bound natively so it can be non-passive; React's onWheel is
  // passive by default and cannot preventDefault the page scroll.
  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const onWheel = (e) => {
      e.preventDefault()
      const factor = e.deltaY < 0 ? ZOOM_STEP ** 0.5 : 1 / ZOOM_STEP ** 0.5
      zoomAbout(factor, toViewBox(e.clientX, e.clientY))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomAbout, toViewBox])

  const onPointerDown = (e) => {
    if (e.target.closest('.map-vessel')) return
    const r = svgRef.current.getBoundingClientRect()
    drag.current = {
      id: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      view,
      unitsPerPx: view.w / r.width,
      moved: false,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
    setPanning(true)
  }

  const onPointerMove = (e) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) d.moved = true
    setView(
      clampView({
        ...d.view,
        x: d.view.x - dx * d.unitsPerPx,
        y: d.view.y - dy * d.unitsPerPx,
      })
    )
  }

  const endPan = (e) => {
    if (drag.current?.id === e.pointerId) drag.current = null
    setPanning(false)
  }

  const onKeyDown = (e) => {
    const step = view.w * 0.15
    const moves = {
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: -step },
      ArrowDown: { x: 0, y: step },
    }
    if (moves[e.key]) {
      e.preventDefault()
      const m = moves[e.key]
      setView((v) => clampView({ ...v, x: v.x + m.x, y: v.y + m.y }))
    } else if (e.key === '+' || e.key === '=') {
      e.preventDefault()
      zoomAbout(ZOOM_STEP)
    } else if (e.key === '-' || e.key === '_') {
      e.preventDefault()
      zoomAbout(1 / ZOOM_STEP)
    } else if (e.key === '0') {
      e.preventDefault()
      setView(HOME)
    }
  }

  // Frame a vessel without losing the current magnification, unless we are
  // fully zoomed out — then move in far enough to be useful.
  const focusVessel = (v) => {
    const [x, y] = project(v.longitude, v.latitude)
    setView((cur) => {
      const w = cur.w === HOME.w ? VIEW_W / 6 : cur.w
      const h = w * (VIEW_H / VIEW_W)
      return clampView({ x: x - w / 2, y: y - h / 2, w, h })
    })
  }

  const active = selected || hover

  return (
    <div className="map">
      <div className="map-stage">
        <svg
          ref={svgRef}
          viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
          className="map-svg"
          data-panning={panning}
          role="application"
          tabIndex={0}
          aria-label={`Map of New Zealand showing ${plotted.length} vessel positions. Arrow keys pan, plus and minus zoom, 0 resets.`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPan}
          onPointerCancel={endPan}
          onKeyDown={onKeyDown}
          onDoubleClick={(e) => zoomAbout(ZOOM_STEP, toViewBox(e.clientX, e.clientY))}
        >
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
            const isActive = active?.id === v.id
            // Divide by scale so markers hold their on-screen size as the
            // viewBox shrinks.
            const r = 5.5 / scale
            return (
              <g
                key={v.id}
                className="map-vessel"
                data-active={isActive}
                transform={`translate(${x} ${y})`}
                onMouseEnter={() => setHover(v)}
                onMouseLeave={() => setHover(null)}
                onClick={() => setSelected(v)}
                onDoubleClick={(e) => {
                  e.stopPropagation()
                  focusVessel(v)
                }}
                tabIndex={0}
                role="button"
                aria-label={`${v.name}, ${(ACTIVITY[v.activity] || ACTIVITY.unknown).label}, ${v.unresolved_flags} open flags`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setSelected(v)
                    focusVessel(v)
                  }
                }}
              >
                {v.unresolved_flags > 0 ? <circle r={r * 2} className="map-ring" /> : null}
                <circle r={r} fill={tone} className="map-dot" />
                {scale >= LABEL_AT ? (
                  <text x={r * 2.2} y={r * 0.8} className="map-label" style={{ fontSize: 13 / scale }}>
                    {v.name}
                  </text>
                ) : null}
              </g>
            )
          })}
        </svg>

        <div className="map-controls">
          <button
            type="button"
            className="btn btn-icon btn-sm"
            onClick={() => zoomAbout(ZOOM_STEP)}
            aria-label="Zoom in"
            title="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            className="btn btn-icon btn-sm"
            onClick={() => zoomAbout(1 / ZOOM_STEP)}
            aria-label="Zoom out"
            title="Zoom out"
          >
            −
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              setView(HOME)
              setSelected(null)
            }}
            disabled={atHome && !selected}
            title="Reset the view"
          >
            Reset
          </button>
          <span className="map-scale" aria-hidden="true">
            {scale < 1.05 ? '1×' : `${scale.toFixed(1)}×`}
          </span>
        </div>

        {/* Selection is pinned so it survives the pointer leaving the dot;
            hover is transient. Both render through the same panel. */}
        {active ? (
          <div className="map-card" role={selected ? 'region' : 'status'}>
            <div className="map-card-head">
              <b>{active.name}</b>
              {selected ? (
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={() => setSelected(null)}
                  aria-label="Clear selection"
                >
                  ✕
                </button>
              ) : null}
            </div>
            <ul className="meta-list map-card-meta">
              <li>
                <b>IMO</b>
                <span>{active.imo}</span>
              </li>
              <li>
                <b>Licence</b>
                <span>{active.licence}</span>
              </li>
              <li>
                <b>Gear</b>
                <span>{active.gear}</span>
              </li>
              <li>
                <b>Position</b>
                <span>
                  {Math.abs(active.latitude).toFixed(2)}°S,{' '}
                  {Math.abs(active.longitude).toFixed(2)}°E
                </span>
              </li>
            </ul>
            <div className="row">
              {active.unresolved_flags > 0 ? (
                <span className="badge badge-high">{active.unresolved_flags} open flags</span>
              ) : (
                <span className="badge badge-ok">No open flags</span>
              )}
              <span className="badge badge-neutral">
                {(ACTIVITY[active.activity] || ACTIVITY.unknown).label}
              </span>
            </div>
            {selected ? (
              <div className="row">
                <button
                  type="button"
                  className="btn btn-sm grow"
                  onClick={() => focusVessel(selected)}
                >
                  Zoom to
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-primary grow"
                  onClick={() => onOpen?.(selected)}
                >
                  Open record
                </button>
              </div>
            ) : (
              <p className="map-hint">Click to pin this vessel.</p>
            )}
          </div>
        ) : null}
      </div>

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
        <p className="map-note">
          Drag to pan, scroll or double-click to zoom, <span className="kbd">0</span> to reset.
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
