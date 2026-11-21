import { describe, it, expect } from 'vitest'
import { ALLOWED_APPS, ALLOWED_SETTINGS, SAFE_ACTIONS, isAllowedKey } from '../electron/allowlists'

describe('IPC allowlists', () => {
  it('exposes only the four app launch targets', () => {
    expect(Object.keys(ALLOWED_APPS).sort()).toEqual(['firefox', 'jitsi', 'photos', 'rustdesk'])
  })

  it('maps each app to a fixed flatpak command with no renderer input', () => {
    for (const target of Object.values(ALLOWED_APPS)) {
      expect(target.command).toBe('flatpak')
      expect(target.args[0]).toBe('run')
      expect(target.args.slice(1).every((arg) => typeof arg === 'string')).toBe(true)
    }
  })

  it('exposes only the two caregiver setting commands', () => {
    expect(Object.keys(ALLOWED_SETTINGS).sort()).toEqual(['network', 'printer'])
    expect(ALLOWED_SETTINGS.network.command).toBe('nm-connection-editor')
    expect(ALLOWED_SETTINGS.printer.command).toBe('system-config-printer')
  })

  it('allows exactly the five caregiver/help actions', () => {
    expect(Object.keys(SAFE_ACTIONS).sort()).toEqual([
      'checkUpdates',
      'networkSettings',
      'printerSettings',
      'screenShare',
      'triggerUpdate',
    ])
    expect(SAFE_ACTIONS.screenShare).toBe(ALLOWED_APPS.rustdesk)
  })

  it('rejects invalid or prototype keys', () => {
    for (const key of ['rm -rf /', '__proto__', 'constructor', '', 42, null, undefined]) {
      expect(isAllowedKey(SAFE_ACTIONS, key)).toBe(false)
      expect(isAllowedKey(ALLOWED_APPS, key)).toBe(false)
    }
    expect(isAllowedKey(SAFE_ACTIONS, 'screenShare')).toBe(true)
  })

  it('freezes the maps so renderer code cannot mutate them', () => {
    expect(Object.isFrozen(ALLOWED_APPS)).toBe(true)
    expect(Object.isFrozen(ALLOWED_SETTINGS)).toBe(true)
    expect(Object.isFrozen(SAFE_ACTIONS)).toBe(true)
  })
})
