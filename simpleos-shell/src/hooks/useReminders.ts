import { useCallback, useEffect, useState } from 'react'
import type { ErrorCode, Reminder, RemindersFile } from '../types'

const FALLBACK_KEY = 'simpleos.reminders'

function todayKey(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

/** A new day clears yesterday's "done" marks but keeps the reminders. */
function normalize(data: RemindersFile): RemindersFile {
  if (data.date === todayKey()) return data
  return {
    date: todayKey(),
    items: data.items.map((item) => ({ ...item, done: false })),
  }
}

function readFallback(): RemindersFile {
  try {
    const raw = window.localStorage.getItem(FALLBACK_KEY)
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        const candidate = parsed as RemindersFile
        if (typeof candidate.date === 'string' && Array.isArray(candidate.items)) {
          return candidate
        }
      }
    }
  } catch {
    // Fall back to an empty list.
  }
  return { date: '', items: [] }
}

/** Reminders persisted through Electron IPC, with a browser-only fallback. */
export function useReminders() {
  const [store, setStore] = useState<RemindersFile>({ date: '', items: [] })
  const [loaded, setLoaded] = useState(false)
  const [allowSave, setAllowSave] = useState(true)
  const [error, setError] = useState<ErrorCode | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const bridge = window.simpleOS
      if (!bridge) {
        setStore(normalize(readFallback()))
        setLoaded(true)
        return
      }

      const result = await bridge.loadReminders()
      if (cancelled) return
      if (!result.ok) {
        // Never overwrite an unreadable file with an empty list.
        setAllowSave(false)
        setError(result.code)
      } else {
        setStore(normalize(result.value))
      }
      setLoaded(true)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!loaded || !allowSave) return
    let cancelled = false

    const bridge = window.simpleOS
    if (!bridge) {
      try {
        window.localStorage.setItem(FALLBACK_KEY, JSON.stringify(store))
      } catch {
        setError('STORAGE_FAILED')
      }
      return
    }

    void bridge.saveReminders(store).then((result) => {
      if (!cancelled && !result.ok) setError(result.code)
    })

    return () => {
      cancelled = true
    }
  }, [store, loaded, allowSave])

  const add = useCallback((text: string, time: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    const now = Date.now()
    const reminder: Reminder = {
      id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
      text: trimmed,
      time,
      done: false,
      createdAt: now,
    }
    setStore((current) => ({ date: todayKey(), items: [...current.items, reminder] }))
    setError(null)
  }, [])

  const toggle = useCallback((id: string) => {
    setStore((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === id ? { ...item, done: !item.done } : item,
      ),
    }))
  }, [])

  const remove = useCallback((id: string) => {
    setStore((current) => ({
      ...current,
      items: current.items.filter((item) => item.id !== id),
    }))
  }, [])

  const reset = useCallback(() => {
    setStore((current) => ({
      date: todayKey(),
      items: current.items.map((item) => ({ ...item, done: false })),
    }))
  }, [])

  const clearError = useCallback(() => setError(null), [])

  return { store, loaded, error, add, toggle, remove, reset, clearError }
}
