import { useEffect, useState } from 'react'

interface PhotoFrameProps {
  photos: string[]
  onDismiss: () => void
}

const ROTATE_MS = 8_000

/** A quiet, full-screen clock and local photo slideshow. Any input dismisses it. */
export function PhotoFrame({ photos, onDismiss }: PhotoFrameProps) {
  const [index, setIndex] = useState(0)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    if (photos.length < 2) return
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % photos.length), ROTATE_MS)
    return () => window.clearInterval(timer)
  }, [photos.length])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    function onKey() {
      onDismiss()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onDismiss])

  return (
    <div className="frame" aria-label="Photo frame" onClick={onDismiss}>
      {photos.length > 0 && (
        <img className="frame__photo" src={photos[index % photos.length]} alt="" />
      )}
      <div className="frame__overlay">
        <p className="frame__time">{now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p>
        <p className="frame__date">
          {now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
        <button
          type="button"
          className="button button--secondary frame__exit"
          onClick={(event) => {
            event.stopPropagation()
            onDismiss()
          }}
        >
          Back to SimpleOS
        </button>
      </div>
    </div>
  )
}
