import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { SimpleOSBridge } from '../types'
import { useMicCheck } from './useMicCheck'

afterEach(() => {
  vi.unstubAllGlobals()
  Reflect.deleteProperty(navigator, 'mediaDevices')
})

describe('useMicCheck', () => {
  it('falls back calmly when the browser has no microphone API', async () => {
    const { result } = renderHook(() => useMicCheck())
    expect(result.current.available).toBe(false)
    await act(async () => {
      await result.current.start()
    })
    expect(result.current.state).toBe('unavailable')
    expect(result.current.message).toMatch(/not available/i)
  })

  it('reports a missing bridge without throwing', async () => {
    vi.stubGlobal('MediaRecorder', class {})
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn() },
    })
    delete (window as { simpleOS?: SimpleOSBridge }).simpleOS
    const { result } = renderHook(() => useMicCheck())
    await act(async () => {
      await result.current.start()
    })
    expect(result.current.state).toBe('unavailable')
    expect(result.current.message).toMatch(/desktop app/i)
  })

  it('transcribes a short local recording through the offline bridge', async () => {
    class FakeRecorder {
      state = 'inactive'
      mimeType = 'audio/webm'
      ondataavailable: ((event: { data: Blob }) => void) | null = null
      onstop: (() => void) | null = null
      start() {
        this.state = 'recording'
      }
      stop() {
        this.state = 'inactive'
        this.ondataavailable?.({ data: new Blob(['audio']) })
        this.onstop?.()
      }
    }
    vi.stubGlobal('MediaRecorder', FakeRecorder)
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: vi.fn() }],
        }),
      },
    })
    const transcribeAudio = vi
      .fn()
      .mockResolvedValue({ ok: true, value: { text: 'hello' } })
    window.simpleOS = { transcribeAudio } as unknown as SimpleOSBridge

    const { result } = renderHook(() => useMicCheck())
    let pending: Promise<void> | undefined
    act(() => {
      pending = result.current.start()
    })
    await waitFor(() => expect(result.current.state).toBe('listening'))
    act(() => result.current.stop())
    await act(async () => {
      await pending
    })
    expect(transcribeAudio).toHaveBeenCalledWith(expect.any(String))
    expect(result.current.state).toBe('ready')
    expect(result.current.heard).toBe('hello')
    expect(result.current.message).toContain('hello')
  })
})
