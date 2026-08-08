import React from 'react';

function formatDuration(minutes) {
  if (!minutes && minutes !== 0) return '--';
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hrs}h ${mins}m`;
}

export default function ReviewQueueView({ recordings, flags, onOpenVessel, onRefresh }) {
  const queueItems = recordings
    .map((recording) => {
      const recordingFlags = flags.filter((flag) => flag.recording_id === recording.id);
      return {
        ...recording,
        unresolved: recordingFlags.length
      };
    })
    .sort((a, b) => b.unresolved - a.unresolved || (a.recording_date < b.recording_date ? 1 : -1));

  return (
    <div style={{ maxWidth: '1180px', margin: '0 auto', padding: 'var(--space-6) var(--space-4)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
        <div>
          <div style={{ fontSize: '11px', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--color-accent-700)' }}>Operational review</div>
          <h1 style={{ fontSize: '38px', margin: '4px 0 0', lineHeight: 1 }}>Review queue</h1>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 'var(--space-2)' }}>
          <button className="btn btn-secondary" onClick={onRefresh}>Refresh queue</button>
        </div>
      </div>

      <div className="blueprint" style={{ padding: 'var(--space-3)' }}>
        <span className="corner tl"></span>
        <span className="corner tr"></span>
        <span className="corner bl"></span>
        <span className="corner br"></span>

        {queueItems.length === 0 ? (
          <div style={{ padding: 'var(--space-4)', opacity: 0.65 }}>No recordings available for this account.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Vessel</th>
                <th>Recording date</th>
                <th>Window</th>
                <th>Duration</th>
                <th>Pending flags</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {queueItems.map((item) => (
                <tr key={item.id} onClick={() => onOpenVessel(item.vessel_id)}>
                  <td style={{ fontFamily: 'var(--font-heading)', fontSize: '16px' }}>{item.vessel_name}</td>
                  <td style={{ opacity: 0.7 }}>{item.recording_date}</td>
                  <td style={{ opacity: 0.7 }}>{item.start_time?.slice(0, 5)}-{item.end_time?.slice(0, 5)}</td>
                  <td style={{ opacity: 0.7 }}>{formatDuration(item.duration_minutes)}</td>
                  <td>
                    <span className="tag tag-accent">{item.unresolved}</span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <span className="btn btn-ghost" style={{ pointerEvents: 'none' }}>Open vessel →</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
