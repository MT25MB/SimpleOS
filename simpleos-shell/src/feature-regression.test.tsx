import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { ContactEditor } from './components/ContactEditor'
import { PhotoFrame } from './components/PhotoFrame'
import { buildHealthSummary } from './healthSummary'
import type { Contact, SimpleOSBridge } from './types'

const ok = { ok: true } as const
const contact: Contact = {
  id: 'anna123',
  name: 'Anna',
  relationship: 'Daughter',
  avatarFile: null,
  roomUrl: 'https://meet.jit.si/anna-family',
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
    getUpdateStatus: vi.fn().mockResolvedValue({ ok: true, value: { summary: 'Up to date.' } }),
    runAction: vi.fn().mockResolvedValue({ ok: true, value: {} }),
    getHardwareStatus: vi.fn().mockResolvedValue({
      ok: true,
      value: {
        wifi: { connected: true, ssid: 'Home Network' },
        battery: { present: false, percent: null, charging: null },
        brightnessAvailable: false,
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
    saveAvatar: vi.fn().mockResolvedValue({ ok: true, value: { fileName: 'avatar-anna123.png' } }),
    getAvatar: vi.fn().mockResolvedValue({ ok: true, value: { dataUrl: '' } }),
    callContact: vi.fn().mockResolvedValue(ok),
    getFramePhotos: vi.fn().mockResolvedValue({ ok: true, value: { photos: [] } }),
    getHealthStatus: vi.fn().mockResolvedValue({
      ok: true,
      value: {
        internet: 'Connected to the internet.',
        audio: 'Sound output is ready.',
        microphone: 'Microphone is ready.',
        disk: 'Disk space is healthy: 20 GB free',
        imageVersion: 'SimpleOS 1.0.0',
        lastUpdateCheck: 'Last checked today',
        summary: 'SimpleOS health summary',
      },
    }),
    runRecovery: vi.fn().mockResolvedValue({ ok: true, value: { summary: 'Done.' } }),
    ...overrides,
  } as SimpleOSBridge
}

describe('privacy-safe health summary', () => {
  beforeEach(() => window.localStorage.clear())

  it('contains only the six fixed plain-English lines', () => {
    const summary = buildHealthSummary({
      internet: 'Connected to the internet.',
      audio: 'Sound output is ready.',
      microphone: 'Microphone is ready.',
      disk: 'Disk space is healthy: 20 GB free',
      imageVersion: 'SimpleOS 1.0.0',
      lastUpdateCheck: 'Last checked today',
    })
    expect(summary.split('\n')).toHaveLength(7)
    expect(summary).not.toMatch(/\/home\/|\.config|caregiver-pin|PIN=|1234/i)
    expect(summary).toContain('Internet: Connected to the internet.')
    expect(summary).toContain('Updates: Last checked today')
  })
})

describe('read-aloud stopping', () => {
  beforeEach(() => window.localStorage.clear())

  it('stops immediately on Escape', async () => {
    window.localStorage.setItem('simpleos.readAloud', 'on')
    const bridge = mockBridge()
    window.simpleOS = bridge
    render(<App />)
    await waitFor(() => expect(bridge.speakLocally).toHaveBeenCalled())
    const active = await screen.findByRole('button', { name: 'Stop Reading' })
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(bridge.stopLocalSpeech).toHaveBeenCalled())
    expect(active).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Read Aloud: On' })).toBeInTheDocument()
  })
})

describe('family contacts integration', () => {
  beforeEach(() => window.localStorage.clear())

  it('opens the chosen contact room through the allowlisted bridge', async () => {
    const user = userEvent.setup()
    const bridge = mockBridge({
      loadContacts: vi.fn().mockResolvedValue({ ok: true, value: { contacts: [contact] } }),
    })
    window.simpleOS = bridge
    render(<App />)
    await user.click(screen.getByRole('button', { name: /Video Call Family/ }))
    await user.click(await screen.findByRole('button', { name: 'Call Anna now' }))
    expect(bridge.callContact).toHaveBeenCalledWith(contact.roomUrl)
  })

  it('limits the editor to four contacts and allows removal', async () => {
    const user = userEvent.setup()
    const four = Array.from({ length: 4 }, (_, i) => ({ ...contact, id: `c${i}`, name: `Person ${i}` }))
    const onSave = vi.fn().mockResolvedValue(null)
    render(<ContactEditor contacts={four} onSave={onSave} />)
    expect(screen.queryByRole('button', { name: 'Add a person' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Remove Person 0' }))
    await user.click(screen.getByRole('button', { name: 'Save family cards' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce())
    expect(onSave.mock.calls[0][0].contacts).toHaveLength(3)
  })
})

describe('photo frame dismissal', () => {
  it('closes immediately on any click', () => {
    const onDismiss = vi.fn()
    const { container } = render(<PhotoFrame photos={[]} onDismiss={onDismiss} />)
    fireEvent.click(container.querySelector('.frame') as HTMLElement)
    expect(onDismiss).toHaveBeenCalledOnce()
  })
})
