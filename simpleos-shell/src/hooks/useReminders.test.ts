import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act, waitFor as rtlWaitFor } from '@testing-library/react'

// Alias avoids the duplicate-identifier conflict with Vitest's ambient globals.
const waitFor = rtlWaitFor
import { useReminders } from './useReminders'
import type { RemindersFile, SimpleOSBridge } from '../types'

function today(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function bridgeWith(file: RemindersFile): SimpleOSBridge {
  return {
    loadReminders: vi.fn().mockResolvedValue({ ok: true, value: file }),
    saveReminders: vi.fn().mockResolvedValue({ ok: true }),
  } as unknown as SimpleOSBridge
}

describe('useReminders', () => {
  beforeEach(() => {
    window.localStorage.clear()
    delete (window as { simpleOS?: SimpleOSBridge }).simpleOS
  })

  it('falls back to localStorage in a browser with no Electron bridge', async () => {
    const { result } = renderHook(() => useReminders())
    await waitFor(() => expect(result.current.loaded).toBe(true))

    act(() => result.current.add('Call Anna', '17:00'))
    expect(result.current.store.items[0]).toMatchObject({
      text: 'Call Anna',
      time: '17:00',
      done: false,
    })
    await waitFor(() => {
      expect(JSON.parse(window.localStorage.getItem('simpleos.reminders') || '{}').items).toHaveLength(1)
    })
  })

  it('adds, toggles, removes and resets reminders through the bridge', async () => {
    const saved: RemindersFile = { date: today(), items: [] }
    window.simpleOS = bridgeWith(saved)
    const { result } = renderHook(() => useReminders())
    await waitFor(() => expect(result.current.loaded).toBe(true))

    act(() => result.current.add('Buy milk', ''))
    const id = result.current.store.items[0].id
    expect(result.current.store.items[0].done).toBe(false)

    act(() => result.current.toggle(id))
    expect(result.current.store.items[0].done).toBe(true)

    act(() => result.current.reset())
    expect(result.current.store.items[0].done).toBe(false)

    act(() => result.current.remove(id))
    expect(result.current.store.items).toHaveLength(0)

    await waitFor(() => {
      expect(window.simpleOS?.saveReminders).toHaveBeenCalled()
    })
  })

  it('clears done marks from a previous day but keeps the reminders', async () => {
    const old: RemindersFile = {
      date: '2000-01-01',
      items: [
        { id: 'a', text: 'Old reminder', time: '', done: true, createdAt: 1 },
      ],
    }
    window.simpleOS = bridgeWith(old)
    const { result } = renderHook(() => useReminders())
    await waitFor(() => expect(result.current.loaded).toBe(true))

    expect(result.current.store.date).toBe(today())
    expect(result.current.store.items[0]).toMatchObject({ text: 'Old reminder', done: false })
  })

  it('does not overwrite an unreadable file and surfaces a calm error code', async () => {
    window.simpleOS = {
      loadReminders: vi.fn().mockResolvedValue({ ok: false, code: 'STORAGE_FAILED' }),
      saveReminders: vi.fn().mockResolvedValue({ ok: true }),
    } as unknown as SimpleOSBridge
    const { result } = renderHook(() => useReminders())
    await waitFor(() => expect(result.current.loaded).toBe(true))

    expect(result.current.error).toBe('STORAGE_FAILED')
    act(() => result.current.add('Should not persist', ''))
    await Promise.resolve()
    expect(window.simpleOS?.saveReminders).not.toHaveBeenCalled()
  })
})
