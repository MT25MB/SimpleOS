/*
 * Caregiver configuration backup. Pure, browser-safe code: it never sees a PIN
 * file and deliberately refuses any document that contains credential-shaped
 * keys. Everything here is unit testable without Electron or a browser.
 */
import { isAllowedVideoRoom } from '../electron/allowlists'
import { FONT_SCALES } from './hooks/useFontScale'
import type { ContactsFile, FrameDelay, RemindersFile } from './types'

export const BACKUP_VERSION = 1 as const
export const BACKUP_FILENAME = 'simpleos-backup.json'
export const MAX_BACKUP_BYTES = 1024 * 1024
const FRAME_DELAYS: readonly FrameDelay[] = [0, 2, 5, 10, 15]
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/
const ID_PATTERN = /^[A-Za-z0-9_-]{1,48}$/
const FORBIDDEN_KEY = /^(pin|pinhash|hashedpin|caregiverpin|salt|hash|password|secret)$/i

export interface BackupFile {
  version: typeof BACKUP_VERSION
  seniorName: string
  fontScale: number
  reminders: RemindersFile
  contacts: ContactsFile
  frameDelay: FrameDelay
  rustdeskId: string | null
}

export interface BackupInput {
  seniorName: string
  fontScale: number
  reminders: RemindersFile
  contacts: ContactsFile
  frameDelay: FrameDelay
  rustdeskId: string | null
}

export type BackupValidation =
  | { ok: true; value: BackupFile }
  | { ok: false; message: string }

const reject = (message: string): BackupValidation => ({ ok: false, message })

/** Pick only the approved fields. Extra properties can never leak into a file. */
export function buildBackup(input: BackupInput): BackupFile {
  return {
    version: BACKUP_VERSION,
    seniorName: input.seniorName.trim(),
    fontScale: input.fontScale,
    reminders: {
      date: input.reminders.date,
      items: input.reminders.items.map((item) => ({
        id: item.id,
        text: item.text,
        time: item.time,
        done: item.done,
        createdAt: item.createdAt,
      })),
    },
    contacts: {
      contacts: input.contacts.contacts.map((contact) => ({
        id: contact.id,
        name: contact.name,
        relationship: contact.relationship,
        avatarFile: contact.avatarFile,
        roomUrl: contact.roomUrl,
      })),
    },
    frameDelay: input.frameDelay,
    rustdeskId: input.rustdeskId,
  }
}

/** Credentials must never be accepted, even in an otherwise valid-looking file. */
function hasCredentialKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasCredentialKey)
  if (!value || typeof value !== 'object') return false
  return Object.entries(value as Record<string, unknown>).some(
    ([key, nested]) => FORBIDDEN_KEY.test(key) || hasCredentialKey(nested),
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

/** Same short, printable-name rule as the wizard, without Node imports. */
function isValidName(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const name = value.trim()
  return name.length > 0 && name.length <= 40 && /^[^\u0000-\u001f\u007f<>]+$/.test(name)
}

function validateReminders(value: unknown): value is RemindersFile {
  if (!isRecord(value) || typeof value.date !== 'string' || !Array.isArray(value.items)) return false
  if (value.items.length > 100) return false
  return value.items.every((item) => {
    if (!isRecord(item)) return false
    return (
      typeof item.id === 'string' &&
      item.id.length > 0 &&
      item.id.length <= 64 &&
      typeof item.text === 'string' &&
      item.text.trim().length > 0 &&
      item.text.length <= 200 &&
      typeof item.time === 'string' &&
      (item.time === '' || TIME_PATTERN.test(item.time)) &&
      typeof item.done === 'boolean' &&
      typeof item.createdAt === 'number' &&
      Number.isFinite(item.createdAt)
    )
  })
}

function validateContacts(value: unknown): value is ContactsFile {
  if (!isRecord(value) || !Array.isArray(value.contacts) || value.contacts.length > 4) return false
  return value.contacts.every((contact) => {
    if (!isRecord(contact)) return false
    return (
      typeof contact.id === 'string' &&
      ID_PATTERN.test(contact.id) &&
      typeof contact.name === 'string' &&
      contact.name.trim().length > 0 &&
      contact.name.length <= 60 &&
      typeof contact.relationship === 'string' &&
      contact.relationship.length <= 40 &&
      (contact.avatarFile === null ||
        (typeof contact.avatarFile === 'string' && ID_PATTERN.test(contact.avatarFile))) &&
      isAllowedVideoRoom(contact.roomUrl)
    )
  })
}

/** Strict schema: reject anything we did not write ourselves. */
export function validateBackup(value: unknown): BackupValidation {
  if (hasCredentialKey(value)) {
    return reject('This file contains a PIN or password field. It was not imported.')
  }
  if (!isRecord(value)) return reject("That isn't a SimpleOS backup. Choose simpleos-backup.json.")
  const allowed = new Set([
    'version',
    'seniorName',
    'fontScale',
    'reminders',
    'contacts',
    'frameDelay',
    'rustdeskId',
  ])
  if (Object.keys(value).some((key) => !allowed.has(key))) {
    return reject("That file has settings this version doesn't understand. Ask for a fresh backup.")
  }
  if (value.version !== BACKUP_VERSION) {
    return reject("This backup came from a different SimpleOS version. Ask for a fresh copy.")
  }
  if (!isValidName(value.seniorName)) {
    return reject("The senior's name in this backup isn't right.")
  }
  if (!FONT_SCALES.some((option) => option.value === value.fontScale)) {
    return reject('The text size in this backup is not recognised.')
  }
  if (!FRAME_DELAYS.includes(value.frameDelay as FrameDelay)) {
    return reject('The photo frame setting in this backup is not recognised.')
  }
  if (value.rustdeskId !== null && value.rustdeskId !== undefined) {
    if (
      typeof value.rustdeskId !== 'string' ||
      value.rustdeskId.length > 24 ||
      !/^\d+$/.test(value.rustdeskId)
    ) {
      return reject('The remote help ID in this backup is not recognised.')
    }
  }
  if (!validateReminders(value.reminders)) return reject('The reminders in this backup are not valid.')
  if (!validateContacts(value.contacts)) return reject('The family cards in this backup are not valid.')

  return {
    ok: true,
    value: {
      version: BACKUP_VERSION,
      seniorName: value.seniorName.trim(),
      fontScale: value.fontScale as number,
      reminders: value.reminders,
      contacts: value.contacts,
      frameDelay: value.frameDelay as FrameDelay,
      rustdeskId: value.rustdeskId ?? null,
    },
  }
}

/** Parse and validate a chosen file, with a hard size cap before JSON parsing. */
export function parseBackup(text: string, byteLength = new TextEncoder().encode(text).length): BackupValidation {
  if (byteLength > MAX_BACKUP_BYTES) {
    return reject('That file is too big to be a SimpleOS backup. Choose a smaller one.')
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return reject("That file can't be read as a SimpleOS backup. Choose simpleos-backup.json.")
  }
  return validateBackup(parsed)
}

/** Short, plain-language preview shown before anything is applied. */
export function backupSummary(backup: BackupFile): string[] {
  return [
    `Name: ${backup.seniorName}`,
    `Text size: ${FONT_SCALES.find((option) => option.value === backup.fontScale)?.label ?? 'Normal'}`,
    `Reminders: ${backup.reminders.items.length}`,
    `Family cards: ${backup.contacts.contacts.map((contact) => contact.name).join(', ') || 'none'}`,
    `Photo frame: ${backup.frameDelay === 0 ? 'Off' : `${backup.frameDelay} minutes`}`,
  ]
}
