import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor as rtlWaitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PinScreen } from './PinScreen'
import type { ErrorCode } from '../types'

const waitForRtl = rtlWaitFor

describe('PinScreen', () => {
  it('shows the PIN field and never stores it in localStorage', async () => {
    const user = userEvent.setup()
    render(<PinScreen mode="unlock" onCancel={vi.fn()} onSubmit={vi.fn().mockResolvedValue(null)} />)
    const input = screen.getByLabelText('PIN')
    await user.type(input, '1234')
    await user.click(screen.getByRole('button', { name: 'Unlock' }))
    expect(window.localStorage.getItem('1234')).toBeNull()
    expect(window.localStorage.length).toBe(0)
    expect(JSON.stringify({ ...window.localStorage })).not.toContain('1234')
  })

  it('shows a plain-English error when verification fails', async () => {
    const user = userEvent.setup()
    render(
      <PinScreen
        mode="unlock"
        onCancel={vi.fn()}
        onSubmit={vi.fn().mockResolvedValue('PIN_INCORRECT' as ErrorCode)}
      />,
    )
    await user.type(screen.getByLabelText('PIN'), '9999')
    await user.click(screen.getByRole('button', { name: 'Unlock' }))
    await waitForRtl(() => {
      expect(screen.getByRole('alert')).toHaveTextContent("That PIN isn't right")
    })
  })

  it('requires both new PIN entries to match', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<PinScreen mode="create" onCancel={vi.fn()} onSubmit={onSubmit} />)
    await user.type(screen.getByLabelText('New PIN'), '1234')
    await user.type(screen.getByLabelText('New PIN again'), '5678')
    await user.click(screen.getByRole('button', { name: 'Save PIN' }))
    expect(onSubmit).not.toHaveBeenCalled()
    await waitForRtl(() => {
      expect(screen.getByRole('alert')).toHaveTextContent("don't match")
    })
  })

  it('clears typed PIN state after a successful submit', async () => {
    const user = userEvent.setup()
    render(<PinScreen mode="unlock" onCancel={vi.fn()} onSubmit={vi.fn().mockResolvedValue(null)} />)
    const input = screen.getByLabelText('PIN') as HTMLInputElement
    await user.type(input, '1234')
    await user.click(screen.getByRole('button', { name: 'Unlock' }))
    await waitForRtl(() => expect(input.value).toBe(''))
  })
})
