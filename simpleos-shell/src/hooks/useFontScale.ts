import { useCallback, useEffect, useState } from 'react'

export const FONT_SCALES = [
  { label: 'Normal', value: 1 },
  { label: 'Large', value: 1.15 },
  { label: 'Extra Large', value: 1.35 },
] as const

export type FontScale = (typeof FONT_SCALES)[number]['value']

const STORAGE_KEY = 'simpleos.fontScale'

function isFontScale(value: unknown): value is FontScale {
  return (
    typeof value === 'number' &&
    FONT_SCALES.some((option) => option.value === value)
  )
}

/** Persisted text scaling applied as a CSS variable on the root element. */
export function useFontScale() {
  const [scale, setScale] = useState<FontScale>(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (stored !== null) {
        const parsed = Number(stored)
        if (isFontScale(parsed)) return parsed
      }
    } catch {
      // localStorage can be unavailable; fall back to the default.
    }
    return 1
  })

  useEffect(() => {
    document.documentElement.style.setProperty('--font-scale', String(scale))
    try {
      window.localStorage.setItem(STORAGE_KEY, String(scale))
    } catch {
      // Persisting is best-effort only.
    }
  }, [scale])

  const setFontScale = useCallback((next: FontScale) => setScale(next), [])

  return { scale, setFontScale }
}
