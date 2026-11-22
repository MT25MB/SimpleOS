import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { isAllowedVideoRoom } from '../electron/allowlists'
import { ContactEditor } from './components/ContactEditor'
import { FamilyPanel } from './components/FamilyPanel'
import { PhotoFrame } from './components/PhotoFrame'
import type { Contact } from './types'

const contact: Contact = {
  id: 'anna123',
  name: 'Anna',
  relationship: 'Daughter',
  avatarFile: null,
  roomUrl: 'https://meet.jit.si/anna-family',
}

describe('video room validation', () => {
  it('allows only https on approved hosts', () => {
    expect(isAllowedVideoRoom('https://meet.jit.si/anna')).toBe(true)
    expect(isAllowedVideoRoom('https://family.8x8.vc/room')).toBe(true)
    expect(isAllowedVideoRoom('http://meet.jit.si/anna')).toBe(false)
    expect(isAllowedVideoRoom('https://evil.example/meet.jit.si')).toBe(false)
    expect(isAllowedVideoRoom('https://meet.jit.si@evil.example/')).toBe(false)
    expect(isAllowedVideoRoom('javascript:alert(1)')).toBe(false)
  })
})

describe('family call cards', () => {
  it('calls only the chosen contact through the allowlisted bridge', async () => {
    const user = userEvent.setup()
    const onCall = vi.fn()
    window.simpleOS = {
      getAvatar: vi.fn().mockResolvedValue({ ok: true, value: { dataUrl: '' } }),
    } as never
    render(<FamilyPanel contacts={[contact]} onCall={onCall} onFallback={vi.fn()} />)
    expect(screen.getByText('Anna')).toBeInTheDocument()
    expect(screen.getByText('Daughter')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Call Anna now' }))
    expect(onCall).toHaveBeenCalledWith(contact)
  })

  it('offers a fallback when no contacts exist', () => {
    window.simpleOS = { getAvatar: vi.fn() } as never
    const onFallback = vi.fn()
    render(<FamilyPanel contacts={[]} onCall={vi.fn()} onFallback={onFallback} />)
    expect(screen.getByText('No family cards have been set up yet.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open a video call' })).toBeInTheDocument()
  })
})

describe('caregiver contact editor', () => {
  it('rejects an unapproved video link before saving', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<ContactEditor contacts={[]} onSave={onSave} />)
    await user.click(screen.getByRole('button', { name: 'Add a person' }))
    await user.type(screen.getByLabelText('Name'), 'Anna')
    await user.type(screen.getByLabelText('Video room link'), 'https://evil.example/anna')
    await user.click(screen.getByRole('button', { name: 'Save family cards' }))
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('approved video site')
  })

  it('saves a valid contact', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue(null)
    render(<ContactEditor contacts={[]} onSave={onSave} />)
    await user.click(screen.getByRole('button', { name: 'Add a person' }))
    await user.type(screen.getByLabelText('Name'), 'Anna')
    await user.type(screen.getByLabelText('Video room link'), contact.roomUrl)
    await user.click(screen.getByRole('button', { name: 'Save family cards' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce())
    expect(onSave.mock.calls[0][0].contacts[0].roomUrl).toBe(contact.roomUrl)
  })
})

describe('photo frame', () => {
  it('shows a large clock and dismisses on a key press', async () => {
    const user = userEvent.setup()
    const onDismiss = vi.fn()
    render(<PhotoFrame photos={[]} onDismiss={onDismiss} />)
    expect(screen.getByRole('button', { name: 'Back to SimpleOS' })).toBeInTheDocument()
    expect(document.querySelector('.frame__time')).toBeTruthy()
    await user.keyboard('{Escape}')
    expect(onDismiss).toHaveBeenCalled()
  })
})
