import React, { useMemo, useRef, useState } from 'react'
import { timecode } from '../lib/format'

// Per-frame detection counts across the whole clip, so a reviewer can see at a
// glance where the model found something and jump there.
//
// The detector samples the video into a fixed number of buckets (240 in the
// current output), so a bucket index maps to a time via the clip duration, not
// via fps — using fps would be wrong whenever the sample count differs from
// the real frame count.

export default function DetectionTimeline({
  dolphinCounts = [],
  albatrossCounts = [],
  fishCounts = [],
  totalCounts = [],
  durationSeconds = 0,
  onSeek,
}) {
  const ref = useRef(null)
  const [hover, setHover] = useState(null)

  // Prefer the split series when the detector supplied them; fall back to the
  // combined counts for older result files that only carry frame_counts.
  // albatrossCounts is absent from results produced before seabird detection
  // existed, so it defaults to zero rather than shifting the other series.
  const series = useMemo(() => {
    const length = Math.max(
      dolphinCounts.length,
      albatrossCounts.length,
      fishCounts.length,
      totalCounts.length
    )
    if (!length) return []
    return Array.from({ length }, (_, i) => ({
      dolphin: dolphinCounts[i] ?? 0,
      albatross: albatrossCounts[i] ?? 0,
      fish: fishCounts[i] ?? 0,
      total:
        totalCounts[i] ??
        (dolphinCounts[i] ?? 0) + (albatrossCounts[i] ?? 0) + (fishCounts[i] ?? 0),
    }))
  }, [dolphinCounts, albatrossCounts, fishCounts, totalCounts])

  const peak = useMemo(() => Math.max(1, ...series.map((s) => s.total)), [series])

  const timeAt = (index) =>
    series.length ? (index / series.length) * durationSeconds : 0

  if (!series.length) {
    return (
      <p className="muted" style={{ fontSize: 12 }}>
        No per-frame counts in this result.
      </p>
    )
  }

  const handleMove = (e) => {
    const el = ref.current
    if (!el) return
    const { left, width } = el.getBoundingClientRect()
    const ratio = Math.min(Math.max((e.clientX - left) / width, 0), 0.999)
    const index = Math.floor(ratio * series.length)
    setHover({ index, ...series[index] })
  }

  return (
    <div className="timeline">
      <div
        className="timeline-plot"
        ref={ref}
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
        onClick={() => hover && onSeek?.(timeAt(hover.index))}
        role="img"
        aria-label={`Detection counts across the clip. Peak ${peak} in one frame.`}
      >
        {series.map((s, i) => (
          <span
            key={i}
            className="timeline-bar"
            data-kind={
              s.dolphin > 0
                ? 'dolphin'
                : s.albatross > 0
                  ? 'albatross'
                  : s.total > 0
                    ? 'fish'
                    : 'none'
            }
            style={{ height: `${(s.total / peak) * 100}%` }}
          />
        ))}
      </div>

      <div className="timeline-foot">
        <span className="muted">00:00:00</span>
        {hover ? (
          <span className="timeline-readout">
            <b className="mono-time">{timecode(timeAt(hover.index))}</b>
            {hover.dolphin > 0 ? <span className="badge badge-dolphin">{hover.dolphin} dolphin</span> : null}
            {hover.albatross > 0 ? (
              <span className="badge badge-albatross">{hover.albatross} albatross</span>
            ) : null}
            {hover.fish > 0 ? <span className="badge badge-neutral">{hover.fish} fish</span> : null}
            {hover.total === 0 ? <span className="muted">nothing detected</span> : null}
          </span>
        ) : (
          <span className="muted">Hover to read a frame · click to seek</span>
        )}
        <span className="muted mono-time">{timecode(durationSeconds)}</span>
      </div>
    </div>
  )
}
