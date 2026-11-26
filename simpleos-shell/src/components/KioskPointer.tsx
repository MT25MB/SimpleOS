import { useEffect, useState } from 'react'

interface Point {
  x: number
  y: number
}

/**
 * A large, high-contrast pointer drawn by SimpleOS itself.
 *
 * wlroots normally draws the pointer, but on virtual GPUs the compositor
 * cursor can be invisible even with WLR_NO_HARDWARE_CURSORS=1 (the theme
 * lookup can fail and no image is drawn). Drawing our own arrow means the
 * person can always see where they are pointing. It is decorative only and
 * never intercepts clicks.
 */
export function KioskPointer() {
  const [point, setPoint] = useState<Point | null>(null)

  useEffect(() => {
    const move = (event: MouseEvent) => {
      setPoint({ x: event.clientX, y: event.clientY })
    }
    window.addEventListener('mousemove', move, { passive: true })
    return () => window.removeEventListener('mousemove', move)
  }, [])

  if (!point) return null

  return (
    <div
      className="kiosk-pointer"
      data-testid="kiosk-pointer"
      style={{ transform: `translate(${point.x}px, ${point.y}px)` }}
      aria-hidden="true"
    >
      <svg width="36" height="36" viewBox="0 0 24 24" focusable="false">
        <path
          d="M3 2 L3 20 L8.2 15.2 L11.6 22.3 L14.8 20.9 L11.4 13.9 L18.6 13.9 Z"
          fill="#ffffff"
          stroke="#0b1120"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}
