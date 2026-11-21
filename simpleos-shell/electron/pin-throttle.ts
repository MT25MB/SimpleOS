/*
 * Pure, dependency-free cooldown for caregiver PIN entry. Kept out of main.ts
 * so the exact lockout behaviour can be unit tested with a fake clock.
 *
 * The limit protects against a stuck button or many rapid accidental presses.
 * It is deliberately in the main process: a modified renderer cannot skip it.
 */
export const PIN_MAX_ATTEMPTS = 5
export const PIN_COOLDOWN_MS = 30_000

export interface PinThrottle {
  /** True while another attempt is permitted. */
  allowed(): boolean
  /** Count one failed attempt; opens the cooldown once the limit is reached. */
  recordFailure(): void
  /** Clear all state after a successful unlock or PIN change. */
  reset(): void
}

export function createPinThrottle(now: () => number = Date.now): PinThrottle {
  let failures = 0
  let cooldownUntil = 0

  return {
    allowed(): boolean {
      return now() >= cooldownUntil
    },
    recordFailure(): void {
      failures += 1
      if (failures >= PIN_MAX_ATTEMPTS) {
        cooldownUntil = now() + PIN_COOLDOWN_MS
        failures = 0
      }
    },
    reset(): void {
      failures = 0
      cooldownUntil = 0
    },
  }
}
