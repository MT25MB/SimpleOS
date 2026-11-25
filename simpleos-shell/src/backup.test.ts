import { describe, it, expect } from 'vitest'
import {
  BACKUP_FILENAME,
  BACKUP_VERSION,
  MAX_BACKUP_BYTES,
  backupSummary,
  buildBackup,
  parseBackup,
  validateBackup,
  type BackupInput,
} from './backup'

const input: BackupInput = {
  seniorName: 'Mom',
  fontScale: 22 / 18,
  reminders: {
    date: '2026-11-25',
    items: [
      { id: 'r1', text: 'Take medicine', time: '09:00', done: false, createdAt: 1 },
    ],
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
  frameDelay: 5,
  rustdeskId: '1234567',
}

describe('caregiver configuration backup', () => {
  it('builds a clean backup containing only approved fields', () => {
    const backup = buildBackup(input)
    expect(Object.keys(backup).sort()).toEqual([
      'contacts',
      'fontScale',
      'frameDelay',
      'reminders',
      'rustdeskId',
      'seniorName',
      'version',
    ])
    expect(backup.version).toBe(BACKUP_VERSION)
    // Even if a caller hands us extra properties, none are copied through.
    const withSecrets = buildBackup({
      ...input,
      pin: '9999',
      hash: 'deadbeef',
    } as BackupInput & { pin: string; hash: string })
    expect(JSON.stringify(withSecrets)).not.toMatch(/"pin"|"hash"|9999|deadbeef/)
  })

  it('accepts and round-trips its own output', () => {
    const json = JSON.stringify(buildBackup(input), null, 2)
    const result = parseBackup(json)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toEqual(buildBackup(input))
    expect(BACKUP_FILENAME).toBe('simpleos-backup.json')
    expect(backupSummary(result.value)).toContain('Name: Mom')
    expect(backupSummary(result.value).join(' ')).not.toMatch(/pin/i)
  })

  it('rejects a PIN or credential field even inside a valid-looking file', () => {
    const withPin = { ...buildBackup(input), caregiverPin: { hash: 'deadbeef' } }
    const result = validateBackup(withPin)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toMatch(/PIN or password/i)
  })

  it('rejects oversized and malformed files with plain English', () => {
    const oversized = parseBackup('{}', MAX_BACKUP_BYTES + 1)
    expect(oversized.ok).toBe(false)
    if (!oversized.ok) expect(oversized.message).toMatch(/too big/i)

    const badJson = parseBackup('{ not json')
    expect(badJson.ok).toBe(false)
    if (!badJson.ok) expect(badJson.message).toMatch(/can't be read/i)

    const notBackup = parseBackup('{"hello":"world"}')
    expect(notBackup.ok).toBe(false)
    if (!notBackup.ok) expect(notBackup.message).toMatch(/settings this version|isn't a SimpleOS backup/i)
  })

  it('rejects every invalid field a hand-edited file could contain', () => {
    const cases: unknown[] = [
      { ...buildBackup(input), version: 2 },
      { ...buildBackup(input), seniorName: '' },
      { ...buildBackup(input), fontScale: 1.2 },
      { ...buildBackup(input), frameDelay: 3 },
      { ...buildBackup(input), rustdeskId: 'abc' },
      { ...buildBackup(input), reminders: { date: '', items: [] }, contacts: { contacts: [] }, unknown: true },
      {
        ...buildBackup(input),
        contacts: {
          contacts: [
            { ...input.contacts.contacts[0], roomUrl: 'https://evil.example/room' },
          ],
        },
      },
      {
        ...buildBackup(input),
        reminders: {
          date: '',
          items: [{ ...input.reminders.items[0], time: '25:00' }],
        },
      },
      {
        ...buildBackup(input),
        contacts: { contacts: Array.from({ length: 5 }, () => input.contacts.contacts[0]) },
      },
    ]
    for (const candidate of cases) {
      const result = validateBackup(candidate)
      expect(result.ok, JSON.stringify(candidate)).toBe(false)
    }
  })
})
