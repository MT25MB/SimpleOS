import type { Page } from '@playwright/test'

export interface E2EConfig {
  /** A fresh computer shows the wizard; an existing one shows the home grid. */
  setupComplete?: boolean
  seniorName?: string | null
  pin?: string
  scale?: number
  frameDelay?: number
  photos?: string[]
  reminders?: unknown
  contacts?: unknown
  /** Text returned by the mocked offline Vosk transcription. */
  transcript?: string
}

const DEFAULT_CONFIG: Required<Omit<E2EConfig, 'scale'>> & { scale: number } = {
  setupComplete: true,
  seniorName: null,
  pin: '1234',
  frameDelay: 0,
  photos: [],
  reminders: { date: '', items: [] },
  contacts: { contacts: [] },
  transcript: 'open video call',
}

/**
 * The Electron bridge does not exist in a plain browser. Install a deterministic,
 * local-only stand-in before the app loads so the real React journeys run in
 * Chromium. All state lives in localStorage; nothing leaves the page.
 */
export async function openApp(page: Page, config: E2EConfig = {}): Promise<void> {
  const resolved = { ...DEFAULT_CONFIG, ...config }
  await page.addInitScript((cfg) => {
    const key = (name: string) => `e2e.${name}`
    const read = (name: string, fallback: unknown) => {
      try {
        const raw = window.localStorage.getItem(key(name))
        return raw === null ? fallback : JSON.parse(raw)
      } catch {
        return fallback
      }
    }
    const write = (name: string, value: unknown) => {
      try {
        window.localStorage.setItem(key(name), JSON.stringify(value))
      } catch {
        // Storage is optional in this harness.
      }
    }
    const log = (name: string, detail?: unknown) => {
      const events = read('log', []) as Array<{ name: string; detail?: unknown }>
      write('log', [...events, { name, detail }])
    }
    const ok = { ok: true }
    const fail = (code: string) => ({ ok: false, code })

    try {
      window.localStorage.setItem('simpleos.fontScale', String(cfg.scale))
      window.localStorage.setItem('simpleos.frameDelay', String(cfg.frameDelay))
      if (!window.localStorage.getItem('e2e.setup')) {
        write('setup', { complete: cfg.setupComplete, seniorName: cfg.seniorName })
      }
      if (cfg.pin && !window.localStorage.getItem('e2e.pin')) {
        window.localStorage.setItem('e2e.pin', cfg.pin)
      }
      if (!window.localStorage.getItem('e2e.photos')) write('photos', cfg.photos)
      if (!window.localStorage.getItem('e2e.reminders')) write('reminders', cfg.reminders)
      if (!window.localStorage.getItem('e2e.contacts')) write('contacts', cfg.contacts)
    } catch {
      // The app still renders if storage is blocked.
    }

    const bridge = {
      launchApp: async (target: string) => {
        log('launchApp', target)
        return ok
      },
      loadReminders: async () => ({ ok: true, value: read('reminders', { date: '', items: [] }) }),
      saveReminders: async (payload: unknown) => {
        write('reminders', payload)
        return ok
      },
      hasPin: async () => ({ ok: true, value: { hasPin: Boolean(window.localStorage.getItem('e2e.pin')) } }),
      unlockWithPin: async (pin: string) =>
        pin === window.localStorage.getItem('e2e.pin') ? ok : fail('PIN_INCORRECT'),
      setPin: async (current: string, next: string) => {
        const existing = window.localStorage.getItem('e2e.pin')
        if (existing && current !== existing) return fail('PIN_INCORRECT')
        window.localStorage.setItem('e2e.pin', next)
        log('setPin', next)
        return ok
      },
      getSetupStatus: async () => ({
        ok: true,
        value: {
          ...read('setup', { complete: true, seniorName: null }),
          rustdeskId: read('rustdeskId', null),
        },
      }),
      completeSetup: async (seniorName: string, rustdeskId: string) => {
        write('setup', { complete: true, seniorName })
        write('rustdeskId', rustdeskId)
        return ok
      },
      openSettings: async () => ok,
      closeSettings: async () => ok,
      getUpdateStatus: async () => ({ ok: true, value: { summary: 'Your system is up to date.' } }),
      runAction: async (action: string) => {
        log('runAction', action)
        return { ok: true, value: {} }
      },
      getHardwareStatus: async () => ({
        ok: true,
        value: {
          wifi: { connected: true, ssid: 'Home Network' },
          battery: { present: false, percent: null, charging: null },
          brightnessAvailable: false,
          audioAvailable: true,
          rustdeskAvailable: true,
        },
      }),
      adjustVolume: async () => ok,
      adjustBrightness: async () => ok,
      speakLocally: async (text: string) => {
        log('speak', text)
        return ok
      },
      stopLocalSpeech: async () => ok,
      transcribeAudio: async () => ({ ok: true, value: { text: cfg.transcript } }),
      loadContacts: async () => ({ ok: true, value: read('contacts', { contacts: [] }) }),
      saveContacts: async (payload: unknown) => {
        write('contacts', payload)
        log('saveContacts', payload)
        return ok
      },
      saveAvatar: async () => ({ ok: true, value: { fileName: 'avatar-a.png' } }),
      getAvatar: async () => ({ ok: true, value: { dataUrl: '' } }),
      callContact: async (roomUrl: string) => {
        log('callContact', roomUrl)
        return ok
      },
      getFramePhotos: async () => ({ ok: true, value: { photos: read('photos', []) } }),
      getHealthStatus: async () => ({
        ok: true,
        value: {
          internet: 'Connected to the internet.',
          audio: 'Sound output is ready.',
          microphone: 'Microphone is ready.',
          disk: 'Disk space is healthy: 20 GB free',
          imageVersion: 'SimpleOS 1.4.4',
          lastUpdateCheck: 'Last checked today',
          summary: 'SimpleOS health summary',
        },
      }),
      runRecovery: async () => ({ ok: true, value: { summary: 'Done.' } }),
    }

    // Force the local espeak fallback so read-aloud is observable in the log.
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: { getVoices: () => [], speak: () => undefined, cancel: () => undefined },
    })
    Object.defineProperty(window, 'simpleOS', { configurable: true, value: bridge })
  }, resolved)
  await page.goto('/')
}

/** Read the mocked call log from the page. */
export async function events(page: Page): Promise<Array<{ name: string; detail?: unknown }>> {
  return (await page.evaluate(() => {
    const raw = window.localStorage.getItem('e2e.log')
    return raw ? JSON.parse(raw) : []
  })) as Array<{ name: string; detail?: unknown }>
}
