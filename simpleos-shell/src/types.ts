export type LaunchTarget = 'firefox' | 'jitsi' | 'photos' | 'rustdesk'
export type SettingsTarget = 'network' | 'printer'

/**
 * Caregiver/help actions exposed through the single `runAction` IPC method.
 * These are fixed names — never free-form commands from the renderer.
 */
export type CaregiverAction =
  | 'screenShare'
  | 'networkSettings'
  | 'printerSettings'
  | 'checkUpdates'
  | 'triggerUpdate'

/** Fixed keys for the header hardware controls. Never free-form commands. */
export type VolumeAction = 'volumeUp' | 'volumeDown' | 'volumeMute'
export type BrightnessAction = 'brightnessUp' | 'brightnessDown'

/** Wi-Fi state as a short, plain-English value. */
export interface WifiStatus {
  /** False also when Wi-Fi is off or the check could not be completed. */
  connected: boolean
  /** The network name when connected, otherwise null. */
  ssid: string | null
}

/** Battery state read from sysfs. Desktops report present: false. */
export interface BatteryStatus {
  present: boolean
  /** Charge percentage from 0 to 100, or null when unavailable. */
  percent: number | null
  /** True while charging or full, false on battery, null when unknown. */
  charging: boolean | null
}

/** Everything the header needs, gathered in one lightweight IPC call. */
export interface HardwareStatus {
  wifi: WifiStatus
  battery: BatteryStatus
  /** False on desktops and machines without a controllable backlight. */
  brightnessAvailable: boolean
}

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
  | 'PIN_TOO_LONG'
  | 'PIN_NOT_NUMERIC'
  | 'PINS_DONT_MATCH'
  | 'BRIDGE_UNAVAILABLE'
  | 'HARDWARE_UNAVAILABLE'
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
  /** Unified, allowlisted caregiver/help action dispatcher. */
  runAction(action: CaregiverAction): Promise<ValueResult<{ summary?: string }>>
  /** Read-only Wi-Fi, battery and backlight state for the header. */
  getHardwareStatus(): Promise<ValueResult<HardwareStatus>>
  /** Adjust sound using one fixed, allowlisted command. */
  adjustVolume(action: VolumeAction): Promise<Result>
  /** Adjust the screen using one fixed, allowlisted command. */
  adjustBrightness(action: BrightnessAction): Promise<Result>
}
