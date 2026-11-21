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
import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'
import { spawn, execFile } from 'node:child_process'
import type {
  ErrorCode,
  Reminder,
  RemindersFile,
  Result,
  ValueResult,
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

const remindersPath = (): string =>
  path.join(app.getPath('userData'), 'reminders.json')
const pinPath = (): string =>
  path.join(app.getPath('userData'), 'caregiver-pin.json')

function isReminder(value: unknown): value is Reminder {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return (
    typeof item.id === 'string' &&
    typeof item.text === 'string' &&
    typeof item.time === 'string' &&
    typeof item.done === 'boolean' &&
    typeof item.createdAt === 'number'
  )
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

interface ApprovedCommand {
  readonly command: string
  readonly args: readonly string[]
}

const ALLOWED_APPS: Readonly<Record<string, ApprovedCommand>> = Object.freeze({
  videoCalls: {
    command: 'flatpak',
    args: Object.freeze(['run', 'org.mozilla.firefox', '--new-window', 'https://meet.google.com/']),
  },
  webEmail: {
    command: 'flatpak',
    args: Object.freeze(['run', 'org.mozilla.firefox']),
  },
  photos: {
    command: 'flatpak',
    args: Object.freeze(['run', 'org.gnome.Loupe']),
  },
  remoteHelp: {
    command: 'flatpak',
    args: Object.freeze(['run', 'com.rustdesk.RustDesk']),
  },
})

ipcMain.handle('simpleos:launch-app', async (_event, target: unknown): Promise<Result> => {
  if (typeof target !== 'string' || !Object.hasOwn(ALLOWED_APPS, target)) {
    return fail('UNKNOWN_TARGET')
  }
  const approved = ALLOWED_APPS[target]
  return spawnDetached(approved.command, approved.args)
})

// --------------------------------------------------------------------- reminders

ipcMain.handle(
  'simpleos:reminders:load',
  async (): Promise<ValueResult<RemindersFile>> => {
    try {
      if (!fs.existsSync(remindersPath())) {
        return { ok: true, value: { date: '', items: [] } }
      }
      const data: unknown = JSON.parse(fs.readFileSync(remindersPath(), 'utf8'))
      if (!data || typeof data !== 'object') return fail('STORAGE_FAILED')
      const file = data as Partial<RemindersFile>
      if (
        typeof file.date !== 'string' ||
        !Array.isArray(file.items) ||
        !file.items.every(isReminder)
      ) {
        return fail('STORAGE_FAILED')
      }
      return { ok: true, value: { date: file.date, items: file.items } }
    } catch {
      return fail('STORAGE_FAILED')
    }
  },
)

ipcMain.handle(
  'simpleos:reminders:save',
  async (_event, payload: unknown): Promise<Result> => {
    try {
      if (!payload || typeof payload !== 'object') return fail('INVALID_INPUT')
      const file = payload as Partial<RemindersFile>
      if (
        typeof file.date !== 'string' ||
        !Array.isArray(file.items) ||
        !file.items.every(isReminder)
      ) {
        return fail('INVALID_INPUT')
      }
      fs.mkdirSync(path.dirname(remindersPath()), { recursive: true })
      fs.writeFileSync(remindersPath(), JSON.stringify(file, null, 2), 'utf8')
      return OK
    } catch {
      return fail('STORAGE_FAILED')
    }
  },
)

// -------------------------------------------------------------------- caregiver PIN

interface PinRecord {
  salt: string
  hash: string
}

function readPinRecord(): PinRecord | null {
  try {
    if (!fs.existsSync(pinPath())) return null
    const data: unknown = JSON.parse(fs.readFileSync(pinPath(), 'utf8'))
    if (!data || typeof data !== 'object') return null
    const record = data as Partial<PinRecord>
    return typeof record.salt === 'string' && typeof record.hash === 'string'
      ? { salt: record.salt, hash: record.hash }
      : null
  } catch {
    return null
  }
}

function hashPin(pin: string, saltHex: string): string {
  return crypto.scryptSync(pin, Buffer.from(saltHex, 'hex'), 64).toString('hex')
}

function pinMatches(pin: string, record: PinRecord): boolean {
  const candidate = Buffer.from(hashPin(pin, record.salt), 'hex')
  const expected = Buffer.from(record.hash, 'hex')
  return (
    candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected)
  )
}

ipcMain.handle(
  'simpleos:pin:has',
  async (): Promise<ValueResult<{ hasPin: boolean }>> => ({
    ok: true,
    value: { hasPin: readPinRecord() !== null },
  }),
)

ipcMain.handle('simpleos:pin:unlock', async (_event, pin: unknown): Promise<Result> => {
  if (typeof pin !== 'string') return fail('INVALID_INPUT')
  const record = readPinRecord()
  if (!record) return fail('PIN_NOT_SET')
  return pinMatches(pin, record) ? OK : fail('PIN_INCORRECT')
})

ipcMain.handle(
  'simpleos:pin:set',
  async (_event, currentPin: unknown, newPin: unknown): Promise<Result> => {
    if (typeof newPin !== 'string' || newPin.length < 4) return fail('PIN_TOO_SHORT')
    if (!/^\d+$/.test(newPin)) return fail('PIN_NOT_NUMERIC')

    const record = readPinRecord()
    if (record && (typeof currentPin !== 'string' || !pinMatches(currentPin, record))) {
      return fail('PIN_INCORRECT')
    }

    try {
      const salt = crypto.randomBytes(16).toString('hex')
      fs.mkdirSync(path.dirname(pinPath()), { recursive: true })
      fs.writeFileSync(
        pinPath(),
        JSON.stringify({ salt, hash: hashPin(newPin, salt) }, null, 2),
        { mode: 0o600 },
      )
      return OK
    } catch {
      return fail('STORAGE_FAILED')
    }
  },
)

// ------------------------------------------------------------ caregiver shortcuts

const ALLOWED_SETTINGS: Readonly<Record<string, ApprovedCommand>> = Object.freeze({
  network: { command: 'nm-connection-editor', args: Object.freeze([]) },
  printer: { command: 'system-config-printer', args: Object.freeze([]) },
})

ipcMain.handle(
  'simpleos:open-settings',
  async (_event, target: unknown): Promise<Result> => {
    if (typeof target !== 'string' || !Object.hasOwn(ALLOWED_SETTINGS, target)) {
      return fail('UNKNOWN_TARGET')
    }
    const approved = ALLOWED_SETTINGS[target]
    return spawnDetached(approved.command, approved.args)
  },
)

ipcMain.handle(
  'simpleos:update-status',
  async (): Promise<ValueResult<{ summary: string }>> =>
    new Promise((resolve) => {
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
                value: {
                  summary: 'An update is ready. Restart the computer to finish installing it.',
                },
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
    }),
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
    },
  })

  if (devUrl) {
    // Development only: the concurrently-run Vite dev server.
    void window.loadURL(devUrl)
  } else {
    // Production: load the bundled renderer from the repository dist/ folder.
    void window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
