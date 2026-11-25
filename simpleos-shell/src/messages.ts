import type { ErrorCode } from './types'

/**
 * The only words we show when something goes wrong. The main process sends a
 * short code, never a raw error or terminal output.
 */
export const MESSAGES: Record<ErrorCode, string> = {
  UNKNOWN_TARGET: "We can't open that on this computer.",
  APP_NOT_FOUND: "That app isn't installed yet. Try again in a little while.",
  UPDATE_CHECK_FAILED: "We couldn't check for updates just now. Try again in a few minutes.",
  INVALID_INPUT: "That didn't work. Try again.",
  STORAGE_FAILED: "We couldn't save your reminders. Try again.",
  PIN_INCORRECT: "That PIN isn't right. Try again.",
  PIN_NOT_SET: "No caregiver PIN is set on this computer yet.",
  PIN_REQUIRED: 'Please ask a caregiver to enter their PIN first.',
  PIN_TOO_SHORT: 'Your PIN needs at least 4 numbers.',
  PIN_TOO_LONG: 'Use 12 numbers or fewer for your PIN.',
  PIN_NOT_NUMERIC: 'Use numbers only for your PIN.',
  PINS_DONT_MATCH: "Those two PINs don't match. Try again.",
  BRIDGE_UNAVAILABLE: 'This part works in the SimpleOS desktop app.',
  HARDWARE_UNAVAILABLE: "That control isn't available on this computer.",
  VOICE_UNAVAILABLE: "Voice features aren't available on this computer yet.",
  RECOVERY_FAILED: 'That recovery step could not start. Please try again later.',
  TOO_MANY_TRIES: 'Too many tries. Wait a moment, then try again.',
  UNEXPECTED: 'Something went wrong. Try that again.',
}

export function friendlyMessage(code?: ErrorCode | null): string {
  return code ? MESSAGES[code] ?? MESSAGES.UNEXPECTED : MESSAGES.UNEXPECTED
}
