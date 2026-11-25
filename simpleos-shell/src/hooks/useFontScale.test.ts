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

  it('exposes exactly 18px, 22px and 26px options', () => {
    expect(FONT_SCALES.map((option) => [option.label, option.pixels])).toEqual([
      ['Normal', 18],
      ['Large', 22],
      ['Extra Large', 26],
    ])
    expect(FONT_SCALES.map((option) => 18 * option.value)).toEqual([18, 22, 26])
  })

  it('updates the scale and persists it', () => {
    const { result } = renderHook(() => useFontScale())
    act(() => result.current.setFontScale(26 / 18))
    expect(result.current.scale).toBe(26 / 18)
    expect(document.documentElement.style.getPropertyValue('--font-scale')).toBe(String(26 / 18))
    expect(window.localStorage.getItem('simpleos.fontScale')).toBe(String(26 / 18))
  })

  it('restores a valid stored scale but ignores invalid values', () => {
    window.localStorage.setItem('simpleos.fontScale', String(22 / 18))
    expect(renderHook(() => useFontScale()).result.current.scale).toBe(22 / 18)

    window.localStorage.setItem('simpleos.fontScale', '9')
    expect(renderHook(() => useFontScale()).result.current.scale).toBe(1)
  })
})
