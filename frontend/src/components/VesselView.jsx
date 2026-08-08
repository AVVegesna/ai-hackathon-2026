import React, { useState } from 'react'

export default function VesselView({ vessel, recordings, flags, onBack }) {
  const [currentRecording, setCurrentRecording] = useState(recordings[0] || null)
  const [currentCamera, setCurrentCamera] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const duration = 225 // 3:45 in seconds

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const recordingFlags = currentRecording ? flags.filter(f => f.recording_id === currentRecording.id) : []
  const progressPct = (currentTime / duration) * 100

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: 'var(--space-5) var(--space-4)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-4)', marginBottom: 'var(--space-4)', paddingTop: '8px' }}>
        <div>
          <a href="#" onClick={(e) => { e.preventDefault(); onBack() }} style={{ fontSize: '12px' }}>← Fleet</a>
          <h1 style={{ fontSize: '34px', margin: '6px 0 6px', lineHeight: 1 }}>{vessel.name}</h1>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '12px', opacity: 0.7 }}>
            <span>IMO {vessel.imo}</span><span>·</span><span>Licence {vessel.licence}</span><span>·</span><span>{vessel.gear}</span><span>·</span><span>{vessel.crew_count} crew</span>
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 'var(--space-2)' }}>
          <button className="btn btn-secondary">Export clip</button>
          <button className="btn btn-secondary">Vessel history</button>
          <button className="btn btn-primary blueprint" style={{ position: 'relative' }}>
            <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>
            Submit review
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 340px', gap: 'var(--space-5)', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', minWidth: 0 }}>
          {/* Recordings Tabs */}
          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', overflowX: 'auto', paddingBottom: 'var(--space-2)' }}>
            <div style={{ fontSize: '11px', letterSpacing: '.12em', textTransform: 'uppercase', opacity: 0.55, whiteSpace: 'nowrap', marginRight: '4px' }}>Recordings</div>
            {recordings.map((r) => (
              <div 
                key={r.id}
                onClick={() => setCurrentRecording(r)}
                className="blueprint" 
                style={{ 
                  cursor: 'pointer', 
                  padding: '8px 12px', 
                  minWidth: '130px', 
                  background: currentRecording?.id === r.id ? 'var(--color-accent)' : 'var(--color-bg)',
                  color: currentRecording?.id === r.id ? 'white' : 'var(--color-text)',
                  position: 'relative'
                }}
              >
                <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: '15px' }}>{r.recording_date}</div>
                <div style={{ fontSize: '11px', opacity: currentRecording?.id === r.id ? 0.9 : 0.7 }}>{r.start_time.slice(0, 5)}–{r.end_time.slice(0, 5)}</div>
              </div>
            ))}
          </div>

          {/* Video Player */}
          {currentRecording && (
            <div className="blueprint" style={{ padding: 'var(--space-3)', position: 'relative' }}>
              <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)', fontSize: '12px' }}>
                <span className="tag tag-outline">CAM {currentCamera + 1}</span>
                <span style={{ opacity: 0.6 }}>{currentRecording.recording_date} {currentRecording.start_time}</span>
                <span style={{ marginLeft: 'auto', opacity: 0.6 }}>HAUL {currentRecording.hauls_count} OF {currentRecording.hauls_count}</span>
              </div>
              
              <div style={{ position: 'relative', aspectRatio: '16/9', background: 'var(--color-neutral-200)', border: '1px solid var(--color-divider)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top right,transparent 49.7%,color-mix(in srgb,var(--color-text) 10%,transparent) 49.7%,color-mix(in srgb,var(--color-text) 10%,transparent) 50.3%,transparent 50.3%),linear-gradient(to bottom right,transparent 49.7%,color-mix(in srgb,var(--color-text) 10%,transparent) 49.7%,color-mix(in srgb,var(--color-text) 10%,transparent) 50.3%,transparent 50.3%)' }}></div>
                <div style={{ textAlign: 'center', fontFamily: 'var(--font-heading)', letterSpacing: '.14em', fontSize: '14px', opacity: 0.5 }}>VIDEO PLACEHOLDER</div>
                <div style={{ position: 'absolute', top: '10px', left: '12px', fontSize: '11px', letterSpacing: '.1em', opacity: 0.6 }}>00:00:00</div>
                <div style={{ position: 'absolute', bottom: '10px', right: '12px', fontSize: '11px', letterSpacing: '.1em', opacity: 0.6 }}>No flags</div>
              </div>

              {/* Playback Controls */}
              <div style={{ marginTop: 'var(--space-3)' }}>
                <div style={{ position: 'relative', height: '34px', cursor: 'pointer', marginBottom: 'var(--space-2)' }}>
                  <div style={{ position: 'absolute', top: '15px', left: 0, right: 0, height: '4px', background: 'color-mix(in srgb,var(--color-text) 12%,transparent)' }}></div>
                  <div style={{ position: 'absolute', top: '15px', left: 0, height: '4px', background: 'var(--color-accent)', width: progressPct + '%' }}></div>
                  <div style={{ position: 'absolute', top: '8px', width: '3px', height: '18px', background: 'var(--color-text)', left: progressPct + '%' }}></div>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <button 
                    className="btn btn-secondary" 
                    onClick={() => setIsPlaying(!isPlaying)}
                    style={{ minWidth: '74px' }}
                  >
                    {isPlaying ? 'Pause' : 'Play'}
                  </button>
                  <button className="btn btn-ghost" onClick={() => setCurrentTime(Math.max(0, currentTime - 10))}>−10s</button>
                  <button className="btn btn-ghost" onClick={() => setCurrentTime(Math.min(duration, currentTime + 10))}>+10s</button>
                  <span style={{ fontSize: '13px', opacity: 0.7, marginLeft: '6px' }}>{formatTime(currentTime)} / {formatTime(duration)}</span>
                  
                  <div className="seg" style={{ marginLeft: 'auto' }}>
                    {[0, 1, 2, 3].map(i => (
                      <button 
                        key={i}
                        className={`seg-opt ${currentCamera === i ? 'active' : ''}`}
                        onClick={() => setCurrentCamera(i)}
                        style={{
                          background: currentCamera === i ? 'var(--color-accent)' : 'transparent',
                          color: currentCamera === i ? 'white' : 'var(--color-text)',
                          border: 'none',
                          padding: '6px 12px',
                          fontSize: '12px',
                          cursor: 'pointer',
                          borderRight: i < 3 ? '1px solid var(--color-divider)' : 'none'
                        }}
                      >
                        CAM {i + 1}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Flags & Timestamps */}
          {recordingFlags.length > 0 && (
            <div className="blueprint" style={{ padding: 'var(--space-3)', position: 'relative' }}>
              <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>
              <div style={{ fontSize: '11px', letterSpacing: '.12em', textTransform: 'uppercase', opacity: 0.55, marginBottom: 'var(--space-3)' }}>Flagged moments</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {recordingFlags.map((f) => (
                  <div key={f.id} style={{ padding: 'var(--space-2)', background: 'color-mix(in srgb,var(--color-text) 3%,transparent)', borderLeft: '2px solid var(--color-accent-700)' }}>
                    <div style={{ fontSize: '12px', fontWeight: '600' }}>
                      {Math.floor(f.timestamp_seconds / 60)}:{String(f.timestamp_seconds % 60).padStart(2, '0')}
                    </div>
                    <div style={{ fontSize: '12px', opacity: 0.75 }}>{f.flag_type}</div>
                    <span style={{ 
                      marginTop: '4px', 
                      display: 'inline-block',
                      padding: '4px 8px',
                      fontSize: '11px',
                      letterSpacing: '0.08em',
                      borderRadius: 'var(--radius)',
                      fontWeight: '500',
                      background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)',
                      color: 'var(--color-accent-700)'
                    }}>
                      {f.severity}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {/* Review Info Card */}
          <div className="blueprint" style={{ padding: 'var(--space-3)', position: 'relative' }}>
            <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>
            <div style={{ fontSize: '11px', letterSpacing: '.12em', textTransform: 'uppercase', opacity: 0.55, marginBottom: 'var(--space-2)' }}>Review status</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', fontSize: '12px' }}>
              <div>
                <span style={{ opacity: 0.6 }}>Unresolved flags</span>
                <div style={{ fontWeight: '600' }}>{recordingFlags.length} flags</div>
              </div>
              <div>
                <span style={{ opacity: 0.6 }}>Compliance</span>
                <div style={{ color: 'var(--color-accent-700)', fontWeight: '600' }}>Pending review</div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="blueprint" style={{ padding: 'var(--space-3)', position: 'relative' }}>
            <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>
            <div style={{ fontSize: '11px', letterSpacing: '.12em', textTransform: 'uppercase', opacity: 0.55, marginBottom: 'var(--space-2)' }}>Observer notes</div>
            <textarea style={{ 
              width: '100%', 
              minHeight: '120px', 
              padding: 'var(--space-2)', 
              border: '1px solid var(--color-divider)', 
              background: 'transparent', 
              color: 'var(--color-text)', 
              fontFamily: 'var(--font-body)', 
              fontSize: '12px', 
              resize: 'vertical',
              borderRadius: 'var(--radius)'
            }} placeholder="Add observations..." />
          </div>
        </div>
      </div>
    </div>
  )
}
