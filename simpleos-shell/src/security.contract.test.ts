import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(resolve(root, path), 'utf8')

const main = read('simpleos-shell/electron/main.ts')
const preload = read('simpleos-shell/electron/preload.ts')
const indexHtml = read('simpleos-shell/index.html')
const policies = JSON.parse(read('system-configs/firefox/policies.json'))
const rc = read('system-configs/labwc/rc.xml')
const firstboot = read('system-configs/systemd/simpleos-firstboot.sh')
const pinScreen = read('simpleos-shell/src/components/PinScreen.tsx')
const messages = read('simpleos-shell/src/messages.ts')
const allowlists = read('simpleos-shell/electron/allowlists.ts')

describe('Electron renderer sandbox', () => {
  it('keeps every non-negotiable security flag enabled', () => {
    expect(main).toContain('contextIsolation: true')
    expect(main).toContain('nodeIntegration: false')
    expect(main).toContain('sandbox: true')
    expect(main).toContain('webSecurity: true')
    expect(main).toContain('allowRunningInsecureContent: false')
    expect(main).toContain('experimentalFeatures: false')
    expect(main).toContain('webviewTag: false')
  })

  it('blocks navigation away from the app and all new windows', () => {
    expect(main).toContain("window.webContents.on('will-navigate'")
    expect(main).toContain("window.webContents.on('will-frame-navigate'")
    expect(main).toContain('setWindowOpenHandler(() => ({ action: \'deny\' }))')
    expect(main).toContain('will-attach-webview')
    expect(main).toContain('function isAllowedAppUrl')
    expect(main).toContain("import { pathToFileURL } from 'node:url'")
    // Never allow an arbitrary local file to be navigated to.
    expect(main).not.toContain("url.protocol === 'file:'")
  })

  it('never forwards a renderer URL to the operating system', () => {
    expect(main).not.toContain('openExternal')
    expect(main).not.toContain("@electron/remote")
    expect(main).not.toContain("require('electron').shell")
    expect(preload).not.toContain('ipcRenderer.on')
    expect(preload).not.toContain('sendSync')
    expect(preload).not.toContain('require(')
  })

  it('ships a strict renderer content security policy', () => {
    expect(indexHtml).toMatch(/http-equiv="Content-Security-Policy"/)
    expect(indexHtml).toContain("default-src 'self'")
    expect(indexHtml).toContain("object-src 'none'")
    expect(indexHtml).toContain("frame-src 'none'")
    expect(indexHtml).toContain("base-uri 'none'")
  })

  it('checks the sender on every single IPC handler', () => {
    const handlers = main.split('ipcMain.handle(').length - 1
    const checks = main.split('isTrustedSender(event)').length - 1
    expect(handlers).toBe(21)
    expect(checks).toBe(handlers)
    expect(main).toContain('event.sender !== window.webContents')
    expect(main).toContain('event.senderFrame !== window.webContents.mainFrame')
  })
})

describe('Firefox enterprise guardrails', () => {
  it('forces HTTPS and uBlock Origin', () => {
    expect(policies.policies.HttpsOnlyMode).toBe('force_enabled')
    expect(
      policies.policies.ExtensionSettings['uBlock0@raymondhill.net'].installation_mode,
    ).toBe('force_installed')
  })

  it('blocks dangerous URL schemes from being navigated to', () => {
    const blocked = policies.policies.WebsiteFilter?.Block ?? []
    expect(blocked).toContain('file://*/*')
    expect(blocked).toContain('ftp://*/*')
    expect(policies.policies.WebsiteFilter?.Exceptions).toEqual([])
  })

  it('blocks extension installation and prevents removing uBlock Origin', () => {
    expect(policies.policies.ExtensionSettings['*'].installation_mode).toBe('blocked')
    expect(policies.policies.InstallAddonsPermission.Default).toBe(false)
    expect(policies.policies.InstallAddonsPermission.Allow).toEqual([])
    expect(policies.policies.Extensions.Locked).toContain('uBlock0@raymondhill.net')
  })

  it('blocks about:config, the add-ons manager and developer tools', () => {
    expect(policies.policies.BlockAboutConfig).toBe(true)
    expect(policies.policies.BlockAboutAddons).toBe(true)
    expect(policies.policies.BlockAboutProfiles).toBe(true)
    expect(policies.policies.BlockAboutSupport).toBe(true)
    expect(policies.policies.DisableDeveloperTools).toBe(true)
    expect(policies.policies.DisableSecurityBypass).toBe(true)
  })
})

describe('session and privilege boundary', () => {
  it('never gives the daily user administrative groups', () => {
    expect(firstboot).toMatch(/for group in wheel sudo admin/)
    expect(firstboot).toContain('gpasswd --delete "$SENIOR_USER" "$group"')
    expect(firstboot).not.toMatch(/usermod[^\n]*--groups[^\n]*wheel/)
    expect(firstboot).not.toMatch(/usermod[^\n]*--groups[^\n]*sudo/)
  })

  it('grants only the hardware groups needed for sound, print and brightness', () => {
    expect(firstboot).toContain('for group in video audio lp')
    expect(firstboot).toContain('usermod --append --groups')
  })

  it('has no terminal shortcut or desktop right-click menu', () => {
    expect(rc).toContain('<context name="Desktop">')
    expect(rc).toContain('<context name="Root">')
    expect(rc).not.toContain('<action name="Execute"')
    expect(rc).not.toContain('ShowMenu')
    expect(rc).not.toContain('command="foot"')
    expect(rc).toContain('<keybind key="A-Return">')
    expect(rc).toContain('<keybind key="C-A-t">')
    // Right-click is bound only to empty Press/Click actions: no root menu.
    const rightClicks = [...rc.matchAll(/<mousebind button="Right"([^>]*)\/>/g)]
    expect(rightClicks.length).toBeGreaterThan(0)
    for (const [, attrs] of rightClicks) {
      expect(attrs).toMatch(/action="(Press|Click)"/)
    }
    expect(rc).toContain('<cornerRange>0</cornerRange>')
  })
})

describe('family contacts and photo frame boundary', () => {
  it('keeps contacts and avatars inside the SimpleOS config directory', () => {
    expect(main).toContain("path.join(simpleosConfigDir(), 'contacts.json')")
    expect(main).toContain("path.join(simpleosConfigDir(), 'avatars')")
    expect(main).toContain('writeJsonAtomically(contactsPath()')
    expect(main).toContain('mode: 0o600')
    expect(main).toContain("path.basename(fileName)")
    expect(main).toContain("path.join(os.homedir(), 'Pictures', 'SimpleOS')")
  })

  it('validates every contact and video room before use', () => {
    expect(main).toContain('function isContact')
    expect(main).toContain('isAllowedVideoRoom(item.roomUrl)')
    expect(main).toContain('const MAX_CONTACTS = 4')
    expect(main).toContain('const MAX_FRAME_PHOTOS = 12')
    expect(main).toContain("fail('INVALID_INPUT')")
  })

  it('opens a chosen room only after the host check passes', () => {
    expect(main).toContain("'simpleos:contacts:call'")
    expect(preload).toContain("callContact: (roomUrl) => ipcRenderer.invoke('simpleos:contacts:call', roomUrl)")
    expect(main).toContain("spawnDetached('flatpak', ['run', 'org.mozilla.firefox', '--new-window', roomUrl])")
  })
})

describe('local voice boundary', () => {
  it('exposes only fixed local voice IPC channels', () => {
    expect(preload).toContain("speakLocally: (text) => ipcRenderer.invoke('simpleos:voice:speak', text)")
    expect(preload).toContain("stopLocalSpeech: () => ipcRenderer.invoke('simpleos:voice:stop')")
    expect(preload).toContain(
      "transcribeAudio: (audioBase64) => ipcRenderer.invoke('simpleos:voice:transcribe', audioBase64)",
    )
    for (const channel of ['simpleos:voice:speak', 'simpleos:voice:stop', 'simpleos:voice:transcribe']) {
      expect(main).toContain(channel)
    }
  })

  it('sends audio and text only to offline local commands', () => {
    expect(allowlists).toContain('VOICE_COMMANDS')
    expect(allowlists).toContain("command: 'ffmpeg'")
    expect(allowlists).toContain("command: 'python3'")
    expect(allowlists).toContain("command: 'espeak-ng'")
    expect(main).not.toContain('fetch(')
    expect(main).not.toContain('https://')
    expect(main).not.toContain('webkitSpeechRecognition')
  })

  it('bounds and sanitizes renderer-supplied voice data', () => {
    expect(main).toContain('const MAX_SPEECH_CHARS = 400')
    expect(main).toContain('const MAX_AUDIO_BASE64 = 2 * 1024 * 1024')
    expect(main).toContain('function sanitizeSpeechText')
    expect(main).toContain('function voiceArgs')
    expect(main).toContain("mode: 0o600")
    expect(main).toContain("fail('VOICE_UNAVAILABLE')")
  })
})

describe('caregiver PIN cooldown', () => {
  it('is enforced in the main process, not just the UI', () => {
    expect(main).toContain("import { createPinThrottle } from './pin-throttle'")
    expect(main).toContain('const pinThrottle = createPinThrottle()')
    expect(main).toContain("fail('TOO_MANY_TRIES')")
    expect(main).toContain('pinThrottle.recordFailure()')
    expect(main).toContain('pinThrottle.reset()')
  })

  it('applies to both unlock and changing an existing PIN', () => {
    expect(main).toContain("'simpleos:pin:unlock'")
    expect(main).toContain("'simpleos:pin:set'")
    expect(main).toContain('if (record && !pinThrottle.allowed())')
  })

  it('shows a calm message and pauses the button after rapid failures', () => {
    expect(messages).toContain('TOO_MANY_TRIES:')
    expect(pinScreen).toContain("code === 'TOO_MANY_TRIES' ? 30_000 : 1_000")
    expect(pinScreen).toContain('disabled={busy || paused}')
  })
})
