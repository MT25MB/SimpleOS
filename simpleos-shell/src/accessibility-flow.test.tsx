import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { PinScreen } from './components/PinScreen'
import { QuickCheckPanel } from './components/QuickCheckPanel'
import { RemindersPanel } from './components/RemindersPanel'
import { Tile } from './components/Tile'
import { TILES } from './data/tiles'
import type { HardwareStatus, SimpleOSBridge } from './types'

const ok = { ok: true } as const

function hardware(overrides: Partial<HardwareStatus> = {}): HardwareStatus {
  return {
    wifi: { connected: true, ssid: 'Home Network' },
    battery: { present: true, percent: 72, charging: false },
    brightnessAvailable: true,
    audioAvailable: true,
    rustdeskAvailable: true,
    ...overrides,
  }
}

function mockBridge(overrides: Partial<SimpleOSBridge> = {}): SimpleOSBridge {
  return {
    launchApp: vi.fn().mockResolvedValue(ok),
    loadReminders: vi.fn().mockResolvedValue({ ok: true, value: { date: '', items: [] } }),
    saveReminders: vi.fn().mockResolvedValue(ok),
    hasPin: vi.fn().mockResolvedValue({ ok: true, value: { hasPin: true } }),
    unlockWithPin: vi.fn().mockResolvedValue(ok),
    setPin: vi.fn().mockResolvedValue(ok),
    openSettings: vi.fn().mockResolvedValue(ok),
    getUpdateStatus: vi
      .fn()
      .mockResolvedValue({ ok: true, value: { summary: 'Your system is up to date.' } }),
    runAction: vi.fn().mockResolvedValue({ ok: true, value: {} }),
    getHardwareStatus: vi.fn().mockResolvedValue({ ok: true, value: hardware() }),
    adjustVolume: vi.fn().mockResolvedValue(ok),
    adjustBrightness: vi.fn().mockResolvedValue(ok),
    speakLocally: vi.fn().mockResolvedValue(ok),
    stopLocalSpeech: vi.fn().mockResolvedValue(ok),
    transcribeAudio: vi.fn().mockResolvedValue({ ok: true, value: { text: '' } }),
    ...overrides,
  } as SimpleOSBridge
}

describe('keyboard and screen-reader flow', () => {
  it('gives every home tile a label that includes its title and subtitle', () => {
    for (const tile of TILES) {
      render(<Tile tile={tile} onSelect={vi.fn()} />)
      const button = screen.getByRole('button', {
        name: `${tile.title}. ${tile.subtitle}`,
      })
      expect(button).toHaveAttribute('type', 'button')
    }
  })

  it('puts a skip link before the header in the app', () => {
    window.simpleOS = mockBridge()
    const { container } = render(<App />)
    const first = container.querySelector('.app > :first-child')
    expect(first?.tagName).toBe('A')
    expect(first).toHaveClass('skip-link')
    expect(first).toHaveAttribute('href', '#main-content')
    expect(container.querySelector('main')).toHaveAttribute('id', 'main-content')
  })

  it('names each reminder action with the reminder it affects', () => {
    render(
      <RemindersPanel
        store={{
          date: '2026-11-21',
          items: [
            {
              id: 'a',
              text: 'Call Anna',
              time: '17:00',
              done: false,
              createdAt: 1,
            },
          ],
        }}
        loaded
        error={null}
        notice={null}
        onAdd={vi.fn()}
        onToggle={vi.fn()}
        onRemove={vi.fn()}
        onReset={vi.fn()}
        onDismissError={vi.fn()}
        onDismissNotice={vi.fn()}
      />,
    )
    const list = screen.getByRole('list')
    expect(within(list).getByRole('button', { name: 'Mark done: Call Anna' })).toBeInTheDocument()
    expect(within(list).getByRole('button', { name: 'Remove: Call Anna' })).toBeInTheDocument()
  })

  it('links PIN fields to the live error message', () => {
    render(
      <PinScreen
        mode="unlock"
        onCancel={vi.fn()}
        onSubmit={vi.fn().mockResolvedValue('PIN_INCORRECT')}
      />,
    )
    expect(screen.getByLabelText('PIN')).toHaveAttribute('aria-describedby', 'pin-error')
    expect(screen.getByRole('alert')).toHaveAttribute('id', 'pin-error')
  })

  it('keeps focus styles for every interactive element in both surfaces', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const root = path.resolve(__dirname, '..', '..')
    const appCss = fs.readFileSync(path.resolve(root, 'simpleos-shell/src/styles.css'), 'utf8')
    const docsCss = fs.readFileSync(path.resolve(root, 'docs/styles.css'), 'utf8')
    expect(appCss).toMatch(/:focus-visible[\s\S]{0,120}outline:\s*4px solid/)
    // The site uses a global selector, which also covers <summary> and radios.
    expect(docsCss).toMatch(/^:focus-visible \{[\s\S]{0,120}outline:\s*3px solid/m)
  })
})

describe('caregiver quick check', () => {
  it('explains healthy status in plain English', () => {
    render(
      <QuickCheckPanel
        hardware={hardware()}
        updateSummary="Your system is up to date. Version 0.2.0."
        onRefresh={vi.fn()}
        onOpenWifiSettings={vi.fn()}
        onCheckUpdates={vi.fn()}
      />,
    )
    expect(screen.getByRole('heading', { name: 'Quick check' })).toBeInTheDocument()
    expect(screen.getByText(/Wi-Fi is connected to Home Network/)).toBeInTheDocument()
    expect(screen.getByText('Sound is ready.')).toBeInTheDocument()
    expect(screen.getByText(/RustDesk is installed and ready/)).toBeInTheDocument()
    expect(screen.getByText(/Your system is up to date/)).toBeInTheDocument()
  })

  it('offers a safe recovery action when Wi-Fi is down', async () => {
    const user = userEvent.setup()
    const onOpenWifiSettings = vi.fn()
    render(
      <QuickCheckPanel
        hardware={hardware({ wifi: { connected: false, ssid: null } })}
        updateSummary={null}
        onRefresh={vi.fn()}
        onOpenWifiSettings={onOpenWifiSettings}
        onCheckUpdates={vi.fn()}
      />,
    )
    expect(screen.getByText('Not connected to Wi-Fi.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Open Wi-Fi Settings' }))
    expect(onOpenWifiSettings).toHaveBeenCalledOnce()
  })

  it('offers a non-destructive re-check for sound and remote help', async () => {
    const user = userEvent.setup()
    const onRefresh = vi.fn()
    render(
      <QuickCheckPanel
        hardware={hardware({ audioAvailable: false, rustdeskAvailable: false })}
        updateSummary={null}
        onRefresh={onRefresh}
        onOpenWifiSettings={vi.fn()}
        onCheckUpdates={vi.fn()}
      />,
    )
    expect(screen.getByText(/Sound isn't ready right now/)).toBeInTheDocument()
    expect(screen.getByText(/RustDesk isn't installed yet/)).toBeInTheDocument()
    const checks = screen.getAllByRole('button', { name: 'Check again' })
    expect(checks).toHaveLength(2)
    await user.click(checks[0])
    await user.click(checks[1])
    expect(onRefresh).toHaveBeenCalledTimes(2)
  })

  it('explains a desktop with no brightness control without offering a dead button', () => {
    render(
      <QuickCheckPanel
        hardware={hardware({ brightnessAvailable: false })}
        updateSummary={null}
        onRefresh={vi.fn()}
        onOpenWifiSettings={vi.fn()}
        onCheckUpdates={vi.fn()}
      />,
    )
    expect(screen.getByText(/no brightness control/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Check again' })).toBeNull()
  })

  it('shows the quick check inside PIN-gated Caregiver Settings', async () => {
    const user = userEvent.setup()
    const bridge = mockBridge()
    window.simpleOS = bridge
    render(<App />)
    await user.click(screen.getByRole('button', { name: /Caregiver Settings/ }))
    await user.type(screen.getByLabelText('PIN'), '1234')
    await user.click(screen.getByRole('button', { name: 'Unlock Caregiver Settings' }))
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Quick check' })).toBeInTheDocument()
    })
    expect(bridge.getUpdateStatus).toHaveBeenCalled()
    expect(screen.getByText(/Wi-Fi is connected to Home Network/)).toBeInTheDocument()
    for (const name of [
      'Open Wi-Fi and network settings',
      'Open printer settings',
      'Check for system updates',
      'Open RustDesk for remote help',
      'Change your caregiver PIN',
    ]) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument()
    }
  })
})
