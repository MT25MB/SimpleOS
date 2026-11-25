import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ALLOWED_LAUNCH_TARGETS } from './data/launchTargets'

const electronMain = readFileSync(resolve(__dirname, '../electron/main.ts'), 'utf8')
const preload = readFileSync(resolve(__dirname, '../electron/preload.ts'), 'utf8')
const pinCrypto = readFileSync(resolve(__dirname, '../electron/pin-crypto.ts'), 'utf8')
const allowlists = readFileSync(resolve(__dirname, '../electron/allowlists.ts'), 'utf8')

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
    expect(pinCrypto).toContain('crypto.scryptSync')
    expect(pinCrypto).toContain('crypto.timingSafeEqual')
    expect(electronMain).toContain('pinsMatch(')
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
      expect(allowlists).toContain(`${target}:`)
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

  it('requires a PIN in the main process for risky actions', () => {
    expect(electronMain).toContain('let pinUnlocked = false')
    expect(electronMain).toContain('PIN_GATED_ACTIONS')
    expect(electronMain).toContain("return fail('PIN_REQUIRED')")
    expect(electronMain).toContain("action === 'rollBack' || action === 'restartLauncher'")
    expect(electronMain).toContain('pinUnlocked = true')
  })

  it('always gives a way back from external settings apps', () => {
    expect(electronMain).toContain("'simpleos:close-settings'")
    expect(electronMain).toContain('alwaysOnTop: true')
    expect(electronMain).toContain('Back to SimpleOS')
    expect(electronMain).toContain('settingsProcess.kill()')
    expect(preload).toContain("closeSettings: () => ipcRenderer.invoke('simpleos:close-settings')")
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
      expect(allowlists).toContain(`${action}:`)
    }
    expect(allowlists).toContain('com.rustdesk.RustDesk')
    expect(allowlists).toContain('nm-connection-editor')
    expect(allowlists).toContain('system-config-printer')
  })

  it('never forwards renderer strings into spawned commands or arguments', () => {
    // Every spawn in main.ts uses an allowlisted ApprovedCommand, whose values
    // are literals from the frozen maps — never the `action`/`target` argument.
    expect(electronMain).toContain('spawnSettings(approved)')
    expect(electronMain).not.toContain('spawn(action')
    expect(electronMain).not.toContain('spawn(target')
    expect(electronMain).not.toContain('execFile(action')
    // The only `[action]` uses are frozen-map lookups, never command arguments.
    expect(electronMain).not.toContain('spawn([action]')
    expect(electronMain).not.toContain('execFile([action]')
  })

  it('returns calm plain-English summaries for caregiver actions', () => {
    expect(electronMain).toContain('Screen sharing is starting')
    expect(electronMain).toContain('Opening settings.')
    expect(electronMain).toContain('The update is starting')
  })
})

describe('hardware control contract', () => {
  const messages = readFileSync(resolve(__dirname, 'messages.ts'), 'utf8')

  it('exposes only fixed status and adjust methods in the preload bridge', () => {
    expect(preload).toContain(
      "getHardwareStatus: () => ipcRenderer.invoke('simpleos:hardware:status')",
    )
    expect(preload).toContain(
      "adjustVolume: (action) => ipcRenderer.invoke('simpleos:hardware:volume', action)",
    )
    expect(preload).toContain(
      "adjustBrightness: (action) => ipcRenderer.invoke('simpleos:hardware:brightness', action)",
    )
  })

  it('maps every hardware key to a fixed allowlisted command', () => {
    for (const key of ['volumeUp', 'volumeDown', 'volumeMute', 'brightnessUp', 'brightnessDown']) {
      expect(allowlists).toContain(`${key}:`)
    }
    expect(allowlists).toContain("'pactl'")
    expect(allowlists).toContain("'brightnessctl'")
    expect(allowlists).toContain("'nmcli'")
    expect(allowlists).toContain("'@DEFAULT_SINK@'")
  })

  it('validates keys and never spawns a renderer-supplied string', () => {
    expect(electronMain).toContain("'simpleos:hardware:status'")
    expect(electronMain).toContain("'simpleos:hardware:volume'")
    expect(electronMain).toContain("'simpleos:hardware:brightness'")
    expect(electronMain).toContain('VOLUME_KEYS.includes')
    expect(electronMain).toContain('BRIGHTNESS_KEYS.includes')
    expect(electronMain).toContain('runApproved(HARDWARE_ACTIONS[action])')
    expect(electronMain).not.toContain('execFile(action')
    expect(electronMain).not.toContain('spawn(action')
  })

  it('reads battery and backlight state directly without spawning a process', () => {
    expect(electronMain).toContain("'/sys/class/power_supply'")
    expect(electronMain).toContain("'/sys/class/backlight'")
    expect(electronMain).toContain('readBatteryStatus()')
    expect(electronMain).toContain('hasBacklight()')
    expect(electronMain).toContain('parseWifiStatus(')
  })

  it('turns a failed control into one plain-English code', () => {
    expect(electronMain).toContain("fail('HARDWARE_UNAVAILABLE')")
    expect(messages).toContain('HARDWARE_UNAVAILABLE:')
  })
})
