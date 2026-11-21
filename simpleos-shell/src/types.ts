export type LaunchTarget = 'firefox' | 'jitsi' | 'photos' | 'rustdesk'
export type SettingsTarget = 'network' | 'printer'

export type IconName = 'video' | 'web' | 'photos' | 'reminders' | 'help' | 'settings'

export type TileAction =
  | { kind: 'launch'; target: LaunchTarget }
  | { kind: 'view'; view: 'reminders' | 'caregiver' }

export interface LauncherTile {
  id: string
  title: string
  subtitle: string
  icon: IconName
  action: TileAction
}

/** A single daily reminder. `time` is "HH:MM" or "" for "any time". */
export interface Reminder {
  id: string
  text: string
  time: string
  done: boolean
  createdAt: number
}

/** Persisted as one JSON file. `date` lets us reset done flags each new day. */
export interface RemindersFile {
  date: string
  items: Reminder[]
}

export type ErrorCode =
  | 'UNKNOWN_TARGET'
  | 'APP_NOT_FOUND'
  | 'UPDATE_CHECK_FAILED'
  | 'INVALID_INPUT'
  | 'STORAGE_FAILED'
  | 'PIN_INCORRECT'
  | 'PIN_NOT_SET'
  | 'PIN_TOO_SHORT'
  | 'PIN_NOT_NUMERIC'
  | 'PINS_DONT_MATCH'
  | 'BRIDGE_UNAVAILABLE'
  | 'UNEXPECTED'

/** Every IPC call returns a result object; main never sends stack traces. */
export type Result = { ok: true } | { ok: false; code: ErrorCode }
export type ValueResult<T> = { ok: true; value: T } | { ok: false; code: ErrorCode }

/** The only API the preload script is allowed to expose to the renderer. */
export interface SimpleOSBridge {
  launchApp(target: string): Promise<Result>
  loadReminders(): Promise<ValueResult<RemindersFile>>
  saveReminders(payload: RemindersFile): Promise<Result>
  hasPin(): Promise<ValueResult<{ hasPin: boolean }>>
  unlockWithPin(pin: string): Promise<Result>
  setPin(currentPin: string, newPin: string): Promise<Result>
  openSettings(target: string): Promise<Result>
  getUpdateStatus(): Promise<ValueResult<{ summary: string }>>
}
