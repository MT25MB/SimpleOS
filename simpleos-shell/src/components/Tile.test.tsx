import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Tile } from './Tile'
import { TILES } from '../data/tiles'

describe('Tile', () => {
  it('renders a native button with title and subtitle', () => {
    render(<Tile tile={TILES[0]} onSelect={vi.fn()} />)
    const button = screen.getByRole('button')
    expect(button.tagName).toBe('BUTTON')
    expect(button).toHaveTextContent('Video Call Family')
    expect(button).toHaveTextContent('Talk to family and friends')
  })

  it('calls onSelect with the tile when activated', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<Tile tile={TILES[2]} onSelect={onSelect} />)
    await user.click(screen.getByRole('button'))
    expect(onSelect).toHaveBeenCalledWith(TILES[2])
  })

  it('is keyboard operable (Enter and Space)', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<Tile tile={TILES[0]} onSelect={onSelect} />)
    screen.getByRole('button').focus()
    await user.keyboard('{Enter}')
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('marks its decorative icon as hidden from assistive tech', () => {
    const { container } = render(<Tile tile={TILES[0]} onSelect={vi.fn()} />)
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })
})
