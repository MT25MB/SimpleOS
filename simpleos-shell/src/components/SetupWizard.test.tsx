import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { SimpleOSBridge } from '../types'
import { SetupWizard, type SetupWizardResult } from './SetupWizard'

const ok = { ok: true } as const

function mockBridge(overrides: Partial<SimpleOSBridge> = {}): SimpleOSBridge {
  return {
    hasPin: vi.fn().mockResolvedValue({ ok: true, value: { hasPin: false } }),
    setPin: vi.fn().mockResolvedValue(ok),
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
    speakLocally: vi.fn().mockResolvedValue(ok),
    runAction: vi.fn().mockResolvedValue({ ok: true, value: {} }),
    launchApp: vi.fn().mockResolvedValue(ok),
    transcribeAudio: vi.fn().mockResolvedValue({ ok: true, value: { text: '' } }),
    ...overrides,
  } as unknown as SimpleOSBridge
}

function setup(overrides: { onFinish?: (result: SetupWizardResult) => Promise<void> } = {}) {
  const onScaleChange = vi.fn()
  const onFinish: (result: SetupWizardResult) => Promise<void> =
    overrides.onFinish ?? vi.fn().mockResolvedValue(undefined)
  const bridge = mockBridge()
  window.simpleOS = bridge
  render(<SetupWizard scale={1} onScaleChange={onScaleChange} onFinish={onFinish} />)
  return { user: userEvent.setup(), onScaleChange, onFinish, bridge }
}

async function reachStepTwo(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('First name'), 'Mom')
  await user.click(screen.getByRole('button', { name: 'Next' }))
}

async function reachStepThree(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('New PIN (4 to 6 numbers)'), '1234')
  await user.type(screen.getByLabelText('Enter it again'), '1234')
  await user.click(screen.getByRole('button', { name: 'Next' }))
}

describe('SetupWizard', () => {
  it('opens on step one and blocks progress until a name is entered', async () => {
    const { user } = setup()
    expect(screen.getByText('Step 1 of 5')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'A warm name' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByRole('alert')).toHaveTextContent("That didn't work")
    expect(screen.getByText('Step 1 of 5')).toBeInTheDocument()

    await reachStepTwo(user)
    expect(screen.getByText('Step 2 of 5')).toBeInTheDocument()
  })

  it('reports text size choices as 18, 22 and 26 pixel scales', async () => {
    const { user, onScaleChange } = setup()
    await user.click(screen.getByLabelText('Large'))
    expect(onScaleChange).toHaveBeenCalledWith(22 / 18)
    await user.click(screen.getByLabelText('Extra Large'))
    expect(onScaleChange).toHaveBeenCalledWith(26 / 18)
  })

  it('requires matching four-to-six digit PINs before continuing', async () => {
    const { user } = setup()
    await reachStepTwo(user)

    await user.type(screen.getByLabelText('New PIN (4 to 6 numbers)'), '123')
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByRole('alert')).toHaveTextContent('at least 4 numbers')

    await user.type(screen.getByLabelText('New PIN (4 to 6 numbers)'), '4')
    await user.type(screen.getByLabelText('Enter it again'), '4321')
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByRole('alert')).toHaveTextContent("Those two PINs don't match")

    await user.clear(screen.getByLabelText('Enter it again'))
    await user.type(screen.getByLabelText('Enter it again'), '1234')
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('Step 3 of 5')).toBeInTheDocument()
  })

  it('offers local Wi-Fi, sound and microphone checks on step three', async () => {
    const { user, bridge } = setup()
    await reachStepTwo(user)
    await reachStepThree(user)

    expect(await screen.findByText('Connected to Home Network.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Open Wi-Fi settings' }))
    expect(bridge.runAction).toHaveBeenCalledWith('networkSettings')

    await user.click(screen.getByRole('button', { name: 'Play Test Chime' }))
    expect(bridge.speakLocally).toHaveBeenCalledWith(expect.stringContaining('sound test'))

    await user.click(screen.getByRole('button', { name: 'Check microphone' }))
    expect(await screen.findByText(/microphone check is not available/i)).toBeInTheDocument()
  })

  it('persists family cards, reminders and the RustDesk ID on finish', async () => {
    const onFinish = vi.fn().mockResolvedValue(undefined)
    const { user, bridge } = setup({ onFinish })
    await reachStepTwo(user)
    await reachStepThree(user)
    await user.click(screen.getByRole('button', { name: 'Next' }))

    await user.type(screen.getByLabelText('Name'), 'Anna')
    await user.type(screen.getByLabelText('Video room link'), 'https://meet.jit.si/anna')
    await user.click(screen.getByRole('button', { name: 'Add person' }))
    expect(screen.getByText('Anna · https://meet.jit.si/anna')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Reminder'), 'Take medicine')
    await user.click(screen.getByRole('button', { name: 'Add reminder' }))
    expect(screen.getByText('09:00 · Take medicine')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('Step 5 of 5')).toBeInTheDocument()
    await user.type(screen.getByLabelText('RustDesk ID (optional)'), '1234567')
    expect(screen.getByText('Remote help ID: 1234567')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Finish & Switch to Senior Mode' }))
    await waitFor(() => expect(bridge.setPin).toHaveBeenCalledWith('', '1234'))
    await waitFor(() => expect(onFinish).toHaveBeenCalledTimes(1))
    expect(onFinish).toHaveBeenCalledWith({
      seniorName: 'Mom',
      rustdeskId: '1234567',
      contacts: [expect.objectContaining({ name: 'Anna', roomUrl: 'https://meet.jit.si/anna' })],
      reminders: [expect.objectContaining({ text: 'Take medicine', time: '09:00' })],
    })
  })

  it('keeps an existing PIN when the wizard is re-run', async () => {
    const bridge = mockBridge({
      hasPin: vi.fn().mockResolvedValue({ ok: true, value: { hasPin: true } }),
    })
    window.simpleOS = bridge
    const user = userEvent.setup()
    render(
      <SetupWizard
        scale={1}
        onScaleChange={vi.fn()}
        onFinish={vi.fn().mockResolvedValue(undefined)}
        onCancel={vi.fn()}
      />,
    )
    await reachStepTwo(user)
    await reachStepThree(user)
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.click(screen.getByRole('button', { name: 'Finish & Switch to Senior Mode' }))
    await waitFor(() => expect(bridge.hasPin).toHaveBeenCalled())
    expect(bridge.setPin).not.toHaveBeenCalled()
  })
})
