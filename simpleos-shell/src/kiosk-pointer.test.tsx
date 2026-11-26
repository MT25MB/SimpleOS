import { describe, it, expect } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { KioskPointer } from './components/KioskPointer'

describe('visible kiosk pointer', () => {
  it('stays hidden until the pointer moves', () => {
    render(<KioskPointer />)
    expect(screen.queryByTestId('kiosk-pointer')).toBeNull()
  })

  it('draws a pointer that follows the mouse without intercepting clicks', () => {
    render(<KioskPointer />)
    act(() => {
      fireEvent.mouseMove(window, { clientX: 320, clientY: 180 })
    })
    const pointer = screen.getByTestId('kiosk-pointer')
    expect(pointer.style.transform).toBe('translate(320px, 180px)')
    expect(pointer).toHaveAttribute('aria-hidden', 'true')
    expect(pointer.querySelector('svg')).not.toBeNull()
  })
})
