/*
 * First-run setup marker. Kept free of Electron and Node APIs so the validation
 * rules can be unit tested directly. The renderer can only supply a senior name
 * and an optional RustDesk ID; both are strictly validated before anything is
 * written to ~/.config/simpleos.
 */
import path from 'node:path'

export const SETUP_VERSION = 1 as const
export const MAX_SENIOR_NAME = 40
export const MAX_RUSTDESK_ID = 24

/** Written once the caregiver has finished the guided setup. */
export interface SetupCompleteFile {
  version: typeof SETUP_VERSION
  seniorName: string
  rustdeskId: string | null
  /** ISO 8601 timestamp, used only for troubleshooting. */
  completedAt: string
}

/** A short, human first name. No control characters, no markup, no file paths. */
export function isValidSeniorName(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const name = value.trim()
  return (
    name.length > 0 &&
    name.length <= MAX_SENIOR_NAME &&
    /^[^\u0000-\u001f\u007f<>]+$/.test(name)
  )
}

/** RustDesk IDs are numeric; empty means "not written down yet". */
export function isValidRustdeskId(value: unknown): value is string | null {
  if (value === null || value === '') return true
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_RUSTDESK_ID &&
    /^\d+$/.test(value)
  )
}

/** Reject a malformed file rather than treating it as a completed setup. */
export function isSetupCompleteFile(value: unknown): value is SetupCompleteFile {
  if (!value || typeof value !== 'object') return false
  const file = value as Partial<SetupCompleteFile>
  return (
    file.version === SETUP_VERSION &&
    isValidSeniorName(file.seniorName) &&
    isValidRustdeskId(file.rustdeskId) &&
    typeof file.completedAt === 'string' &&
    file.completedAt.length > 0 &&
    Number.isFinite(Date.parse(file.completedAt))
  )
}

/** The only file path this module is allowed to derive. */
export function setupCompletePath(configDir: string): string {
  return path.join(configDir, 'setup-complete.json')
}
