import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import type { SimpleOSBridge } from './types'

const ok = { ok: true } as const

function mockBridge(overrides: Partial<SimpleOSBridge> = {}): SimpleOSBridge {
  return {
    launchApp: vi.fn().mockResolvedValue(ok),
    loadReminders: vi.fn().mockResolvedValue({ ok: true, value: { date: '', items: [] } }),
    saveReminders: vi.fn().mockResolvedValue(ok),
    hasPin: vi.fn().mockResolvedValue({ ok: true, value: { hasPin: true } }),
    unlockWithPin: vi.fn().mockResolvedValue(ok),
    setPin: vi.fn().mockResolvedValue(ok),
    openSettings: vi.fn().mockResolvedValue(ok),
    getUpdateStatus: vi.fn().mockResolvedValue({ ok: true, value: { summary: 'Your system is up to date.' } }),
    ...overrides,
  } as SimpleOSBridge
}

describe('App integration', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('renders the six home tiles', () => {
    window.simpleOS = mockBridge()
    render(<App />)
    for (const label of [
      'Video Call Family',
      'Web & Email',
      'Photo Album',
      'Daily Reminders',
      'Ask for Help',
      'Caregiver Settings',
    ]) {
      expect(screen.getByRole('button', { name: new RegExp(label) })).toBeInTheDocument()
    }
  })

  it.each([
    ['Video Call Family', 'jitsi'],
    ['Web & Email', 'firefox'],
    ['Photo Album', 'photos'],
    ['Ask for Help', 'rustdesk'],
  ])('launches %s via the allowlisted target %s', async (label, target) => {
    const user = userEvent.setup()
    const bridge = mockBridge()
    window.simpleOS = bridge
    render(<App />)
    await user.click(screen.getByRole('button', { name: new RegExp(label) }))
    expect(bridge.launchApp).toHaveBeenCalledWith(target)
  })

  it('shows a plain-English screen-sharing banner for RustDesk', async () => {
    const user = userEvent.setup()
    window.simpleOS = mockBridge()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /Ask for Help/ }))
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Screen sharing is starting')
    })
  })

  it('does not label the screen-sharing banner as a generic success', async () => {
    const user = userEvent.setup()
    window.simpleOS = mockBridge()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /Ask for Help/ }))
    expect(screen.queryByText(/is starting\.$/)).toBeNull()
  })

  it('opens Daily Reminders as a local view', async () => {
    const user = userEvent.setup()
    const bridge = mockBridge()
    window.simpleOS = bridge
    render(<App />)
    await user.click(screen.getByRole('button', { name: /Daily Reminders/ }))
    expect(screen.getByRole('heading', { name: 'Daily Reminders' })).toBeInTheDocument()
    expect(bridge.launchApp).not.toHaveBeenCalled()
  })

  it('gates Caregiver Settings behind the PIN screen', async () => {
    const user = userEvent.setup()
    const bridge = mockBridge()
    window.simpleOS = bridge
    render(<App />)
    await user.click(screen.getByRole('button', { name: /Caregiver Settings/ }))
    expect(await screen.findByRole('heading', { name: 'Caregiver Settings' })).toBeInTheDocument()
    expect(screen.getByLabelText('PIN')).toBeInTheDocument()
  })
})
