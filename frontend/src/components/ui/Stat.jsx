import React from 'react'

// A single figure in a stat row. Shared by the queue and the ingest results so
// the two read as the same system.
//
// `unavailable` is deliberate: when a figure cannot be derived from the data,
// the tile says so rather than showing a zero that looks like a measurement.
export default function Stat({ label, value, note, alert, unavailable }) {
  return (
    <div className={`stat${alert ? ' stat-alert' : ''}${unavailable ? ' stat-unavailable' : ''}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{unavailable ? 'Not available' : value}</div>
      {note ? <div className="stat-note">{note}</div> : null}
    </div>
  )
}
