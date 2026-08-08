import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { timecode } from '../lib/format'

// Before and after, on one playhead. The point of showing them together is to
// let a reviewer judge the model: what it drew a box around, and what it
// walked past. Either video can be scrubbed and the other follows.

const SYNC_TOLERANCE = 0.2

const CompareVideos = forwardRef(function CompareVideos({ originalUrl, processedUrl }, ref) {
  const originalRef = useRef(null)
  const processedRef = useRef(null)
  // Guards the timeupdate handlers against echoing each other's corrections
  // into an endless seek loop.
  const syncing = useRef(false)

  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  const both = useCallback((fn) => {
    for (const r of [originalRef.current, processedRef.current]) if (r) fn(r)
  }, [])

  const seek = useCallback(
    (t) => {
      const next = Math.min(Math.max(t, 0), duration || 0)
      syncing.current = true
      both((v) => {
        v.currentTime = next
      })
      setCurrentTime(next)
      // Release on the next tick, once both elements have taken the new time.
      setTimeout(() => {
        syncing.current = false
      }, 0)
    },
    [both, duration]
  )

  const toggle = useCallback(() => {
    const a = originalRef.current
    if (!a) return
    if (a.paused) both((v) => v.play().catch(() => {}))
    else both((v) => v.pause())
  }, [both])

  useImperativeHandle(ref, () => ({ seek, toggle, getTime: () => currentTime }), [
    seek,
    toggle,
    currentTime,
  ])

  useEffect(() => {
    const a = originalRef.current
    if (!a) return

    const onTime = () => {
      setCurrentTime(a.currentTime)
      if (syncing.current) return
      const b = processedRef.current
      if (b && Math.abs(b.currentTime - a.currentTime) > SYNC_TOLERANCE) {
        b.currentTime = a.currentTime
      }
    }
    const onMeta = () => setDuration(a.duration || 0)
    const onPlay = () => {
      setPlaying(true)
      processedRef.current?.play?.().catch(() => {})
    }
    const onPause = () => {
      setPlaying(false)
      processedRef.current?.pause?.()
    }

    a.addEventListener('timeupdate', onTime)
    a.addEventListener('loadedmetadata', onMeta)
    a.addEventListener('play', onPlay)
    a.addEventListener('pause', onPause)
    return () => {
      a.removeEventListener('timeupdate', onTime)
      a.removeEventListener('loadedmetadata', onMeta)
      a.removeEventListener('play', onPlay)
      a.removeEventListener('pause', onPause)
    }
  }, [originalUrl, processedUrl])

  const pct = duration ? (currentTime / duration) * 100 : 0

  return (
    <div className="compare">
      <div className="compare-grid">
        <figure className="compare-pane">
          <figcaption>
            <span className="badge badge-neutral">Before</span> As uploaded
          </figcaption>
          <video ref={originalRef} src={originalUrl} playsInline preload="metadata" muted />
        </figure>
        <figure className="compare-pane">
          <figcaption>
            <span className="badge badge-escalated">After</span> With detections drawn
          </figcaption>
          <video ref={processedRef} src={processedUrl} playsInline preload="metadata" muted />
        </figure>
      </div>

      <div className="row">
        <button type="button" className="btn btn-primary" onClick={toggle} style={{ minWidth: 70 }}>
          {playing ? 'Pause' : 'Play both'}
        </button>
        <button type="button" className="btn" onClick={() => seek(currentTime - 5)}>
          −5s
        </button>
        <button type="button" className="btn" onClick={() => seek(currentTime + 5)}>
          +5s
        </button>
        <input
          type="range"
          className="compare-scrub"
          min={0}
          max={Math.max(duration, 0.01)}
          step={0.05}
          value={currentTime}
          onChange={(e) => seek(Number(e.target.value))}
          aria-label="Position in both recordings"
        />
        <span className="mono-time muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
          {timecode(currentTime)} / {timecode(duration)}
        </span>
      </div>
      <div className="sr-only" aria-live="off">
        {pct.toFixed(0)}% through both recordings
      </div>
    </div>
  )
})

export default CompareVideos
