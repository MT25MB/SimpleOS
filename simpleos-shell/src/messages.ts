import type { ErrorCode } from './types'

/**
 * The ONLY words shown to the user for errors. Main-process errors arrive as
 * short codes, never as raw exceptions or terminal output.
 */
export const MESSAGES: Record<ErrorCode, string> = {
  UNKNOWN_TARGET: 'That option is not available on this computer.',
  APP_NOT_FOUND: 'That app is not installed yet. Please try again later.',
  UPDATE_CHECK_FAILED: "We couldn't check for updates right now. Please try again later.",
  INVALID_INPUT: 'Something was not right. Please try again.',
  STORAGE_FAILED: 'We could not save your reminders. Please try again.',
  PIN_INCORRECT: 'That PIN is not correct. Please try again.',
  PIN_NOT_SET: 'No caregiver PIN has been set yet.',
  PIN_TOO_SHORT: 'Please choose a PIN with at least 4 numbers.',
  PIN_NOT_NUMERIC: 'Please use only numbers for your PIN.',
  PINS_DONT_MATCH: 'The two PINs do not match. Please try again.',
  BRIDGE_UNAVAILABLE: 'This feature works in the SimpleOS desktop app.',
  UNEXPECTED: 'Something went wrong. Please try again.',
}

export function friendlyMessage(code?: ErrorCode | null): string {
  return code ? MESSAGES[code] ?? MESSAGES.UNEXPECTED : MESSAGES.UNEXPECTED
}
