import React from 'react'
import { SEVERITY_GLYPH, severityClass, dueState } from '../../lib/format'

// Severity carries a glyph as well as a tint, so it survives greyscale
// printing and colour-blind vision. The glyph is decorative — the text label
// beside it is what a screen reader announces.
export function SeverityBadge({ severity }) {
  const label = severity || 'Unknown'
  return (
    <span className={`badge ${severityClass(severity)}`}>
      <span className="badge-glyph" aria-hidden="true">
        {SEVERITY_GLYPH[label] || '●'}
      </span>
      {label}
    </span>
  )
}

const DETERMINATION_STYLE = {
  upheld: { cls: 'badge-high', label: 'Upheld' },
  dismissed: { cls: 'badge-ok', label: 'Dismissed' },
  escalated: { cls: 'badge-escalated', label: 'Escalated' },
}

export function StatusBadge({ flag }) {
  if (flag.determination) {
    const s = DETERMINATION_STYLE[flag.determination] || {
      cls: 'badge-neutral',
      label: flag.determination,
    }
    return <span className={`badge ${s.cls}`}>{s.label}</span>
  }
  return <span className="badge badge-neutral">Open</span>
}

export function DueBadge({ dueAt }) {
  const s = dueState(dueAt)
  return (
    <span className="due" data-overdue={s.overdue} data-soon={s.soon}>
      {s.overdue ? <span aria-hidden="true">⚠</span> : null}
      {s.label}
    </span>
  )
}

export function Kbd({ children }) {
  return <kbd className="kbd">{children}</kbd>
}
