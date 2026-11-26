import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
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
    getSetupStatus: vi.fn().mockResolvedValue({ ok: true, value: { complete: true, seniorName: null } }),
    completeSetup: vi.fn().mockResolvedValue(ok),
    openSettings: vi.fn().mockResolvedValue(ok),
    getUpdateStatus: vi.fn().mockResolvedValue({ ok: true, value: { summary: 'Your system is up to date.' } }),
    runAction: vi.fn().mockResolvedValue({ ok: true, value: {} }),
    getHardwareStatus: vi.fn().mockResolvedValue({
      ok: true,
      value: {
        wifi: { connected: true, ssid: 'Home Network' },
        battery: { present: true, percent: 80, charging: true },
        brightnessAvailable: true,
        audioAvailable: true,
        rustdeskAvailable: true,
      },
    }),
    adjustVolume: vi.fn().mockResolvedValue(ok),
    adjustBrightness: vi.fn().mockResolvedValue(ok),
    speakLocally: vi.fn().mockResolvedValue(ok),
    stopLocalSpeech: vi.fn().mockResolvedValue(ok),
    transcribeAudio: vi.fn().mockResolvedValue({ ok: true, value: { text: '' } }),
    loadContacts: vi.fn().mockResolvedValue({ ok: true, value: { contacts: [] } }),
    saveContacts: vi.fn().mockResolvedValue(ok),
    saveAvatar: vi.fn().mockResolvedValue({ ok: true, value: { fileName: 'avatar-a.png' } }),
    getAvatar: vi.fn().mockResolvedValue({ ok: true, value: { dataUrl: '' } }),
    callContact: vi.fn().mockResolvedValue(ok),
    getFramePhotos: vi.fn().mockResolvedValue({ ok: true, value: { photos: [] } }),
    openPhoto: vi.fn().mockResolvedValue(ok),
    getHealthStatus: vi.fn().mockResolvedValue({
      ok: true,
      value: {
        internet: 'Connected to the internet.',
        audio: 'Sound output is ready.',
        microphone: 'Microphone is ready.',
        disk: 'Disk space is healthy: 20 GB free',
        imageVersion: 'SimpleOS 0.3.0',
        lastUpdateCheck: 'Last checked today',
        summary: 'SimpleOS health summary\nInternet: Connected to the internet.',
      },
    }),
    runRecovery: vi.fn().mockResolvedValue({ ok: true, value: { summary: 'Done.' } }),
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
    ['Web & Email', 'firefox'],
    ['Ask for Help', 'rustdesk'],
  ])('launches %s via the allowlisted target %s', async (label, target) => {
    const user = userEvent.setup()
    const bridge = mockBridge()
    window.simpleOS = bridge
    render(<App />)
    await user.click(screen.getByRole('button', { name: new RegExp(label) }))
    expect(bridge.launchApp).toHaveBeenCalledWith(target)
  })

  it('explains when remote help is not installed', async () => {
    const user = userEvent.setup()
    const bridge = mockBridge({
      getHardwareStatus: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          wifi: { connected: true, ssid: 'Home Network' },
          battery: { present: false, percent: null, charging: null },
          brightnessAvailable: false,
          audioAvailable: true,
          rustdeskAvailable: false,
        },
      }),
    })
    window.simpleOS = bridge
    render(<App />)
    await user.click(screen.getByRole('button', { name: /Ask for Help/ }))
    expect(await screen.findByText(/Remote help isn't installed/)).toBeInTheDocument()
    expect(bridge.launchApp).not.toHaveBeenCalled()
  })

  it('shows a calm message if a launch fails unexpectedly', async () => {
    const user = userEvent.setup()
    const bridge = mockBridge({
      launchApp: vi.fn().mockRejectedValue(new Error('boom')),
    })
    window.simpleOS = bridge
    render(<App />)
    await user.click(screen.getByRole('button', { name: /Web & Email/ }))
    expect(await screen.findByRole('status')).toHaveTextContent(/something went wrong/i)
  })

  it('opens the Photo Album as an in-app view for downloaded pictures', async () => {
    const user = userEvent.setup()
    const bridge = mockBridge({
      getFramePhotos: vi
        .fn()
        .mockResolvedValue({ ok: true, value: { photos: ['data:image/png;base64,AAAA'] } }),
    })
    window.simpleOS = bridge
    render(<App />)
    await user.click(screen.getByRole('button', { name: /Photo Album/ }))
    expect(await screen.findByRole('heading', { name: 'Photo Album' })).toBeInTheDocument()
    expect(bridge.launchApp).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Open photo 1' }))
    expect(bridge.openPhoto).toHaveBeenCalledWith(0)
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

  it('shows the connected network name in the header', async () => {
    window.simpleOS = mockBridge()
    render(<App />)
    expect(await screen.findByText(/Connected to Home Network/)).toBeInTheDocument()
  })

  it('offers one-click Wi-Fi settings when there is no connection', async () => {
    const user = userEvent.setup()
    const bridge = mockBridge({
      getHardwareStatus: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          wifi: { connected: false, ssid: null },
          battery: { present: false, percent: null, charging: null },
          brightnessAvailable: false,
          audioAvailable: false,
          rustdeskAvailable: false,
        },
      }),
    })
    window.simpleOS = bridge
    render(<App />)
    expect(await screen.findByText('Not connected to a network.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Open Wi-Fi Settings' }))
    expect(bridge.runAction).toHaveBeenCalledWith('networkSettings')
    expect(screen.queryByText(/^Battery/)).toBeNull()
    expect(screen.queryByRole('group', { name: 'Screen brightness' })).toBeNull()
  })

  it('shows a wired connection as connected instead of missing Wi-Fi', async () => {
    window.simpleOS = mockBridge({
      getHardwareStatus: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          wifi: { connected: true, ssid: 'ens160', kind: 'ethernet' },
          battery: { present: false, percent: null, charging: null },
          brightnessAvailable: false,
          audioAvailable: true,
          rustdeskAvailable: true,
        },
      }),
    })
    render(<App />)
    expect(await screen.findByText(/Connected by cable to ens160/)).toBeInTheDocument()
    expect(screen.queryByText(/Not connected to a network/)).toBeNull()
  })

  it('shows laptop battery state and charging in plain English', async () => {
    window.simpleOS = mockBridge()
    render(<App />)
    expect(await screen.findByText('Battery 80% · Charging')).toBeInTheDocument()
  })

  it('sends only fixed keys for volume and brightness controls', async () => {
    const user = userEvent.setup()
    const bridge = mockBridge()
    window.simpleOS = bridge
    render(<App />)
    const screenGroup = await screen.findByRole('group', { name: 'Screen brightness' })
    const sound = screen.getByRole('group', { name: 'Sound' })
    await user.click(within(sound).getByRole('button', { name: 'Softer' }))
    await user.click(within(sound).getByRole('button', { name: 'Louder' }))
    await user.click(within(sound).getByRole('button', { name: 'Mute' }))
    await user.click(within(screenGroup).getByRole('button', { name: 'Darker' }))
    await user.click(within(screenGroup).getByRole('button', { name: 'Lighter' }))
    expect(bridge.adjustVolume).toHaveBeenNthCalledWith(1, 'volumeDown')
    expect(bridge.adjustVolume).toHaveBeenNthCalledWith(2, 'volumeUp')
    expect(bridge.adjustVolume).toHaveBeenNthCalledWith(3, 'volumeMute')
    expect(bridge.adjustBrightness).toHaveBeenNthCalledWith(1, 'brightnessDown')
    expect(bridge.adjustBrightness).toHaveBeenNthCalledWith(2, 'brightnessUp')
  })

  it('opens the setup wizard on a fresh computer instead of the home tiles', async () => {
    const bridge = mockBridge({
      getSetupStatus: vi
        .fn()
        .mockResolvedValue({ ok: true, value: { complete: false, seniorName: null } }),
    })
    window.simpleOS = bridge
    render(<App />)
    expect(await screen.findByText('Step 1 of 5')).toBeInTheDocument()
    expect(bridge.getSetupStatus).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: /Video Call Family/ })).toBeNull()
  })

  it('finishes first-run setup, persists the marker and greets the senior', async () => {
    const user = userEvent.setup()
    const bridge = mockBridge({
      getSetupStatus: vi
        .fn()
        .mockResolvedValue({ ok: true, value: { complete: false, seniorName: null } }),
    })
    window.simpleOS = bridge
    render(<App />)
    await screen.findByText('Step 1 of 5')

    await user.type(screen.getByLabelText('First name'), 'Mom')
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.type(screen.getByLabelText('New PIN (4 to 6 numbers)'), '1234')
    await user.type(screen.getByLabelText('Enter it again'), '1234')
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.click(screen.getByRole('button', { name: 'Finish & Switch to Senior Mode' }))

    await waitFor(() => expect(bridge.completeSetup).toHaveBeenCalledWith('Mom', ''))
    expect(await screen.findByText(/Good (morning|afternoon|evening), Mom/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Video Call Family/ })).toBeInTheDocument()
  })

  it('has one check button and a real install action for updates', async () => {
    const user = userEvent.setup()
    const bridge = mockBridge()
    window.simpleOS = bridge
    render(<App />)
    await user.click(screen.getByRole('button', { name: /Caregiver Settings/ }))
    await user.type(screen.getByLabelText('PIN'), '1234')
    await user.click(screen.getByRole('button', { name: /Unlock/ }))

    expect(screen.getAllByRole('button', { name: /Check for updates/ })).toHaveLength(1)
    expect(screen.queryByRole('button', { name: 'Check for OS Updates' })).toBeNull()
    await user.click(screen.getByRole('button', { name: /Install system update now/ }))
    expect(bridge.runAction).toHaveBeenCalledWith('triggerUpdate')
  })

  it('can re-run the wizard from Caregiver Settings', async () => {
    const user = userEvent.setup()
    window.simpleOS = mockBridge()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /Caregiver Settings/ }))
    await user.type(screen.getByLabelText('PIN'), '1234')
    await user.click(screen.getByRole('button', { name: /Unlock/ }))
    await user.click(await screen.findByRole('button', { name: /Run Setup Again/ }))
    expect(screen.getByText('Step 1 of 5')).toBeInTheDocument()
  })
})
