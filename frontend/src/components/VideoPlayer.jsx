import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import { timecode, durationLabel } from '../lib/format'

// A real <video>, not a placeholder. Two things make this a review tool
// rather than a media player:
//
//   1. Flag markers live on the scrubber, so a reviewer seeks to an event
//      instead of reading a timecode from a list and hunting for the frame.
//   2. Cameras can be watched together on a synced playhead, because
//      verifying an event usually means comparing angles, not tabbing
//      between them.
//
// Duration comes from the media itself, never from a hardcoded constant.

const SYNC_TOLERANCE = 0.25 // seconds of drift before a follower is corrected

const VideoPlayer = forwardRef(function VideoPlayer(
  {
    mediaUrl,
    processedMediaUrl,
    camerasCount = 1,
    flags = [],
    activeFlagId,
    onSelectFlag,
    recordingLabel,
    recordedMinutes,
  },
  ref
) {
  const primaryRef = useRef(null)
  const followerRefs = useRef([])
  const scrubRef = useRef(null)

  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [gridMode, setGridMode] = useState(false)
  const [camera, setCamera] = useState(0)
  const [mediaError, setMediaError] = useState(false)
  // Which render to show. The annotated copy is the default because it answers
  // "what did the model see"; the original is the evidence, one click away.
  const [source, setSource] = useState(processedMediaUrl ? 'processed' : 'original')

  const activeUrl = source === 'processed' && processedMediaUrl ? processedMediaUrl : mediaUrl

  // One entry per camera the recording claims. We only hold footage for the
  // first; the rest render as explicitly empty panes rather than repeating
  // the same clip and implying coverage that does not exist.
  const cameras = useMemo(
    () =>
      Array.from({ length: Math.max(1, camerasCount) }, (_, i) => ({
        index: i,
        label: `CAM ${i + 1}`,
        src: i === 0 ? activeUrl || null : null,
      })),
    [camerasCount, activeUrl]
  )

  const hasMedia = Boolean(activeUrl) && !mediaError

  const clamp = useCallback(
    (t) => Math.min(Math.max(t, 0), duration || 0),
    [duration]
  )

  const seek = useCallback(
    (t) => {
      const v = primaryRef.current
      if (!v) return
      const next = clamp(t)
      v.currentTime = next
      setCurrentTime(next)
      for (const f of followerRefs.current) {
        if (f) f.currentTime = next
      }
    },
    [clamp]
  )

  const togglePlay = useCallback(() => {
    const v = primaryRef.current
    if (!v) return
    if (v.paused) v.play().catch(() => setMediaError(true))
    else v.pause()
  }, [])

  useImperativeHandle(
    ref,
    () => ({
      togglePlay,
      seek,
      seekBy: (delta) => seek((primaryRef.current?.currentTime ?? 0) + delta),
      setCamera: (i) => {
        if (i >= 0 && i < cameras.length) {
          setCamera(i)
          setGridMode(false)
        }
      },
      toggleGrid: () => setGridMode((g) => !g),
      getTime: () => primaryRef.current?.currentTime ?? 0,
      hasMedia,
    }),
    [togglePlay, seek, cameras.length, hasMedia]
  )

  // Keep followers locked to the primary. Correcting only past a tolerance
  // avoids fighting the browser over sub-frame differences.
  useEffect(() => {
    const v = primaryRef.current
    if (!v) return

    const onTime = () => {
      setCurrentTime(v.currentTime)
      for (const f of followerRefs.current) {
        if (!f) continue
        if (Math.abs(f.currentTime - v.currentTime) > SYNC_TOLERANCE) {
          f.currentTime = v.currentTime
        }
      }
    }
    const onMeta = () => setDuration(v.duration || 0)
    const onPlay = () => {
      setPlaying(true)
      for (const f of followerRefs.current) f?.play?.().catch(() => {})
    }
    const onPause = () => {
      setPlaying(false)
      for (const f of followerRefs.current) f?.pause?.()
    }
    const onError = () => setMediaError(true)

    v.addEventListener('timeupdate', onTime)
    v.addEventListener('loadedmetadata', onMeta)
    v.addEventListener('durationchange', onMeta)
    v.addEventListener('play', onPlay)
    v.addEventListener('pause', onPause)
    v.addEventListener('error', onError)
    return () => {
      v.removeEventListener('timeupdate', onTime)
      v.removeEventListener('loadedmetadata', onMeta)
      v.removeEventListener('durationchange', onMeta)
      v.removeEventListener('play', onPlay)
      v.removeEventListener('pause', onPause)
      v.removeEventListener('error', onError)
    }
  }, [activeUrl, gridMode, camera])

  useEffect(() => {
    setMediaError(false)
  }, [activeUrl])

  // If a re-run adds an annotated render while the original is showing, adopt it.
  useEffect(() => {
    if (processedMediaUrl) setSource('processed')
  }, [processedMediaUrl])

  const seekFromPointer = useCallback(
    (clientX) => {
      const el = scrubRef.current
      if (!el || !duration) return
      const { left, width } = el.getBoundingClientRect()
      const ratio = Math.min(Math.max((clientX - left) / width, 0), 1)
      seek(ratio * duration)
    },
    [duration, seek]
  )

  const pct = duration ? (currentTime / duration) * 100 : 0

  // A flag only gets a marker if its timestamp falls inside the media we
  // actually have. Flags outside it are still listed, just not plotted —
  // drawing them at the edge would misrepresent where the event is.
  const plottable = duration
    ? flags.filter((f) => f.timestamp_seconds <= duration + 0.5)
    : []
  const offscreen = flags.length - plottable.length

  const renderVideo = (cam, isPrimary) => (
    <video
      key={cam.index}
      ref={(node) => {
        if (isPrimary) primaryRef.current = node
        else followerRefs.current[cam.index] = node
      }}
      src={cam.src}
      muted={!isPrimary}
      playsInline
      preload="metadata"
    />
  )

  return (
    <div className="player">
      {!hasMedia ? (
        <div className="stage">
          <div className="stage-empty">
            <strong>No footage held for this recording</strong>
            <span>
              {mediaError
                ? 'The media file could not be played. Check that the backend is serving /uploads.'
                : 'Metadata is on file, but no video has been uploaded against it yet.'}
            </span>
          </div>
        </div>
      ) : gridMode ? (
        <div className="stage-grid">
          {cameras.slice(0, 4).map((cam) => (
            <div
              key={cam.index}
              className="pane"
              aria-current={cam.index === camera}
              onClick={() => {
                setCamera(cam.index)
                setGridMode(false)
              }}
            >
              <span className="pane-label">{cam.label}</span>
              {cam.src ? (
                renderVideo(cam, cam.index === 0)
              ) : (
                <span className="pane-empty">No feed held</span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="stage">
          {cameras[camera]?.src ? (
            renderVideo(cameras[camera], true)
          ) : (
            <>
              {/* The primary element must stay mounted so the transport keeps
                  working while a feed-less camera is selected. */}
              <div style={{ display: 'none' }}>{renderVideo(cameras[0], true)}</div>
              <div className="stage-empty">
                <strong>No feed held for {cameras[camera]?.label}</strong>
                <span>This recording only carries footage for CAM 1.</span>
              </div>
            </>
          )}
          <span className="stage-badge">
            {cameras[camera]?.label} · {timecode(currentTime)}
          </span>
        </div>
      )}

      {/* Scrubber */}
      <div
        className="scrub"
        ref={scrubRef}
        role="slider"
        tabIndex={0}
        aria-label="Recording position"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(currentTime)}
        aria-valuetext={timecode(currentTime)}
        onPointerDown={(e) => {
          if (e.target.closest('.marker')) return
          seekFromPointer(e.clientX)
        }}
      >
        <div className="scrub-track" />
        <div className="scrub-played" style={{ width: `${pct}%` }} />

        {plottable.map((f) => (
          <button
            key={f.id}
            type="button"
            className="marker"
            data-sev={f.severity}
            data-active={f.id === activeFlagId}
            data-resolved={Boolean(f.resolved)}
            style={{ left: `${(f.timestamp_seconds / duration) * 100}%` }}
            title={`${f.severity} · ${f.flag_type} · ${timecode(f.timestamp_seconds)}`}
            aria-label={`${f.severity} ${f.flag_type} at ${timecode(f.timestamp_seconds)}`}
            onClick={(e) => {
              e.stopPropagation()
              seek(f.timestamp_seconds)
              onSelectFlag?.(f)
            }}
          >
            <span className="marker-cap" />
          </button>
        ))}

        <div className="scrub-head" style={{ left: `${pct}%` }} />
      </div>

      {/* The scrubber spans the footage actually held, which can be far shorter
          than the recording the metadata describes. Say both, so nobody reads
          a ten-second clip as a full shift. */}
      <div className="scrub-times">
        <span>
          {recordingLabel}
          {hasMedia && duration > 0 && recordedMinutes
            ? ` · holding ${timecode(duration)} of ${durationLabel(recordedMinutes)}`
            : ''}
        </span>
        <span>
          {plottable.length} marker{plottable.length === 1 ? '' : 's'}
          {offscreen > 0 ? ` · ${offscreen} outside held footage` : ''}
        </span>
      </div>

      {/* Transport */}
      <div className="transport">
        <button
          type="button"
          className="btn btn-primary"
          onClick={togglePlay}
          disabled={!hasMedia}
          style={{ minWidth: 70 }}
        >
          {playing ? 'Pause' : 'Play'}
        </button>
        <button type="button" className="btn" onClick={() => seek(currentTime - 10)} disabled={!hasMedia}>
          −10s
        </button>
        <button type="button" className="btn" onClick={() => seek(currentTime + 10)} disabled={!hasMedia}>
          +10s
        </button>
        <span className="time">
          {timecode(currentTime)} / {timecode(duration)}
        </span>

        <div className="transport-end">
          {processedMediaUrl ? (
            <div className="chips" role="group" aria-label="Video source">
              <button
                type="button"
                className="chip"
                aria-pressed={source === 'processed'}
                onClick={() => setSource('processed')}
                title="Detector output, with detected species boxed"
              >
                Detections
              </button>
              <button
                type="button"
                className="chip"
                aria-pressed={source === 'original'}
                onClick={() => setSource('original')}
                title="Original footage as uploaded — the evidentiary copy"
              >
                Original
              </button>
            </div>
          ) : null}
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setGridMode((g) => !g)}
            disabled={!hasMedia || cameras.length < 2}
            aria-pressed={gridMode}
          >
            {gridMode ? 'Single' : 'All cameras'}
          </button>
          <div className="chips" role="group" aria-label="Camera">
            {cameras.slice(0, 4).map((cam) => (
              <button
                key={cam.index}
                type="button"
                className="chip"
                aria-pressed={!gridMode && camera === cam.index}
                onClick={() => {
                  setCamera(cam.index)
                  setGridMode(false)
                }}
                disabled={!hasMedia}
                title={cam.src ? cam.label : `${cam.label} — no feed held`}
              >
                {cam.label}
                {!cam.src ? <span aria-hidden="true">·</span> : null}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
})

export default VideoPlayer
