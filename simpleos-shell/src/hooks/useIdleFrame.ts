import { useCallback, useEffect, useRef, useState } from 'react'
import type { FrameDelay } from '../types'

/** Shows the calm photo frame after a configurable period of no activity. */
export function useIdleFrame(delay: FrameDelay) {
  const [active, setActive] = useState(false)
  const timer = useRef<number | null>(null)

  const clear = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
  }, [])

  const arm = useCallback(() => {
    clear()
    if (delay > 0) {
      timer.current = window.setTimeout(() => setActive(true), delay * 60_000)
    }
  }, [clear, delay])

  const dismiss = useCallback(() => {
    setActive(false)
    arm()
  }, [arm])

  useEffect(() => {
    const events: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'mousemove']
    events.forEach((event) => window.addEventListener(event, arm))
    arm()
    return () => {
      events.forEach((event) => window.removeEventListener(event, arm))
      clear()
    }
  }, [arm, clear])

  useEffect(() => {
    if (!active) return
    const events: Array<keyof WindowEventMap> = ['pointerdown', 'keydown']
    events.forEach((event) => window.addEventListener(event, dismiss))
    return () => events.forEach((event) => window.removeEventListener(event, dismiss))
  }, [active, dismiss])

  useEffect(() => () => clear(), [clear])

  return { active, dismiss }
}
