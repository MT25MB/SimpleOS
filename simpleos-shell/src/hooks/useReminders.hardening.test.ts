import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useReminders } from './useReminders'
import type { RemindersFile, SimpleOSBridge } from '../types'

function bridge(file: RemindersFile): SimpleOSBridge {
  return {
    loadReminders: vi.fn().mockResolvedValue({ ok: true, value: file }),
    saveReminders: vi.fn().mockResolvedValue({ ok: true }),
  } as unknown as SimpleOSBridge
}

describe('reminder input hardening', () => {
  beforeEach(() => {
    window.localStorage.clear()
    delete (window as { simpleOS?: SimpleOSBridge }).simpleOS
  })

  it('explains what to do when the reminder text is empty', async () => {
    const { result } = renderHook(() => useReminders())
    await waitFor(() => expect(result.current.loaded).toBe(true))

    act(() => result.current.add('   ', ''))
    expect(result.current.store.items).toHaveLength(0)
    expect(result.current.notice).toMatch(/type something/i)
  })

  it('rejects an overlong reminder with a plain-English message', async () => {
    const { result } = renderHook(() => useReminders())
    await waitFor(() => expect(result.current.loaded).toBe(true))

    act(() => result.current.add('x'.repeat(300), ''))
    expect(result.current.store.items).toHaveLength(0)
    expect(result.current.notice).toMatch(/too long/i)
  })

  it('rejects a malformed time without breaking the list', async () => {
    const { result } = renderHook(() => useReminders())
    await waitFor(() => expect(result.current.loaded).toBe(true))

    act(() => result.current.add('Call Anna', '25:99'))
    expect(result.current.store.items).toHaveLength(0)
    expect(result.current.notice).toMatch(/time doesn't look right/i)
  })

  it('gives feedback for add, mark done, remove and new day', async () => {
    const { result } = renderHook(() => useReminders())
    await waitFor(() => expect(result.current.loaded).toBe(true))

    act(() => result.current.add('Call Anna', '17:00'))
    expect(result.current.notice).toMatch(/added/i)

    const id = result.current.store.items[0].id
    act(() => result.current.toggle(id))
    expect(result.current.notice).toMatch(/done/i)
    expect(result.current.store.items[0].done).toBe(true)

    act(() => result.current.reset())
    expect(result.current.notice).toMatch(/new day/i)
    expect(result.current.store.items[0].done).toBe(false)

    act(() => result.current.remove(id))
    expect(result.current.notice).toMatch(/removed/i)
    expect(result.current.store.items).toHaveLength(0)
  })

  it('ignores corrupt data in the browser fallback instead of crashing', async () => {
    window.localStorage.setItem(
      'simpleos.reminders',
      JSON.stringify({ date: '2026-11-21', items: [null, 42, { text: 'no id' }] }),
    )
    const { result } = renderHook(() => useReminders())
    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(result.current.store.items).toHaveLength(0)
  })

  it('surfaces a calm error and finishes loading when IPC rejects', async () => {
    window.simpleOS = {
      loadReminders: vi.fn().mockRejectedValue(new Error('ENOENT: no such file')),
      saveReminders: vi.fn().mockResolvedValue({ ok: true }),
    } as unknown as SimpleOSBridge

    const { result } = renderHook(() => useReminders())
    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(result.current.error).toBe('STORAGE_FAILED')
    expect(window.simpleOS?.saveReminders).not.toHaveBeenCalled()
  })

  it('surfaces a save failure without throwing', async () => {
    const b = bridge({ date: '', items: [] })
    b.saveReminders = vi.fn().mockRejectedValue(new Error(' disk full '))
    window.simpleOS = b

    const { result } = renderHook(() => useReminders())
    await waitFor(() => expect(result.current.loaded).toBe(true))
    act(() => result.current.add('Call Anna', ''))
    await waitFor(() => expect(result.current.error).toBe('STORAGE_FAILED'))
  })
})
