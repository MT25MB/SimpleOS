import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(__dirname, '../..')
const main = readFileSync(resolve(root, 'simpleos-shell/electron/main.ts'), 'utf8')
const pinCrypto = readFileSync(resolve(root, 'simpleos-shell/electron/pin-crypto.ts'), 'utf8')
const allowlists = readFileSync(resolve(root, 'simpleos-shell/electron/allowlists.ts'), 'utf8')
const autostart = readFileSync(resolve(root, 'system-configs/labwc/autostart'), 'utf8')
const rc = readFileSync(resolve(root, 'system-configs/labwc/rc.xml'), 'utf8')
const environment = readFileSync(resolve(root, 'system-configs/labwc/environment'), 'utf8')
const messages = readFileSync(resolve(root, 'simpleos-shell/src/messages.ts'), 'utf8')

describe('main process data validation', () => {
  it('validates reminder shape, time format and bounds before accepting a file', () => {
    expect(main).toContain('const MAX_REMINDERS = 100')
    expect(main).toContain('const MAX_REMINDER_TEXT = 200')
    expect(main).toContain('const TIME_PATTERN')
    expect(main).toContain('Number.isFinite(item.createdAt)')
    expect(main).toContain('function isRemindersFile')
    expect(main).toContain('if (!isRemindersFile(data)) return fail(\'STORAGE_FAILED\')')
  })

  it('writes state atomically with owner-only permissions', () => {
    expect(main).toContain('function writeJsonAtomically')
    expect(main).toContain('fs.renameSync(temp, target)')
    expect(main).toContain("mode: 0o600")
    const atomicWrites = main.split('writeJsonAtomically(').length - 1
    expect(atomicWrites).toBeGreaterThanOrEqual(3) // definition + two call sites
    expect(main).toContain('pinPath(),')
  })

  it('bounds PIN length and uses scrypt with a constant-time comparison', () => {
    expect(pinCrypto).toContain('const PIN_MIN_LENGTH = 4')
    expect(pinCrypto).toContain('const PIN_MAX_LENGTH = 12')
    expect(main).toContain("return fail('PIN_TOO_LONG')")
    expect(pinCrypto).toContain('crypto.scryptSync')
    expect(pinCrypto).toContain('crypto.timingSafeEqual')
  })

  it('rejects a corrupted PIN record before hashing', () => {
    expect(main).toContain('record.salt.length !== SALT_HEX_LENGTH')
    expect(main).toContain('record.hash.length !== HASH_HEX_LENGTH')
  })

  it('keeps caregiver actions allowlisted with no renderer-supplied commands', () => {
    expect(main).toContain('Object.hasOwn(SAFE_ACTIONS, action)')
    expect(main).toContain('spawnApproved(SAFE_ACTIONS[name])')
    for (const action of ['screenShare', 'networkSettings', 'printerSettings', 'checkUpdates']) {
      expect(allowlists).toContain(`${action}:`)
    }
    expect(main).toContain('spawnApproved(')
  })
})

describe('compositor and session resilience', () => {
  it('supervises the shell and restarts it after a crash', () => {
    expect(autostart).toContain('while true; do')
    expect(autostart).toContain('"$SHELL_BIN" || true')
    expect(autostart).toContain('quick_failures')
    expect(autostart).toContain('SIMPLEOS_SHELL_BIN')
  })

  it('keeps a large cursor, maximized windows and no desktop click menus', () => {
    expect(environment).toContain('XCURSOR_SIZE=48')
    expect(environment).toContain('XCURSOR_THEME=Adwaita')
    expect(environment).toContain('LIBGL_ALWAYS_SOFTWARE=1')
    expect(environment).toContain('XDG_SESSION_TYPE=wayland')
    expect(environment).toContain('XDG_CURRENT_DESKTOP=labwc')
    expect(rc).toContain('<action name="Maximize"/>')
    expect(rc).toContain('<context name="Desktop">')
    expect(rc).toContain('<context name="Root">')
    expect(rc).toContain('<mousebind button="Right" action="Click"><action name="None"/></mousebind>')
    expect(rc).toContain('<size>18</size>')
    expect(rc).toContain('<cornerRange>0</cornerRange>')
  })
})

describe('no technical jargon reaches the user', () => {
  it('maps every error code to a calm message without stack traces or codes', () => {
    const forbidden = /(stack|Error:|Exception|undefined|null|NaN|ENOENT|at\s+\w+\s+\()/i
    const lines = messages.split('\n').filter((line) => /^\s{2}[A-Z_]+:\s*['"]/.test(line))
    expect(lines.length).toBeGreaterThan(10)
    for (const line of lines) {
      const value = line.slice(line.indexOf(':') + 1)
      expect(value).not.toMatch(forbidden)
    }
  })

  it('uses plain English in the user-facing components', () => {
    const dir = resolve(root, 'simpleos-shell/src/components')
    const files = readdirSync(dir).filter((name) => name.endsWith('.tsx') && !name.includes('.test.'))
    const jargon = /(stack trace|\bError:|Exception|ENOENT|npm |node_modules|NaN)/
    for (const file of files) {
      const source = readFileSync(resolve(dir, file), 'utf8')
      expect(source, file).not.toMatch(jargon)
    }
  })
})
