import React from 'react'

// The four states every async surface must have. Scoped to the surface that
// is loading rather than blanking the whole page, which is what the single
// global `loading` flag used to do.

export function Skeleton({ width = '100%', height = 12, style }) {
  return <div className="skeleton" style={{ width, height, ...style }} aria-hidden="true" />
}

export function TableSkeleton({ rows = 6, cols = 5 }) {
  return (
    <div className="table-wrap" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <table className="data">
        <tbody>
          {Array.from({ length: rows }, (_, r) => (
            <tr key={r}>
              {Array.from({ length: cols }, (_, c) => (
                <td key={c}>
                  <Skeleton width={c === 0 ? '60%' : '80%'} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function EmptyState({ title, children, action }) {
  return (
    <div className="state">
      <h3>{title}</h3>
      {children ? <p>{children}</p> : null}
      {action ? <div className="state-actions">{action}</div> : null}
    </div>
  )
}

// Errors say what failed and what to do about it, and always offer a retry.
export function ErrorState({ title = 'Could not load this', error, onRetry }) {
  const message =
    error?.status === 0
      ? 'The API is not responding. Start the backend, then try again.'
      : error?.message || 'An unexpected error occurred.'

  return (
    <div className="state state-error" role="alert">
      <h3>{title}</h3>
      <p>{message}</p>
      {onRetry ? (
        <div className="state-actions">
          <button type="button" className="btn" onClick={onRetry}>
            Try again
          </button>
        </div>
      ) : null}
    </div>
  )
}

// Write state, announced politely so it reaches a screen reader without
// interrupting. A reviewer must never wonder whether a determination saved.
export function SaveIndicator({ state, error }) {
  const label =
    state === 'saving'
      ? 'Saving…'
      : state === 'saved'
        ? 'Saved'
        : state === 'error'
          ? error?.message || 'Not saved'
          : ''

  return (
    <span className="save-state" data-state={state || 'idle'} role="status" aria-live="polite">
      {state && state !== 'idle' ? <span className="dot" /> : null}
      {label}
    </span>
  )
}
