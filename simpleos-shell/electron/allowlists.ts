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
  triggerUpdate: Object.freeze({ command: 'rpm-ostree', args: Object.freeze(['upgrade']) }),
})

export function isAllowedKey(map: Readonly<Record<string, unknown>>, key: unknown): boolean {
  // hasOwnProperty.call works under every TS lib target, including ES2020.
  return typeof key === 'string' && Object.prototype.hasOwnProperty.call(map, key)
}
