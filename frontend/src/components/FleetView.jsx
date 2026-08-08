import React, { useState, useEffect } from 'react'

export default function FleetView({ vessels, onSelectVessel, onRefresh }) {
  const [kpis, setKpis] = useState([])
  const [positions, setPositions] = useState([])
  const [categories, setCategories] = useState([])
  const [backlog, setBacklog] = useState([])

  useEffect(() => {
    calculateKPIs()
    generatePositions()
    generateCategories()
    generateBacklog()
  }, [vessels])

  const calculateKPIs = () => {
    const totalVessels = vessels.length
    const avgFlags = Math.round(vessels.reduce((sum, v) => sum + (v.unresolved_flags || 0), 0) / totalVessels || 0)
    
    setKpis([
      { label: 'Total vessels', value: totalVessels, note: 'Active in EEZ' },
      { label: 'Fishing now', value: Math.floor(totalVessels * 0.25), note: 'Active hauls' },
      { label: 'Unresolved flags', value: vessels.reduce((sum, v) => sum + (v.unresolved_flags || 0), 0), note: 'Requiring review' },
      { label: 'Avg per vessel', value: avgFlags, note: 'Last 30 days' }
    ])
  }

  const generatePositions = () => {
    const positions = vessels.slice(0, 5).map((v, i) => ({
      x: (20 + i * 15) + '%',
      y: (30 + (i % 2) * 20) + '%',
      dot: i < 2 ? 'var(--color-accent)' : (i < 4 ? 'color-mix(in srgb,var(--color-text) 35%,transparent)' : 'color-mix(in srgb,var(--color-text) 12%,transparent)'),
      name: v.name.split(' ')[1] || v.name
    }))
    setPositions(positions)
  }

  const generateCategories = () => {
    const cats = [
      { name: 'Net damage', fill: 'var(--color-accent)', count: 8, pct: '65%' },
      { name: 'Bycatch', fill: 'var(--color-accent-600)', count: 4, pct: '32%' },
      { name: 'Gear loss', fill: 'var(--color-accent-700)', count: 2, pct: '16%' },
      { name: 'Other', fill: 'var(--color-text)', count: 1, pct: '8%' }
    ]
    setCategories(cats)
  }

  const generateBacklog = () => {
    const back = [
      { day: 'Day 1', count: 2, h: '20%', fill: 'var(--color-accent)' },
      { day: 'Day 2', count: 3, h: '30%', fill: 'var(--color-accent)' },
      { day: 'Day 3', count: 5, h: '50%', fill: 'var(--color-accent-600)' },
      { day: 'Day 4', count: 7, h: '70%', fill: 'var(--color-accent-600)' },
      { day: 'Day 5', count: 9, h: '90%', fill: 'var(--color-accent-700)' },
      { day: 'Day 6', count: 8, h: '80%', fill: 'var(--color-accent-700)' },
      { day: 'Day 7', count: 6, h: '60%', fill: 'var(--color-accent-700)' }
    ]
    setBacklog(back)
  }

  return (
    <div style={{ maxWidth: '1180px', margin: '0 auto', padding: 'var(--space-6) var(--space-4)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
        <div>
          <div style={{ fontSize: '11px', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--color-accent-700)' }}>Registered vessels</div>
          <h1 style={{ fontSize: '38px', margin: '4px 0 0', lineHeight: 1 }}>Fleet</h1>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
          <input className="input" placeholder="Search vessel, licence or IMO" style={{ width: '280px' }} />
          <button className="btn btn-secondary">Filter</button>
          <button className="btn btn-secondary" onClick={onRefresh}>↻</button>
        </div>
      </div>

      {/* KPIs Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '1px', background: 'var(--color-divider)', border: '1px solid var(--color-divider)', marginBottom: 'var(--space-4)' }}>
        {kpis.map((k, i) => (
          <div key={i} style={{ background: 'var(--color-bg)', padding: '12px 14px' }}>
            <div style={{ fontSize: '10px', letterSpacing: '.1em', textTransform: 'uppercase', opacity: 0.5 }}>{k.label}</div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: '30px', lineHeight: 1.1, marginTop: '2px' }}>{k.value}</div>
            <div style={{ fontSize: '11px', opacity: 0.55 }}>{k.note}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
        {/* Map View */}
        <div className="blueprint" style={{ padding: 'var(--space-3)' }}>
          <span className="corner tl"></span>
          <span className="corner tr"></span>
          <span className="corner bl"></span>
          <span className="corner br"></span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <div style={{ fontSize: '11px', letterSpacing: '.12em', textTransform: 'uppercase', opacity: 0.55 }}>Fleet positions — last AIS ping</div>
            <span style={{ marginLeft: 'auto', fontSize: '11px', opacity: 0.5 }}>EEZ · updated 4 min ago</span>
          </div>
          <div style={{ position: 'relative', aspectRatio: '16/10', marginTop: 'var(--space-3)', border: '1px solid var(--color-divider)', background: 'var(--color-neutral-200)' }}>
            <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(to right,color-mix(in srgb,var(--color-text) 7%,transparent) 1px,transparent 1px),linear-gradient(to bottom,color-mix(in srgb,var(--color-text) 7%,transparent) 1px,transparent 1px)', backgroundSize: '10% 12.5%' }}></div>
            {positions.map((p, i) => (
              <div key={i} style={{ position: 'absolute', left: p.x, top: p.y, transform: 'translate(-50%,-50%)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '9px', height: '9px', background: p.dot, display: 'block', borderRadius: '50%' }}></span>
                <span style={{ fontSize: '10px', letterSpacing: '.06em', whiteSpace: 'nowrap', opacity: 0.75 }}>{p.name}</span>
              </div>
            ))}
            <div style={{ position: 'absolute', left: '10px', bottom: '8px', fontSize: '10px', letterSpacing: '.08em', opacity: 0.45 }}>MAP PLACEHOLDER · NZ EEZ</div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-2)', fontSize: '11px', opacity: 0.6 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '8px', height: '8px', background: 'var(--color-accent)', display: 'block' }}></span>Fishing now</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '8px', height: '8px', background: 'color-mix(in srgb,var(--color-text) 35%,transparent)', display: 'block' }}></span>In transit</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '8px', height: '8px', background: 'color-mix(in srgb,var(--color-text) 12%,transparent)', display: 'block' }}></span>In port</span>
          </div>
        </div>

        {/* Right Column Stats */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', minWidth: 0 }}>
          {/* Flags by Category */}
          <div className="blueprint" style={{ padding: 'var(--space-3)' }}>
            <span className="corner tl"></span>
            <span className="corner tr"></span>
            <span className="corner bl"></span>
            <span className="corner br"></span>
            <div style={{ fontSize: '11px', letterSpacing: '.12em', textTransform: 'uppercase', opacity: 0.55 }}>Flags by category — 30 days</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', marginTop: 'var(--space-3)' }}>
              {categories.map((c, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '130px minmax(80px,1fr) 40px', gap: '10px', alignItems: 'center', fontSize: '13px' }}>
                  <span>{c.name}</span>
                  <span style={{ display: 'block', height: '10px', background: 'color-mix(in srgb,var(--color-text) 8%,transparent)' }}>
                    <span style={{ display: 'block', height: '10px', background: c.fill, width: c.pct }}></span>
                  </span>
                  <span style={{ textAlign: 'right', opacity: 0.7 }}>{c.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Review Backlog */}
          <div className="blueprint" style={{ padding: 'var(--space-3)' }}>
            <span className="corner tl"></span>
            <span className="corner tr"></span>
            <span className="corner bl"></span>
            <span className="corner br"></span>
            <div style={{ fontSize: '11px', letterSpacing: '.12em', textTransform: 'uppercase', opacity: 0.55 }}>Review backlog by age</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '96px', marginTop: 'var(--space-3)' }}>
              {backlog.map((b, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: '5px', height: '100%' }}>
                  <span style={{ fontSize: '10px', opacity: 0.5 }}>{b.count}</span>
                  <span style={{ width: '100%', background: b.fill, height: b.h }}></span>
                  <span style={{ fontSize: '10px', opacity: 0.5 }}>{b.day}</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize: '11px', opacity: 0.45, marginTop: '8px' }}>Statutory review window: 7 days from upload.</div>
          </div>
        </div>
      </div>

      {/* Fleet Table */}
      <div className="blueprint" style={{ padding: 'var(--space-3)' }}>
        <span className="corner tl"></span>
        <span className="corner tr"></span>
        <span className="corner bl"></span>
        <span className="corner br"></span>
        <table className="table">
          <thead>
            <tr><th>Vessel</th><th>IMO</th><th>Licence</th><th>Gear</th><th>Recordings</th><th>Unreviewed flags</th><th></th></tr>
          </thead>
          <tbody>
            {vessels.map((v) => (
              <tr key={v.id} onClick={() => onSelectVessel(v.id)}>
                <td style={{ fontFamily: 'var(--font-heading)', fontSize: '16px' }}>{v.name}</td>
                <td style={{ opacity: 0.65 }}>{v.imo}</td>
                <td style={{ opacity: 0.65 }}>{v.licence}</td>
                <td style={{ opacity: 0.65 }}>{v.gear}</td>
                <td style={{ opacity: 0.65 }}>{v.recordings_count || 0}</td>
                <td><span className="tag tag-accent">{v.unresolved_flags || 0}</span></td>
                <td style={{ textAlign: 'right' }}><span className="btn btn-ghost" style={{ pointerEvents: 'none' }}>Open →</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
