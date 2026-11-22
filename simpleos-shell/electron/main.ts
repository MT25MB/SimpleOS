/*
 * Electron main process for the SimpleOS launcher (TypeScript source).
 *
 * Security boundaries:
 *   - contextIsolation: true, nodeIntegration: false, sandbox: true
 *   - the renderer can only call the allowlisted IPC channels below
 *   - flatpak/system tools are spawned with FIXED values from allowlists;
 *     renderer input is only ever used as a lookup key
 *   - every handler returns { ok, code? } so raw errors and terminal output
 *     never reach the user interface
 *
 * Wayland is the default session on SimpleOS. Ozone auto-detection selects the
 * native Wayland backend when a compositor is present. Set
 * SIMPLEOS_OZONE_PLATFORM=x11 only when debugging on an X11-only host.
 *
 * This file is compiled to dist-electron/main.js by `npm run compile:electron`.
 */
import { app, BrowserWindow, ipcMain, nativeImage, type IpcMainInvokeEvent } from 'electron'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'
import crypto from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { spawn, execFile } from 'node:child_process'
import {
  ALLOWED_APPS,
  ALLOWED_SETTINGS,
  HARDWARE_ACTIONS,
  HARDWARE_STATUS,
  HEALTH_COMMANDS,
  SAFE_ACTIONS,
  VOICE_COMMANDS,
  isAllowedVideoRoom,
  type ApprovedCommand,
} from './allowlists'
import { createPinThrottle } from './pin-throttle'
import {
  HASH_HEX_LENGTH,
  PIN_MAX_LENGTH,
  PIN_MIN_LENGTH,
  SALT_HEX_LENGTH,
  hashPin,
  pinsMatch,
} from './pin-crypto'
import type {
  BatteryStatus,
  BrightnessAction,
  CaregiverAction,
  Contact,
  ContactsFile,
  ErrorCode,
  HealthStatus,
  HardwareStatus,
  RecoveryAction,
  Reminder,
  RemindersFile,
  Result,
  ValueResult,
  VolumeAction,
  WifiStatus,
} from '../src/types'

const devUrl = process.env.VITE_DEV_SERVER_URL

// Wayland/Ozone flags must be set before app.ready(). "auto" makes Electron
// pick the native Wayland backend whenever a Wayland session is detected.
app.commandLine.appendSwitch('ozone-platform-hint', 'auto')
app.commandLine.appendSwitch(
  'enable-features',
  'UseOzonePlatform,WaylandWindowDecorations',
)

// Escape hatch for debugging on a machine without Wayland.
const forcedOzonePlatform = process.env.SIMPLEOS_OZONE_PLATFORM
if (forcedOzonePlatform) {
  app.commandLine.appendSwitch('ozone-platform', forcedOzonePlatform)
}

// --------------------------------------------------------------- shared helpers

const OK: { ok: true } = { ok: true }
// The failure shape is shared by Result and ValueResult<T>.
const fail = (code: ErrorCode): { ok: false; code: ErrorCode } => ({ ok: false, code })

// The one window we ever create. IPC calls from any other sender (an injected
// frame, a pop-up, a preload in another webContents) are rejected.
let launcherWindow: BrowserWindow | null = null

/** The single local file we are allowed to display. Never any other file. */
const appFileUrl = pathToFileURL(path.join(__dirname, '..', 'dist', 'index.html')).href

/** Only our own bundled file or, in development, the Vite dev server. */
function isAllowedAppUrl(raw: string): boolean {
  if (raw === 'about:blank') return true
  if (raw === appFileUrl) return true
  if (!devUrl) return false
  try {
    return new URL(raw).href === new URL(devUrl).href
  } catch {
    // Malformed URLs are never trusted.
  }
  return false
}

/** Defence in depth: every handler checks that the call came from our window. */
function isTrustedSender(event: IpcMainInvokeEvent): boolean {
  const window = launcherWindow
  if (!window || window.isDestroyed()) return false
  if (event.sender !== window.webContents) return false
  if (event.senderFrame !== window.webContents.mainFrame) return false
  return isAllowedAppUrl(event.senderFrame?.url ?? '')
}

// SimpleOS keeps its small state files in ~/.config/simpleos on Linux, while
// honouring XDG_CONFIG_HOME when a distribution sets it.
const simpleosConfigDir = (): string =>
  path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'simpleos')

const remindersPath = (): string => path.join(simpleosConfigDir(), 'reminders.json')
const pinPath = (): string => path.join(simpleosConfigDir(), 'caregiver-pin.json')

const MAX_REMINDERS = 100
const MAX_REMINDER_TEXT = 200
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

/** Accept only data we can render safely and predictably. */
function isReminder(value: unknown): value is Reminder {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return (
    typeof item.id === 'string' &&
    item.id.length > 0 &&
    item.id.length <= 64 &&
    typeof item.text === 'string' &&
    item.text.trim().length > 0 &&
    item.text.length <= MAX_REMINDER_TEXT &&
    typeof item.time === 'string' &&
    (item.time === '' || TIME_PATTERN.test(item.time)) &&
    typeof item.done === 'boolean' &&
    typeof item.createdAt === 'number' &&
    Number.isFinite(item.createdAt)
  )
}

function isRemindersFile(value: unknown): value is RemindersFile {
  if (!value || typeof value !== 'object') return false
  const file = value as Partial<RemindersFile>
  return (
    typeof file.date === 'string' &&
    Array.isArray(file.items) &&
    file.items.length <= MAX_REMINDERS &&
    file.items.every(isReminder)
  )
}

/** Write to a temp file first so a crash cannot leave a half-written file. */
function writeJsonAtomically(target: string, data: string): void {
  const temp = `${target}.tmp-${process.pid}`
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(temp, data, { encoding: 'utf8', mode: 0o600 })
  fs.renameSync(temp, target)
  try {
    fs.chmodSync(target, 0o600)
  } catch {
    // Best effort: the file was already created with 0600 above.
  }
}

function spawnDetached(command: string, args: readonly string[]): Promise<Result> {
  return new Promise((resolve) => {
    const child = spawn(command, [...args], { detached: true, stdio: 'ignore' })
    child.once('error', () => resolve(fail('APP_NOT_FOUND')))
    child.once('spawn', () => {
      child.unref()
      resolve(OK)
    })
  })
}

// ------------------------------------------------------------------ app launching

ipcMain.handle('simpleos:launch-app', async (event, target: unknown): Promise<Result> => {
  if (!isTrustedSender(event)) return fail('UNKNOWN_TARGET')
  if (typeof target !== 'string' || !Object.hasOwn(ALLOWED_APPS, target)) {
    return fail('UNKNOWN_TARGET')
  }
  const approved = ALLOWED_APPS[target]
  return spawnDetached(approved.command, approved.args)
})

// --------------------------------------------------------------------- reminders

ipcMain.handle(
  'simpleos:reminders:load',
  async (event): Promise<ValueResult<RemindersFile>> => {
    if (!isTrustedSender(event)) return fail('UNKNOWN_TARGET')
    try {
      if (!fs.existsSync(remindersPath())) {
        return { ok: true, value: { date: '', items: [] } }
      }
      const data: unknown = JSON.parse(fs.readFileSync(remindersPath(), 'utf8'))
      if (!isRemindersFile(data)) return fail('STORAGE_FAILED')
      return { ok: true, value: { date: data.date, items: data.items } }
    } catch {
      return fail('STORAGE_FAILED')
    }
  },
)

ipcMain.handle(
  'simpleos:reminders:save',
  async (event, payload: unknown): Promise<Result> => {
    if (!isTrustedSender(event)) return fail('UNKNOWN_TARGET')
    try {
      if (!isRemindersFile(payload)) return fail('INVALID_INPUT')
      writeJsonAtomically(remindersPath(), JSON.stringify(payload, null, 2))
      return OK
    } catch {
      return fail('STORAGE_FAILED')
    }
  },
)

// ------------------------------------------------------- family contact cards

const MAX_CONTACTS = 4
const MAX_CONTACT_NAME = 60
const MAX_RELATIONSHIP = 40
const MAX_AVATAR_BYTES = 2 * 1024 * 1024
const MAX_FRAME_PHOTOS = 12
const FRAME_DIR = path.join(os.homedir(), 'Pictures', 'SimpleOS')
const AVATAR_NAME = /^[A-Za-z0-9_-]{1,48}$/
const IMAGE_EXT = /\.(png|jpe?g|webp)$/i

const contactsPath = (): string => path.join(simpleosConfigDir(), 'contacts.json')
const avatarDir = (): string => path.join(simpleosConfigDir(), 'avatars')

function isContact(value: unknown): value is Contact {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<Contact>
  return (
    typeof item.id === 'string' &&
    AVATAR_NAME.test(item.id) &&
    typeof item.name === 'string' &&
    item.name.trim().length > 0 &&
    item.name.length <= MAX_CONTACT_NAME &&
    typeof item.relationship === 'string' &&
    item.relationship.length <= MAX_RELATIONSHIP &&
    (item.avatarFile === null ||
      (typeof item.avatarFile === 'string' && AVATAR_NAME.test(item.avatarFile))) &&
    isAllowedVideoRoom(item.roomUrl)
  )
}

function isContactsFile(value: unknown): value is ContactsFile {
  if (!value || typeof value !== 'object') return false
  const file = value as Partial<ContactsFile>
  return (
    Array.isArray(file.contacts) &&
    file.contacts.length <= MAX_CONTACTS &&
    file.contacts.every(isContact)
  )
}

ipcMain.handle('simpleos:contacts:load', async (event): Promise<ValueResult<ContactsFile>> => {
  if (!isTrustedSender(event)) return fail('UNKNOWN_TARGET')
  try {
    if (!fs.existsSync(contactsPath())) return { ok: true, value: { contacts: [] } }
    const data: unknown = JSON.parse(fs.readFileSync(contactsPath(), 'utf8'))
    if (!isContactsFile(data)) return fail('STORAGE_FAILED')
    return { ok: true, value: { contacts: data.contacts } }
  } catch {
    return fail('STORAGE_FAILED')
  }
})

ipcMain.handle(
  'simpleos:contacts:save',
  async (event, payload: unknown): Promise<Result> => {
    if (!isTrustedSender(event)) return fail('UNKNOWN_TARGET')
    if (!isContactsFile(payload)) return fail('INVALID_INPUT')
    try {
      writeJsonAtomically(contactsPath(), JSON.stringify(payload, null, 2))
      return OK
    } catch {
      return fail('STORAGE_FAILED')
    }
  },
)

ipcMain.handle(
  'simpleos:contacts:avatar',
  async (event, contactId: unknown, imageBase64: unknown): Promise<ValueResult<{ fileName: string }>> => {
    if (!isTrustedSender(event)) return fail('UNKNOWN_TARGET')
    if (
      typeof contactId !== 'string' ||
      !AVATAR_NAME.test(contactId) ||
      typeof imageBase64 !== 'string' ||
      imageBase64.length === 0 ||
      imageBase64.length > MAX_AVATAR_BYTES * 2 ||
      !/^[A-Za-z0-9+/=]+$/.test(imageBase64)
    ) {
      return fail('INVALID_INPUT')
    }
    try {
      const image = nativeImage.createFromBuffer(Buffer.from(imageBase64, 'base64'))
      if (image.isEmpty()) return fail('INVALID_INPUT')
      const resized = image.resize({ width: 256, height: 256 }).toPNG()
      if (resized.length === 0 || resized.length > MAX_AVATAR_BYTES) return fail('INVALID_INPUT')
      const fileName = `avatar-${contactId}.png`
      fs.mkdirSync(avatarDir(), { recursive: true })
      fs.writeFileSync(path.join(avatarDir(), fileName), resized, { mode: 0o600 })
      return { ok: true, value: { fileName } }
    } catch {
      return fail('STORAGE_FAILED')
    }
  },
)

ipcMain.handle(
  'simpleos:contacts:call',
  async (event, roomUrl: unknown): Promise<Result> => {
    if (!isTrustedSender(event)) return fail('UNKNOWN_TARGET')
    if (!isAllowedVideoRoom(roomUrl)) return fail('INVALID_INPUT')
    return spawnDetached('flatpak', ['run', 'org.mozilla.firefox', '--new-window', roomUrl])
  },
)

ipcMain.handle(
  'simpleos:contacts:avatar:get',
  async (event, fileName: unknown): Promise<ValueResult<{ dataUrl: string }>> => {
    if (!isTrustedSender(event)) return fail('UNKNOWN_TARGET')
    if (typeof fileName !== 'string') return fail('INVALID_INPUT')
    const safe = path.basename(fileName)
    if (!safe.startsWith('avatar-') || !safe.endsWith('.png') || !AVATAR_NAME.test(safe.slice(7, -4))) {
      return fail('INVALID_INPUT')
    }
    try {
      const bytes = fs.readFileSync(path.join(avatarDir(), safe))
      return { ok: true, value: { dataUrl: `data:image/png;base64,${bytes.toString('base64')}` } }
    } catch {
      return fail('STORAGE_FAILED')
    }
  },
)

ipcMain.handle(
  'simpleos:photos:frame',
  async (event): Promise<ValueResult<{ photos: string[] }>> => {
    if (!isTrustedSender(event)) return fail('UNKNOWN_TARGET')
    try {
      const files = fs
        .readdirSync(FRAME_DIR)
        .filter((name) => IMAGE_EXT.test(name))
        .sort()
        .slice(0, MAX_FRAME_PHOTOS)
      const photos: string[] = []
      for (const name of files) {
        const full = path.join(FRAME_DIR, name)
        const bytes = fs.readFileSync(full)
        if (bytes.length > MAX_AVATAR_BYTES) continue
        const ext = path.extname(name).slice(1).toLowerCase()
        const mime = ext === 'jpg' ? 'jpeg' : ext
        photos.push(`data:image/${mime};base64,${bytes.toString('base64')}`)
      }
      return { ok: true, value: { photos } }
    } catch {
      return { ok: true, value: { photos: [] } }
    }
  },
)

// -------------------------------------------------------------------- caregiver PIN

interface PinRecord {
  salt: string
  hash: string
}

// In-memory only: a fresh launch starts clean. The limiter is enforced here,
// not in the UI, so a modified renderer cannot skip it.
const pinThrottle = createPinThrottle()

function readPinRecord(): PinRecord | null {
  try {
    if (!fs.existsSync(pinPath())) return null
    const data: unknown = JSON.parse(fs.readFileSync(pinPath(), 'utf8'))
    if (!data || typeof data !== 'object') return null
    const record = data as Partial<PinRecord>
    if (
      typeof record.salt !== 'string' ||
      typeof record.hash !== 'string' ||
      record.salt.length !== SALT_HEX_LENGTH ||
      record.hash.length !== HASH_HEX_LENGTH ||
      !/^[0-9a-f]+$/i.test(record.salt) ||
      !/^[0-9a-f]+$/i.test(record.hash)
    ) {
      return null
    }
    return { salt: record.salt, hash: record.hash }
  } catch {
    return null
  }
}

ipcMain.handle(
  'simpleos:pin:has',
  async (event): Promise<ValueResult<{ hasPin: boolean }>> => {
    if (!isTrustedSender(event)) return fail('UNKNOWN_TARGET')
    return { ok: true, value: { hasPin: readPinRecord() !== null } }
  },
)

ipcMain.handle('simpleos:pin:unlock', async (event, pin: unknown): Promise<Result> => {
  if (!isTrustedSender(event)) return fail('UNKNOWN_TARGET')
  if (!pinThrottle.allowed()) return fail('TOO_MANY_TRIES')
  if (typeof pin !== 'string' || pin.length === 0 || !/^\d+$/.test(pin)) {
    pinThrottle.recordFailure()
    return fail('PIN_INCORRECT')
  }
  const record = readPinRecord()
  if (!record) return fail('PIN_NOT_SET')
  if (!pinsMatch(pin, record)) {
    pinThrottle.recordFailure()
    return fail('PIN_INCORRECT')
  }
  pinThrottle.reset()
  return OK
})

ipcMain.handle(
  'simpleos:pin:set',
  async (event, currentPin: unknown, newPin: unknown): Promise<Result> => {
    if (!isTrustedSender(event)) return fail('UNKNOWN_TARGET')
    const record = readPinRecord()
    // Changing an existing PIN checks the old one, so it gets the same gate.
    if (record && !pinThrottle.allowed()) return fail('TOO_MANY_TRIES')
    if (typeof newPin !== 'string' || newPin.length < PIN_MIN_LENGTH) {
      return fail('PIN_TOO_SHORT')
    }
    if (newPin.length > PIN_MAX_LENGTH) return fail('PIN_TOO_LONG')
    if (!/^\d+$/.test(newPin)) return fail('PIN_NOT_NUMERIC')

    if (record && (typeof currentPin !== 'string' || !pinsMatch(currentPin, record))) {
      pinThrottle.recordFailure()
      return fail('PIN_INCORRECT')
    }

    try {
      const salt = crypto.randomBytes(16).toString('hex')
      writeJsonAtomically(
        pinPath(),
        JSON.stringify({ salt, hash: hashPin(newPin, salt) }, null, 2),
      )
      pinThrottle.reset()
      return OK
    } catch {
      return fail('STORAGE_FAILED')
    }
  },
)

// ------------------------------------------------------------ caregiver shortcuts

/**
 * The allowlists live in ./allowlists so they can be unit tested. The renderer
 * only ever supplies an action NAME; it cannot supply a command or arguments.
 */
function spawnApproved(approved: ApprovedCommand): Promise<Result> {
  return spawnDetached(approved.command, approved.args)
}

const lastUpdatePath = (): string => path.join(simpleosConfigDir(), 'last-update-check.json')

function recordUpdateCheck(): void {
  try {
    writeJsonAtomically(lastUpdatePath(), JSON.stringify({ checkedAt: Date.now() }, null, 2))
  } catch {
    // A failed timestamp write must never break the update check itself.
  }
}

function lastUpdateCheckText(): string {
  try {
    const data: unknown = JSON.parse(fs.readFileSync(lastUpdatePath(), 'utf8'))
    const checkedAt = (data as { checkedAt?: unknown })?.checkedAt
    if (typeof checkedAt === 'number' && Number.isFinite(checkedAt)) {
      return `Last checked ${new Date(checkedAt).toLocaleString()}`
    }
  } catch {
    // No check recorded yet.
  }
  return 'No update check has been recorded yet.'
}

/** Read rpm-ostree state and turn it into a short, calm sentence. */
function checkUpdateStatus(): Promise<ValueResult<{ summary: string }>> {
  return new Promise((resolve) => {
    execFile(
      'rpm-ostree',
      ['status', '--json'],
      { timeout: 15000, maxBuffer: 2 * 1024 * 1024 },
      (error, stdout) => {
        if (error) {
          resolve(fail('UPDATE_CHECK_FAILED'))
          return
        }
        try {
          const data: unknown = JSON.parse(stdout)
          if (!data || typeof data !== 'object') {
            resolve(fail('UPDATE_CHECK_FAILED'))
            return
          }
          recordUpdateCheck()
          const deployments = (data as { deployments?: unknown }).deployments
          const list = Array.isArray(deployments) ? deployments : []
          const booted = list.find(
            (item) => Boolean(item) && (item as { booted?: boolean }).booted === true,
          ) as { version?: unknown } | undefined
          const staged = list.find(
            (item) => Boolean(item) && (item as { staged?: boolean }).staged === true,
          )

          if (staged) {
            resolve({
              ok: true,
              value: { summary: 'An update is ready. Restart the computer to finish installing it.' },
            })
            return
          }

          if (booted && typeof booted.version === 'string') {
            const version = booted.version.replace(/[^A-Za-z0-9._-]/g, '').slice(0, 40)
            resolve({
              ok: true,
              value: { summary: `Your system is up to date. Version ${version}.` },
            })
            return
          }

          resolve({ ok: true, value: { summary: 'Your system is up to date.' } })
        } catch {
          resolve(fail('UPDATE_CHECK_FAILED'))
        }
      },
    )
  })
}

/**
 * The single caregiver/help entry point. Only fixed action names are accepted;
 * anything else is rejected with a code that the renderer maps to plain text.
 */
ipcMain.handle(
  'simpleos:run-action',
  async (event, action: unknown): Promise<ValueResult<{ summary?: string }>> => {
    if (!isTrustedSender(event)) return fail('UNKNOWN_TARGET')
    if (typeof action !== 'string' || !Object.hasOwn(SAFE_ACTIONS, action)) {
      return fail('UNKNOWN_TARGET')
    }

    const name = action as CaregiverAction
    if (name === 'checkUpdates') {
      const result = await checkUpdateStatus()
      return result.ok ? { ok: true, value: { summary: result.value.summary } } : result
    }

    const result = await spawnApproved(SAFE_ACTIONS[name])
    if (!result.ok) return result

    return {
      ok: true,
      value: {
        summary:
          name === 'screenShare'
            ? 'Screen sharing is starting. You can stop it inside RustDesk.'
            : name === 'triggerUpdate'
              ? 'The update is starting. We will let you know when it is ready.'
              : 'Opening settings.',
      },
    }
  },
)

// Legacy channels kept as thin wrappers so existing UI builds keep working;
// both delegate to the same allowlists and helpers used by `runAction`.
ipcMain.handle(
  'simpleos:open-settings',
  async (event, target: unknown): Promise<Result> => {
    if (!isTrustedSender(event)) return fail('UNKNOWN_TARGET')
    if (typeof target !== 'string' || !Object.hasOwn(ALLOWED_SETTINGS, target)) {
      return fail('UNKNOWN_TARGET')
    }
    return spawnApproved(ALLOWED_SETTINGS[target])
  },
)

ipcMain.handle(
  'simpleos:update-status',
  async (event): Promise<ValueResult<{ summary: string }>> => {
    if (!isTrustedSender(event)) return fail('UNKNOWN_TARGET')
    return checkUpdateStatus()
  },
)

// ------------------------------------------------------------ hardware status

/**
 * Run a fixed, read-only command. Only commands from the frozen allowlists are
 * ever passed here; renderer input is a key, never a command or an argument.
 */
function runApproved(approved: ApprovedCommand, timeout = 5000): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(
      approved.command,
      [...approved.args],
      { timeout, maxBuffer: 1024 * 1024 },
      (error, stdout) => resolve(error ? null : stdout),
    )
  })
}

const MAX_SSID_LENGTH = 32
const VOLUME_KEYS: readonly VolumeAction[] = ['volumeUp', 'volumeDown', 'volumeMute']
const BRIGHTNESS_KEYS: readonly BrightnessAction[] = ['brightnessUp', 'brightnessDown']
const POWER_SUPPLY_DIR = '/sys/class/power_supply'
const BACKLIGHT_DIR = '/sys/class/backlight'

/** Turn `nmcli --terse` output into one calm value for the header. */
function parseWifiStatus(stdout: string | null): WifiStatus {
  if (!stdout) return { connected: false, ssid: null }
  for (const line of stdout.split('\n')) {
    const fields = line.trim().split(':')
    // TYPE,STATE,CONNECTION — an SSID may itself contain a colon, so join the rest.
    if (fields[0] !== 'wifi' || fields[1] !== 'connected') continue
    const raw = fields
      .slice(2)
      .join(':')
      .replace(/[\u0000-\u001f\u007f]/g, '')
      .trim()
    return { connected: true, ssid: raw ? raw.slice(0, MAX_SSID_LENGTH) : null }
  }
  return { connected: false, ssid: null }
}

/**
 * Read battery state straight from sysfs. No external process and no root are
 * needed; desktops simply report that no battery is present.
 */
function readBatteryStatus(): BatteryStatus {
  try {
    const names = fs.readdirSync(POWER_SUPPLY_DIR).filter((name) => name.startsWith('BAT'))
    if (names.length === 0) return { present: false, percent: null, charging: null }
    const battery = path.join(POWER_SUPPLY_DIR, names[0])
    const parsed = Number.parseInt(fs.readFileSync(path.join(battery, 'capacity'), 'utf8'), 10)
    const state = fs.readFileSync(path.join(battery, 'status'), 'utf8').trim().toLowerCase()
    return {
      present: true,
      percent: Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : null,
      charging: state === 'charging' || state === 'full' ? true : state ? false : null,
    }
  } catch {
    return { present: false, percent: null, charging: null }
  }
}

/** A desktop has no backlight directory, so those buttons should be hidden. */
function hasBacklight(): boolean {
  try {
    return fs.readdirSync(BACKLIGHT_DIR).length > 0
  } catch {
    return false
  }
}

ipcMain.handle('simpleos:hardware:status', async (event): Promise<ValueResult<HardwareStatus>> => {
  if (!isTrustedSender(event)) return fail('UNKNOWN_TARGET')
  const wifi = parseWifiStatus(await runApproved(HARDWARE_STATUS.wifi))
  const audio = await runApproved(HARDWARE_STATUS.audio)
  const rustdesk = await runApproved(HARDWARE_STATUS.rustdesk)
  return {
    ok: true,
    value: {
      wifi,
      battery: readBatteryStatus(),
      brightnessAvailable: hasBacklight(),
      audioAvailable: audio !== null && audio.trim().length > 0,
      rustdeskAvailable: rustdesk !== null,
    },
  }
})

ipcMain.handle('simpleos:hardware:volume', async (event, action: unknown): Promise<Result> => {
  if (!isTrustedSender(event)) return fail('UNKNOWN_TARGET')
  if (typeof action !== 'string' || !VOLUME_KEYS.includes(action as VolumeAction)) {
    return fail('UNKNOWN_TARGET')
  }
  return (await runApproved(HARDWARE_ACTIONS[action])) !== null
    ? OK
    : fail('HARDWARE_UNAVAILABLE')
})

ipcMain.handle(
  'simpleos:hardware:brightness',
  async (event, action: unknown): Promise<Result> => {
    if (!isTrustedSender(event)) return fail('UNKNOWN_TARGET')
    if (typeof action !== 'string' || !BRIGHTNESS_KEYS.includes(action as BrightnessAction)) {
      return fail('UNKNOWN_TARGET')
    }
    return (await runApproved(HARDWARE_ACTIONS[action])) !== null
      ? OK
      : fail('HARDWARE_UNAVAILABLE')
  },
)

// ------------------------------------------------------------ local voice features

let localSpeechProcess: ReturnType<typeof spawn> | null = null
const MAX_SPEECH_CHARS = 400
const MAX_AUDIO_BASE64 = 2 * 1024 * 1024

/** Keep spoken text to plain characters so it can never become a command. */
function sanitizeSpeechText(text: unknown): string | null {
  if (typeof text !== 'string' || text.trim().length === 0) return null
  const cleaned = text
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/[^\p{L}\p{N}\s.,!?'"():;-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned && cleaned.length <= MAX_SPEECH_CHARS ? cleaned : null
}

/** Replace internal placeholders only; renderer values are never arguments. */
function voiceArgs(command: ApprovedCommand, paths: readonly string[]): string[] {
  let index = 0
  return command.args.map((arg) => (arg === '{path}' ? paths[index++] : arg))
}

function runVoice(command: ApprovedCommand, paths: readonly string[], timeout = 20_000): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(
      command.command,
      voiceArgs(command, paths),
      { timeout, maxBuffer: 1024 * 1024 },
      (error, stdout) => resolve(error ? null : stdout),
    )
  })
}

function tempVoiceFile(extension: string): string {
  return path.join(os.tmpdir(), `simpleos-voice-${process.pid}-${crypto.randomBytes(6).toString('hex')}.${extension}`)
}

ipcMain.handle('simpleos:voice:speak', async (event, text: unknown): Promise<Result> => {
  if (!isTrustedSender(event)) return fail('UNKNOWN_TARGET')
  const clean = sanitizeSpeechText(text)
  if (!clean) return fail('INVALID_INPUT')
  const file = tempVoiceFile('txt')
  try {
    fs.writeFileSync(file, clean, { encoding: 'utf8', mode: 0o600 })
    localSpeechProcess = spawn(VOICE_COMMANDS.speak.command, voiceArgs(VOICE_COMMANDS.speak, [file]), {
      stdio: 'ignore',
    })
    const result = await new Promise<Result>((resolve) => {
      localSpeechProcess?.once('error', () => resolve(fail('VOICE_UNAVAILABLE')))
      localSpeechProcess?.once('spawn', () => resolve(OK))
    })
    return result
  } catch {
    return fail('VOICE_UNAVAILABLE')
  } finally {
    // Keep the file until the child has opened it; a short delay avoids a race.
    setTimeout(() => {
      try {
        fs.unlinkSync(file)
      } catch {
        // Best effort only.
      }
    }, 2_000).unref()
  }
})

ipcMain.handle('simpleos:voice:stop', async (event): Promise<Result> => {
  if (!isTrustedSender(event)) return fail('UNKNOWN_TARGET')
  if (localSpeechProcess && !localSpeechProcess.killed) {
    localSpeechProcess.kill()
  }
  localSpeechProcess = null
  return OK
})

ipcMain.handle(
  'simpleos:voice:transcribe',
  async (event, audioBase64: unknown): Promise<ValueResult<{ text: string }>> => {
    if (!isTrustedSender(event)) return fail('UNKNOWN_TARGET')
    if (
      typeof audioBase64 !== 'string' ||
      audioBase64.length === 0 ||
      audioBase64.length > MAX_AUDIO_BASE64 ||
      !/^[A-Za-z0-9+/=]+$/.test(audioBase64)
    ) {
      return fail('INVALID_INPUT')
    }

    const input = tempVoiceFile('audio')
    const wav = tempVoiceFile('wav')
    const cleanup = () => {
      for (const file of [input, wav]) {
        try {
          fs.unlinkSync(file)
        } catch {
          // Best effort only.
        }
      }
    }

    try {
      fs.writeFileSync(input, Buffer.from(audioBase64, 'base64'), { mode: 0o600 })
      const converted = await runVoice(VOICE_COMMANDS.toWav, [input, wav])
      if (converted === null) return fail('VOICE_UNAVAILABLE')
      const recognized = await runVoice(VOICE_COMMANDS.recognize, [wav])
      if (recognized === null) return fail('VOICE_UNAVAILABLE')
      const parsed = JSON.parse(recognized) as { text?: unknown }
      const text = typeof parsed.text === 'string' ? sanitizeSpeechText(parsed.text) : null
      return text
        ? { ok: true, value: { text } }
        : { ok: true, value: { text: '' } }
    } catch {
      return fail('VOICE_UNAVAILABLE')
    } finally {
      cleanup()
    }
  },
)

// ------------------------------------------------ health and safe recovery

function diskHealthText(): string {
  try {
    const stats = fs.statfsSync(simpleosConfigDir())
    const free = (stats.bavail * stats.bsize) / 1_000_000_000
    return free < 2
      ? `Low disk space: ${free.toFixed(1)} GB free`
      : `Disk space is healthy: ${free.toFixed(0)} GB free`
  } catch {
    return 'Disk space could not be checked.'
  }
}

function imageVersionText(): string {
  try {
    const raw = fs.readFileSync('/etc/simpleos-image-version', 'utf8').trim()
    return raw ? `SimpleOS ${raw}` : 'SimpleOS version is not recorded on this computer.'
  } catch {
    return 'SimpleOS version is not recorded on this computer.'
  }
}

ipcMain.handle('simpleos:health', async (event): Promise<ValueResult<HealthStatus>> => {
  if (!isTrustedSender(event)) return fail('UNKNOWN_TARGET')
  const wifi = parseWifiStatus(await runApproved(HARDWARE_STATUS.wifi))
  const sink = await runApproved(HARDWARE_STATUS.audio)
  const sources = await runApproved(HEALTH_COMMANDS.sources)
  const internet = wifi.connected ? 'Connected to the internet.' : 'Not connected to Wi-Fi.'
  const audio = sink && sink.trim() ? 'Sound output is ready.' : 'Sound output was not found.'
  const microphone = sources && sources.trim() ? 'Microphone is ready.' : 'Microphone was not found.'
  const disk = diskHealthText()
  const imageVersion = imageVersionText()
  const lastUpdateCheck = lastUpdateCheckText()
  const summary = [
    'SimpleOS health summary',
    `Internet: ${internet}`,
    `Sound: ${audio}`,
    `Microphone: ${microphone}`,
    `Disk: ${disk}`,
    `Image: ${imageVersion}`,
    `Updates: ${lastUpdateCheck}`,
  ].join('\n')
  return {
    ok: true,
    value: { internet, audio, microphone, disk, imageVersion, lastUpdateCheck, summary },
  }
})

ipcMain.handle(
  'simpleos:recovery',
  async (event, action: unknown): Promise<ValueResult<{ summary: string }>> => {
    if (!isTrustedSender(event)) return fail('UNKNOWN_TARGET')
    if (action === 'restartLauncher') {
      setTimeout(() => {
        app.relaunch()
        app.exit(0)
      }, 200).unref()
      return { ok: true, value: { summary: 'Restarting SimpleOS now.' } }
    }
    if (action === 'checkUpdates') {
      const result = await checkUpdateStatus()
      return result.ok ? { ok: true, value: { summary: result.value.summary } } : result
    }
    if (action === 'rollBack') {
      const started = await runApproved(HEALTH_COMMANDS.rollback, 30_000)
      return started !== null
        ? {
            ok: true,
            value: {
              summary: 'Going back to the previous system version. The computer will restart.',
            },
          }
        : fail('RECOVERY_FAILED')
    }
    return fail('UNKNOWN_TARGET')
  },
)

// -------------------------------------------------------------------- window setup

function createWindow(): void {
  const window = new BrowserWindow({
    fullscreen: true,
    kiosk: true,
    resizable: false,
    autoHideMenuBar: true,
    backgroundColor: '#0B1120',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      webviewTag: false,
    },
  })
  launcherWindow = window

  // Nothing in the launcher ever needs to navigate away or open another
  // window. Deny both rather than trying to maintain an allowlist of URLs.
  window.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedAppUrl(url)) event.preventDefault()
  })
  window.webContents.on('will-frame-navigate', (details) => {
    if (!isAllowedAppUrl(details.url)) details.preventDefault()
  })
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  if (devUrl) {
    // Development only: the concurrently-run Vite dev server.
    void window.loadURL(devUrl)
  } else {
    // Production: load the bundled renderer from the repository dist/ folder.
    void window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }
}

// No embedded webviews anywhere in the app: they would create extra renderer
// frames that bypass the single-window IPC trust check above.
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-attach-webview', (event) => event.preventDefault())
})

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
