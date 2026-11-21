import { useCallback, useEffect, useState } from 'react'
import type { HardwareStatus } from '../types'

const REFRESH_MS = 30_000

/** Safe starting point: no claims about hardware until the main process answers. */
const DEFAULT_STATUS: HardwareStatus = {
  wifi: { connected: false, ssid: null },
  battery: { present: false, percent: null, charging: null },
  brightnessAvailable: false,
}

/**
 * Poll the read-only hardware status once on mount and every 30 seconds. A
 * failed or missing call leaves the last known state in place rather than
 * throwing at the person using the computer.
 */
export function useHardwareStatus() {
  const [status, setStatus] = useState<HardwareStatus>(DEFAULT_STATUS)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const bridge = window.simpleOS
    if (!bridge || typeof bridge.getHardwareStatus !== 'function') {
      setLoading(false)
      return
    }
    try {
      const result = await bridge.getHardwareStatus()
      if (result.ok) setStatus(result.value)
    } catch {
      // Keep the last known values; the strip is informational, not critical.
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => void refresh(), REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [refresh])

  return { status, loading, refresh }
}
