/*
 * Fixed command allowlists shared by the IPC handlers. Renderer input is only
 * ever used as a key into one of these frozen maps; it never becomes a command,
 * argument, or URL.
 */
export interface ApprovedCommand {
  readonly command: string
  readonly args: readonly string[]
}

export const ALLOWED_APPS: Readonly<Record<string, ApprovedCommand>> = Object.freeze({
  firefox: { command: 'flatpak', args: Object.freeze(['run', 'org.mozilla.firefox']) },
  jitsi: {
    command: 'flatpak',
    args: Object.freeze(['run', 'org.mozilla.firefox', '--new-window', 'https://meet.jit.si']),
  },
  photos: { command: 'flatpak', args: Object.freeze(['run', 'org.gnome.Loupe']) },
  rustdesk: { command: 'flatpak', args: Object.freeze(['run', 'com.rustdesk.RustDesk']) },
})

export const ALLOWED_SETTINGS: Readonly<Record<string, ApprovedCommand>> = Object.freeze({
  network: { command: 'nm-connection-editor', args: Object.freeze([]) },
  printer: { command: 'system-config-printer', args: Object.freeze([]) },
})

export const SAFE_ACTIONS: Readonly<Record<string, ApprovedCommand>> = Object.freeze({
  screenShare: ALLOWED_APPS.rustdesk,
  networkSettings: ALLOWED_SETTINGS.network,
  printerSettings: ALLOWED_SETTINGS.printer,
  checkUpdates: Object.freeze({ command: 'rpm-ostree', args: Object.freeze(['status', '--json']) }),
  triggerUpdate: Object.freeze({
    command: 'systemctl',
    args: Object.freeze(['start', 'simpleos-update.service']),
  }),
})

/**
 * Hardware controls for the header. The renderer may only send one of these
 * fixed keys: it can never supply a command, a percentage, a device path or a
 * network name. `pactl` comes from pulseaudio-utils, `brightnessctl` from the
 * eponymous package, and `nmcli` from NetworkManager.
 */
export const HARDWARE_ACTIONS: Readonly<Record<string, ApprovedCommand>> = Object.freeze({
  volumeUp: Object.freeze({
    command: 'pactl',
    args: Object.freeze(['set-sink-volume', '@DEFAULT_SINK@', '+5%']),
  }),
  volumeDown: Object.freeze({
    command: 'pactl',
    args: Object.freeze(['set-sink-volume', '@DEFAULT_SINK@', '-5%']),
  }),
  volumeMute: Object.freeze({
    command: 'pactl',
    args: Object.freeze(['set-sink-mute', '@DEFAULT_SINK@', 'toggle']),
  }),
  brightnessUp: Object.freeze({ command: 'brightnessctl', args: Object.freeze(['set', '+10%']) }),
  brightnessDown: Object.freeze({ command: 'brightnessctl', args: Object.freeze(['set', '10%-']) }),
})

/**
 * Local voice commands. The `{path}` placeholders are replaced in the main
 * process with paths it creates itself; renderer input only ever supplies a
 * bounded audio buffer or a sanitized line of text. There is no network call
 * and no cloud speech service anywhere in this list.
 */
export const VOICE_COMMANDS: Readonly<Record<string, ApprovedCommand>> = Object.freeze({
  toWav: Object.freeze({
    command: 'ffmpeg',
    args: Object.freeze([
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-i',
      '{path}',
      '-ar',
      '16000',
      '-ac',
      '1',
      '-c:a',
      'pcm_s16le',
      '{path}',
    ]),
  }),
  recognize: Object.freeze({
    command: 'python3',
    args: Object.freeze(['/usr/libexec/simpleos/transcribe.py', '{path}']),
  }),
  speak: Object.freeze({ command: 'espeak-ng', args: Object.freeze(['-f', '{path}']) }),
})

/** Fixed commands used by the caregiver health and recovery panel. */
export const HEALTH_COMMANDS: Readonly<Record<string, ApprovedCommand>> = Object.freeze({
  sources: Object.freeze({ command: 'pactl', args: Object.freeze(['list', 'short', 'sources']) }),
  rollback: Object.freeze({
    command: 'systemctl',
    args: Object.freeze(['start', 'simpleos-rollback.service']),
  }),
})

/** Power actions exposed in the header. Only these two fixed commands exist. */
export const POWER_COMMANDS: Readonly<Record<string, ApprovedCommand>> = Object.freeze({
  restartComputer: Object.freeze({ command: 'systemctl', args: Object.freeze(['reboot']) }),
  shutdownComputer: Object.freeze({ command: 'systemctl', args: Object.freeze(['poweroff']) }),
})

/** Fixed, read-only commands used to build the header status strip. */
export const HARDWARE_STATUS: Readonly<Record<string, ApprovedCommand>> = Object.freeze({
  wifi: Object.freeze({
    command: 'nmcli',
    args: Object.freeze(['--terse', '--fields', 'TYPE,STATE,CONNECTION', 'device', 'status']),
  }),
  audio: Object.freeze({ command: 'pactl', args: Object.freeze(['get-default-sink']) }),
  rustdesk: Object.freeze({
    command: 'flatpak',
    args: Object.freeze(['info', 'com.rustdesk.RustDesk']),
  }),
})

/**
 * Family video rooms are restricted to known HTTPS hosts. A caregiver cannot
 * accidentally store a look-alike or scam site as a "Call Now" destination.
 */
export const VIDEO_ROOM_HOSTS: readonly string[] = Object.freeze([
  'meet.jit.si',
  'jitsi.org',
  '8x8.vc',
])

export function isAllowedVideoRoom(raw: unknown): raw is string {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 500) return false
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' || url.username || url.password) return false
    const host = url.hostname.toLowerCase()
    const allowed = VIDEO_ROOM_HOSTS.some(
      (candidate) => host === candidate || host.endsWith(`.${candidate}`),
    )
    return allowed
  } catch {
    return false
  }
}

export function isAllowedKey(map: Readonly<Record<string, unknown>>, key: unknown): boolean {
  // hasOwnProperty.call works under every TS lib target, including ES2020.
  return typeof key === 'string' && Object.prototype.hasOwnProperty.call(map, key)
}
