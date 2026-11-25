import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { buildBackup, type BackupInput } from '../backup'
import type { SimpleOSBridge } from '../types'
import { BackupPanel } from './BackupPanel'

const fixture: BackupInput = {
  seniorName: 'Mom',
  fontScale: 1,
  reminders: {
    date: '2026-11-25',
    items: [{ id: 'r1', text: 'Take medicine', time: '09:00', done: false, createdAt: 1 }],
  },
  contacts: {
    contacts: [
      {
        id: 'anna123',
        name: 'Anna',
        relationship: 'Daughter',
        avatarFile: null,
        roomUrl: 'https://meet.jit.si/anna',
      },
    ],
  },
  frameDelay: 2,
  rustdeskId: '1234567',
}

function bridge(): SimpleOSBridge {
  return {
    getSetupStatus: vi.fn().mockResolvedValue({
      ok: true,
      value: { complete: true, seniorName: 'Mom', rustdeskId: '1234567' },
    }),
    loadReminders: vi.fn().mockResolvedValue({ ok: true, value: fixture.reminders }),
    loadContacts: vi.fn().mockResolvedValue({ ok: true, value: fixture.contacts }),
  } as unknown as SimpleOSBridge
}

function renderPanel(onApply = vi.fn().mockResolvedValue(null)) {
  window.simpleOS = bridge()
  render(
    <BackupPanel seniorName="Mom" scale={1} frameDelay={0} onApply={onApply} />,
  )
  return { user: userEvent.setup(), onApply }
}

describe('BackupPanel', () => {
  it('explains why a malformed file cannot be restored', async () => {
    const { user } = renderPanel()
    const file = new File(['{ not json'], 'simpleos-backup.json', { type: 'application/json' })
    await user.upload(screen.getByLabelText('Choose backup file'), file)
    expect(await screen.findByRole('alert')).toHaveTextContent(/can't be read/i)
    expect(screen.queryByRole('button', { name: 'Apply backup' })).toBeNull()
  })

  it('previews a valid backup before applying it', async () => {
    const { user, onApply } = renderPanel()
    const json = JSON.stringify(buildBackup(fixture), null, 2)
    const file = new File([json], 'simpleos-backup.json', { type: 'application/json' })
    await user.upload(screen.getByLabelText('Choose backup file'), file)

    expect(await screen.findByRole('region', { name: 'Backup preview' })).toBeInTheDocument()
    expect(screen.getByText('Name: Mom')).toBeInTheDocument()
    expect(screen.getByText('Family cards: Anna')).toBeInTheDocument()
    expect(onApply).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Apply backup' }))
    await waitFor(() => expect(onApply).toHaveBeenCalledTimes(1))
    expect(onApply.mock.calls[0][0]).toMatchObject({
      seniorName: 'Mom',
      frameDelay: 2,
      contacts: { contacts: [expect.objectContaining({ name: 'Anna' })] },
    })
  })

  it('never asks to apply a backup with a PIN field', async () => {
    const { user } = renderPanel()
    const withPin = { ...buildBackup(fixture), pin: '9999' }
    const file = new File([JSON.stringify(withPin)], 'simpleos-backup.json', {
      type: 'application/json',
    })
    await user.upload(screen.getByLabelText('Choose backup file'), file)
    expect(await screen.findByRole('alert')).toHaveTextContent(/PIN or password/i)
    expect(screen.queryByRole('button', { name: 'Apply backup' })).toBeNull()
  })
})
