import React from 'react';

export default function ReportsView({ vessels, recordings, flags }) {
  const bySeverity = {
    High: 0,
    Medium: 0,
    Low: 0
  };

  for (const flag of flags) {
    if (bySeverity[flag.severity] !== undefined) {
      bySeverity[flag.severity] += 1;
    }
  }

  const vesselFlagCounts = vessels
    .map((vessel) => {
      const vesselRecordings = recordings.filter((recording) => recording.vessel_id === vessel.id).map((r) => r.id);
      const unresolved = flags.filter((flag) => vesselRecordings.includes(flag.recording_id)).length;
      return {
        id: vessel.id,
        name: vessel.name,
        unresolved
      };
    })
    .sort((a, b) => b.unresolved - a.unresolved)
    .slice(0, 5);

  const cards = [
    { label: 'Vessels', value: vessels.length, note: 'In this account' },
    { label: 'Recordings', value: recordings.length, note: 'Reviewable sessions' },
    { label: 'Open flags', value: flags.length, note: 'Unresolved items' },
    {
      label: 'Flags / recording',
      value: recordings.length ? (flags.length / recordings.length).toFixed(1) : '0.0',
      note: 'Current workload density'
    }
  ];

  return (
    <div style={{ maxWidth: '1180px', margin: '0 auto', padding: 'var(--space-6) var(--space-4)' }}>
      <div style={{ marginBottom: 'var(--space-5)' }}>
        <div style={{ fontSize: '11px', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--color-accent-700)' }}>Observer intelligence</div>
        <h1 style={{ fontSize: '38px', margin: '4px 0 0', lineHeight: 1 }}>Reports</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '1px', background: 'var(--color-divider)', border: '1px solid var(--color-divider)', marginBottom: 'var(--space-4)' }}>
        {cards.map((card) => (
          <div key={card.label} style={{ background: 'var(--color-bg)', padding: '12px 14px' }}>
            <div style={{ fontSize: '10px', letterSpacing: '.1em', textTransform: 'uppercase', opacity: 0.5 }}>{card.label}</div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: '30px', lineHeight: 1.1, marginTop: '2px' }}>{card.value}</div>
            <div style={{ fontSize: '11px', opacity: 0.55 }}>{card.note}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 'var(--space-4)' }}>
        <div className="blueprint" style={{ padding: 'var(--space-3)' }}>
          <span className="corner tl"></span>
          <span className="corner tr"></span>
          <span className="corner bl"></span>
          <span className="corner br"></span>
          <div style={{ fontSize: '11px', letterSpacing: '.12em', textTransform: 'uppercase', opacity: 0.55, marginBottom: 'var(--space-3)' }}>Flags by severity</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {Object.entries(bySeverity).map(([severity, count]) => (
              <div key={severity} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 40px', gap: '10px', alignItems: 'center' }}>
                <span style={{ fontSize: '13px' }}>{severity}</span>
                <span style={{ height: '10px', background: 'color-mix(in srgb,var(--color-text) 8%,transparent)', display: 'block' }}>
                  <span style={{ display: 'block', height: '10px', width: `${flags.length ? Math.round((count / flags.length) * 100) : 0}%`, background: 'var(--color-accent)' }}></span>
                </span>
                <span style={{ textAlign: 'right', fontSize: '13px', opacity: 0.75 }}>{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="blueprint" style={{ padding: 'var(--space-3)' }}>
          <span className="corner tl"></span>
          <span className="corner tr"></span>
          <span className="corner bl"></span>
          <span className="corner br"></span>
          <div style={{ fontSize: '11px', letterSpacing: '.12em', textTransform: 'uppercase', opacity: 0.55, marginBottom: 'var(--space-3)' }}>Top vessels by unresolved flags</div>
          <table className="table">
            <thead>
              <tr>
                <th>Vessel</th>
                <th style={{ textAlign: 'right' }}>Open flags</th>
              </tr>
            </thead>
            <tbody>
              {vesselFlagCounts.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td style={{ textAlign: 'right' }}>{item.unresolved}</td>
                </tr>
              ))}
              {vesselFlagCounts.length === 0 && (
                <tr>
                  <td colSpan={2} style={{ opacity: 0.6 }}>No data available.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
