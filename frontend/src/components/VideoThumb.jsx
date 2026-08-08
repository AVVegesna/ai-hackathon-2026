import React, { useState } from 'react'

// A still from the clip itself, so a row in the footage list is recognisable
// as a piece of footage rather than a filename.
//
// The frame comes from a media fragment (`#t=`) with preload="metadata": the
// browser fetches only enough to seek and paint one frame, so a list of these
// does not download every video. There is no server-side thumbnailer to
// depend on, and no still to keep in sync with the media.

export default function VideoThumb({ url, at = 1, alt = '' }) {
  const [failed, setFailed] = useState(false)

  if (!url || failed) {
    return (
      <span className="thumb thumb-empty" role="img" aria-label={alt || 'No preview available'}>
        No preview
      </span>
    )
  }

  return (
    <span className="thumb">
      <video
        src={`${url}#t=${at}`}
        preload="metadata"
        muted
        playsInline
        tabIndex={-1}
        aria-hidden="true"
        onError={() => setFailed(true)}
      />
    </span>
  )
}
