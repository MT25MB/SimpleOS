import { useCallback, useEffect, useState } from 'react'

/** The 18px root is multiplied by these to give 18px, 22px and 26px exactly. */
export const FONT_SCALES = [
  { label: 'Normal', value: 1, pixels: 18 },
  { label: 'Large', value: 22 / 18, pixels: 22 },
  { label: 'Extra Large', value: 26 / 18, pixels: 26 },
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
