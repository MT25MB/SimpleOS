import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { VoiceControls } from './components/VoiceControls'
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
    ...overrides,
  } as SimpleOSBridge
}

describe('read aloud', () => {
  it('has a visible toggle that starts local speech and can be stopped', async () => {
    const user = userEvent.setup()
    const bridge = mockBridge()
    window.simpleOS = bridge
    window.localStorage.clear()
    render(<App />)

    const toggle = screen.getByRole('button', { name: 'Read Aloud: Off' })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await user.click(toggle)
    await waitFor(() => expect(bridge.speakLocally).toHaveBeenCalled())
    const active = await screen.findByRole('button', { name: 'Stop Reading' })
    expect(active).toHaveAttribute('aria-pressed', 'true')

    await user.click(active)
    expect(bridge.stopLocalSpeech).toHaveBeenCalled()
  })
})

describe('push-to-talk confirmation', () => {
  it('shows exactly what was heard and runs only after Confirm', async () => {
    const user = userEvent.setup()
    const onAction = vi.fn()
    const onStart = vi.fn()
    const onFinish = vi.fn()
    render(
      <VoiceControls
        readAloudEnabled={false}
        speaking={false}
        readAloudMessage={null}
        onToggleReadAloud={vi.fn()}
        onStopReading={vi.fn()}
        voiceAvailable
        voiceStatus="heard"
        transcript="open video call"
        actionLabel="Open Video Call"
        voiceMessage={null}
        onStartListening={onStart}
        onFinishListening={onFinish}
        onConfirmVoice={onAction}
        onCancelVoice={vi.fn()}
      />,
    )

    expect(screen.getByText(/I heard: “open video call” — Open Video Call/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(onAction).toHaveBeenCalledOnce()

    await user.click(screen.getByRole('button', { name: 'Hold to Speak' }))
    expect(onStart).toHaveBeenCalledOnce()
  })

  it('explains when local voice recognition is not installed', () => {
    render(
      <VoiceControls
        readAloudEnabled={false}
        speaking={false}
        readAloudMessage={null}
        onToggleReadAloud={vi.fn()}
        onStopReading={vi.fn()}
        voiceAvailable={false}
        voiceStatus="idle"
        transcript=""
        actionLabel={null}
        voiceMessage={null}
        onStartListening={vi.fn()}
        onFinishListening={vi.fn()}
        onConfirmVoice={vi.fn()}
        onCancelVoice={vi.fn()}
      />,
    )
    expect(screen.getByText(/not set up on this computer/)).toBeInTheDocument()
  })
})
