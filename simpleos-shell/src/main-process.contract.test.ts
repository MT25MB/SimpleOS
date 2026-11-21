import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ALLOWED_LAUNCH_TARGETS } from './data/launchTargets'

const electronMain = readFileSync(resolve(__dirname, '../electron/main.ts'), 'utf8')
const preload = readFileSync(resolve(__dirname, '../electron/preload.ts'), 'utf8')

describe('electron main security contract', () => {
  it('enables context isolation and disables Node integration and sandbox escape', () => {
    expect(electronMain).toContain('contextIsolation: true')
    expect(electronMain).toContain('nodeIntegration: false')
    expect(electronMain).toContain('sandbox: true')
  })

  it('uses Wayland ozone auto-detection and kiosk mode', () => {
    expect(electronMain).toContain("'ozone-platform-hint', 'auto'")
    expect(electronMain).toContain('kiosk: true')
    expect(electronMain).toContain("'dist', 'index.html'")
  })

  it('hashes the PIN with scryptSync and verifies with timingSafeEqual', () => {
    expect(electronMain).toContain('scryptSync')
    expect(electronMain).toContain('timingSafeEqual')
    expect(electronMain).not.toMatch(/const\s+CAREGIVER_PIN\s*=\s*['"]\d+/)
  })

  it('stores state under the simpleos config directory, never userData', () => {
    expect(electronMain).toContain("'.config'")
    expect(electronMain).toContain("'simpleos'")
    expect(electronMain).not.toContain("app.getPath('userData')")
  })

  it('validates every launch target against a fixed allowlist before spawning', () => {
    expect(electronMain).toContain('Object.hasOwn(ALLOWED_APPS, target)')
    for (const target of ALLOWED_LAUNCH_TARGETS) {
      expect(electronMain).toContain(`${target}: {`)
    }
  })
})

describe('preload bridge contract', () => {
  it('exposes only allowlisted methods and no raw IPC or Node APIs', () => {
    expect(preload).toContain("exposeInMainWorld('simpleOS', bridge)")
    expect(preload).not.toContain('ipcRenderer.on')
    expect(preload).not.toContain('require(')
    expect(preload).not.toMatch(/exposeInMainWorld\(\s*['"]electron/)
  })

  it('exposes the unified runAction dispatcher', () => {
    expect(preload).toContain("runAction: (action) => ipcRenderer.invoke('simpleos:run-action', action)")
  })
})

describe('caregiver runAction allowlist', () => {
  it('accepts only fixed action names and rejects everything else', () => {
    expect(electronMain).toContain("'simpleos:run-action'")
    expect(electronMain).toContain('Object.hasOwn(SAFE_ACTIONS, action)')
    expect(electronMain).toContain('return fail(\'UNKNOWN_TARGET\')')
  })

  it('maps all five caregiver/help actions to fixed commands', () => {
    for (const action of [
      'screenShare',
      'networkSettings',
      'printerSettings',
      'checkUpdates',
      'triggerUpdate',
    ]) {
      expect(electronMain).toContain(`${action}:`)
    }
    expect(electronMain).toContain('com.rustdesk.RustDesk')
    expect(electronMain).toContain('nm-connection-editor')
    expect(electronMain).toContain('system-config-printer')
  })

  it('never forwards renderer strings into spawned commands or arguments', () => {
    // Every spawn in main.ts uses an allowlisted ApprovedCommand, whose values
    // are literals from the frozen maps — never the `action`/`target` argument.
    expect(electronMain).toContain('spawnApproved(SAFE_ACTIONS[name])')
    expect(electronMain).not.toContain('spawn(action')
    expect(electronMain).not.toContain('spawn(target')
    expect(electronMain).not.toContain('execFile(action')
    expect(electronMain).not.toContain('[action]')
  })

  it('returns calm plain-English summaries for caregiver actions', () => {
    expect(electronMain).toContain('Screen sharing is starting')
    expect(electronMain).toContain('The settings window is opening')
    expect(electronMain).toContain('The update is starting')
  })
})
