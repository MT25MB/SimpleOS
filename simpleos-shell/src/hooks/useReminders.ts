import { useCallback, useEffect, useState } from 'react'
import type { ErrorCode, Reminder, RemindersFile } from '../types'

const FALLBACK_KEY = 'simpleos.reminders'
const MAX_REMINDERS = 100
const MAX_TEXT_LENGTH = 200
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

function todayKey(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

function isReminder(value: unknown): value is Reminder {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return (
    typeof item.id === 'string' &&
    item.id.length > 0 &&
    typeof item.text === 'string' &&
    item.text.trim().length > 0 &&
    item.text.length <= MAX_TEXT_LENGTH &&
    typeof item.time === 'string' &&
    (item.time === '' || TIME_PATTERN.test(item.time)) &&
    typeof item.done === 'boolean' &&
    typeof item.createdAt === 'number' &&
    Number.isFinite(item.createdAt)
  )
}

function isRemindersFile(value: unknown): value is RemindersFile {
  if (!value || typeof value !== 'object') return false
  const file = value as Partial<RemindersFile>
  return (
    typeof file.date === 'string' &&
    Array.isArray(file.items) &&
    file.items.length <= MAX_REMINDERS &&
    file.items.every(isReminder)
  )
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
      if (isRemindersFile(parsed)) return parsed
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
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const bridge = window.simpleOS
      if (!bridge) {
        setStore(normalize(readFallback()))
        setLoaded(true)
        return
      }

      try {
        const result = await bridge.loadReminders()
        if (cancelled) return
        if (!result.ok) {
          // Never overwrite an unreadable file with an empty list.
          setAllowSave(false)
          setError(result.code)
        } else {
          setStore(normalize(result.value))
        }
      } catch {
        if (!cancelled) {
          setAllowSave(false)
          setError('STORAGE_FAILED')
        }
      }
      if (!cancelled) setLoaded(true)
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

    void bridge
      .saveReminders(store)
      .then((result) => {
        if (!cancelled && !result.ok) setError(result.code)
      })
      .catch(() => {
        if (!cancelled) setError('STORAGE_FAILED')
      })

    return () => {
      cancelled = true
    }
  }, [store, loaded, allowSave])

  const add = useCallback((text: string, time: string) => {
    const trimmed = text.trim()
    if (!trimmed) {
      setNotice('Type something to remind yourself first.')
      return
    }
    if (trimmed.length > MAX_TEXT_LENGTH) {
      setNotice('That reminder is too long. Use fewer words.')
      return
    }
    if (store.items.length >= MAX_REMINDERS) {
      setNotice('Your list is full. Remove one before adding another.')
      return
    }
    if (time !== '' && !TIME_PATTERN.test(time)) {
      setNotice("That time doesn't look right. Try again.")
      return
    }

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
    setNotice(trimmed.length > 32 ? 'Reminder added.' : `Added: ${trimmed}`)
  }, [store.items.length])

  const toggle = useCallback(
    (id: string) => {
      const item = store.items.find((entry) => entry.id === id)
      if (!item) return
      setNotice(item.done ? `${item.text} is back on your list.` : `Marked ${item.text} as done.`)
      setStore((current) => ({
        ...current,
        items: current.items.map((entry) =>
          entry.id === id ? { ...entry, done: !entry.done } : entry,
        ),
      }))
    },
    [store.items],
  )

  const remove = useCallback(
    (id: string) => {
      const item = store.items.find((entry) => entry.id === id)
      if (!item) return
      setNotice(`Removed: ${item.text}`)
      setStore((current) => ({
        ...current,
        items: current.items.filter((entry) => entry.id !== id),
      }))
    },
    [store.items],
  )

  const reset = useCallback(() => {
    if (store.items.length === 0) return
    setNotice("It's a new day. All reminders are back on your list.")
    setStore((current) => ({
      date: todayKey(),
      items: current.items.map((item) => ({ ...item, done: false })),
    }))
  }, [store.items.length])

  const clearError = useCallback(() => setError(null), [])
  const clearNotice = useCallback(() => setNotice(null), [])

  return { store, loaded, error, notice, add, toggle, remove, reset, clearError, clearNotice }
}
