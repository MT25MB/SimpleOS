import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFontScale, FONT_SCALES } from './useFontScale'

describe('useFontScale', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.style.removeProperty('--font-scale')
  })

  it('defaults to Normal (1.0) and applies it to the root element', () => {
    const { result } = renderHook(() => useFontScale())
    expect(result.current.scale).toBe(1)
    expect(document.documentElement.style.getPropertyValue('--font-scale')).toBe('1')
  })

  it('exposes exactly Normal, Large and Extra Large', () => {
    expect(FONT_SCALES.map((option) => [option.label, option.value])).toEqual([
      ['Normal', 1],
      ['Large', 1.15],
      ['Extra Large', 1.35],
    ])
  })

  it('updates the scale and persists it', () => {
    const { result } = renderHook(() => useFontScale())
    act(() => result.current.setFontScale(1.35))
    expect(result.current.scale).toBe(1.35)
    expect(document.documentElement.style.getPropertyValue('--font-scale')).toBe('1.35')
    expect(window.localStorage.getItem('simpleos.fontScale')).toBe('1.35')
  })

  it('restores a valid stored scale but ignores invalid values', () => {
    window.localStorage.setItem('simpleos.fontScale', '1.15')
    expect(renderHook(() => useFontScale()).result.current.scale).toBe(1.15)

    window.localStorage.setItem('simpleos.fontScale', '9')
    expect(renderHook(() => useFontScale()).result.current.scale).toBe(1)
  })
})
