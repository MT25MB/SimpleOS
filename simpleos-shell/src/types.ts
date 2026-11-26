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
  /** True for Wi-Fi or wired Ethernet connections. */
  connected: boolean
  /** The network or connection name when connected, otherwise null. */
  ssid: string | null
  /** Which kind of connection is up, when the main process reports it. */
  kind?: 'wifi' | 'ethernet' | null
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
  /** True when PipeWire exposes a default audio sink. */
  audioAvailable: boolean
  /** True when the RustDesk flatpak is installed. */
  rustdeskAvailable: boolean
}

/** The only actions local voice input is allowed to trigger. */
export type VoiceAction =
  | 'openVideoCall'
  | 'openInternet'
  | 'readReminders'
  | 'askForHelp'
  | 'goHome'

export type IconName = 'video' | 'web' | 'photos' | 'reminders' | 'help' | 'settings'

export type TileAction =
  | { kind: 'launch'; target: LaunchTarget }
  | { kind: 'view'; view: 'reminders' | 'caregiver' | 'family' }

/** A caregiver-managed family contact. Stored only in ~/.config/simpleos. */
export interface Contact {
  id: string
  name: string
  relationship: string
  /** Filename of a locally stored, resized avatar, or null for initials. */
  avatarFile: string | null
  /** An https URL on an approved video host. */
  roomUrl: string
}

export interface ContactsFile {
  contacts: Contact[]
}

export type FrameDelay = 0 | 2 | 5 | 10 | 15

/** Plain-English system health values. No file paths, names or PINs. */
export interface HealthStatus {
  internet: string
  audio: string
  microphone: string
  disk: string
  imageVersion: string
  lastUpdateCheck: string
  /** A short, privacy-safe report suitable for a GitHub issue. */
  summary: string
}

export type RecoveryAction = 'restartLauncher' | 'rollBack'

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
  | 'PIN_REQUIRED'
  | 'PIN_TOO_SHORT'
  | 'PIN_TOO_LONG'
  | 'PIN_NOT_NUMERIC'
  | 'PINS_DONT_MATCH'
  | 'BRIDGE_UNAVAILABLE'
  | 'HARDWARE_UNAVAILABLE'
  | 'VOICE_UNAVAILABLE'
  | 'RECOVERY_FAILED'
  | 'TOO_MANY_TRIES'
  | 'UNEXPECTED'

/** Every IPC call returns a result object; main never sends stack traces. */
export type Result = { ok: true } | { ok: false; code: ErrorCode }
export type ValueResult<T> = { ok: true; value: T } | { ok: false; code: ErrorCode }

/** Result of the read-only first-run check. No file path crosses the bridge. */
export interface SetupStatus {
  complete: boolean
  /** The name saved at the end of the wizard, when there is one. */
  seniorName: string | null
  /** A public remote-help ID, never a credential. */
  rustdeskId: string | null
}

/** The only API the preload script is allowed to expose to the renderer. */
export interface SimpleOSBridge {
  launchApp(target: string): Promise<Result>
  loadReminders(): Promise<ValueResult<RemindersFile>>
  saveReminders(payload: RemindersFile): Promise<Result>
  hasPin(): Promise<ValueResult<{ hasPin: boolean }>>
  unlockWithPin(pin: string): Promise<Result>
  setPin(currentPin: string, newPin: string): Promise<Result>
  getSetupStatus(): Promise<ValueResult<SetupStatus>>
  completeSetup(seniorName: string, rustdeskId: string): Promise<Result>
  openSettings(target: string): Promise<Result>
  /** Close the external Wi-Fi/printer settings app and return to the kiosk. */
  closeSettings(): Promise<Result>
  getUpdateStatus(): Promise<ValueResult<{ summary: string }>>
  /** Unified, allowlisted caregiver/help action dispatcher. */
  runAction(action: CaregiverAction): Promise<ValueResult<{ summary?: string }>>
  /** Read-only Wi-Fi, battery and backlight state for the header. */
  getHardwareStatus(): Promise<ValueResult<HardwareStatus>>
  /** Adjust sound using one fixed, allowlisted command. */
  adjustVolume(action: VolumeAction): Promise<Result>
  /** Adjust the screen using one fixed, allowlisted command. */
  adjustBrightness(action: BrightnessAction): Promise<Result>
  /** Local TTS fallback used only when no local Web Speech voice exists. */
  speakLocally(text: string): Promise<Result>
  /** Stop any in-flight local speech process. */
  stopLocalSpeech(): Promise<Result>
  /**
   * Transcribe a short local audio recording. The buffer never leaves this
   * machine: it is written to a temp file and read by the offline Vosk model.
   */
  transcribeAudio(audioBase64: string): Promise<ValueResult<{ text: string }>>
  /** Caregiver-managed family contacts and their private video rooms. */
  loadContacts(): Promise<ValueResult<ContactsFile>>
  saveContacts(payload: ContactsFile): Promise<Result>
  /** Save a resized local avatar; returns the filename to store in the contact. */
  saveAvatar(fileName: string, imageBase64: string): Promise<ValueResult<{ fileName: string }>>
  getAvatar(fileName: string): Promise<ValueResult<{ dataUrl: string }>>
  callContact(roomUrl: string): Promise<Result>
  /** Bounded list of local photos for the calm idle frame. */
  getFramePhotos(): Promise<ValueResult<{ photos: string[] }>>
  getHealthStatus(): Promise<ValueResult<HealthStatus>>
  runRecovery(action: RecoveryAction): Promise<ValueResult<{ summary: string }>>
}
