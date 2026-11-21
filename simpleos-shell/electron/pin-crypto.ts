/*
 * Pure PIN cryptography helpers. Kept free of Electron imports so they can be
 * unit tested directly. The main process owns the only copy of the hash on
 * disk; the renderer only ever sends the PIN string over IPC.
 */
import crypto from 'node:crypto'

export const PIN_MIN_LENGTH = 4
export const PIN_MAX_LENGTH = 12
export const SALT_HEX_LENGTH = 32 // 16 random bytes
export const HASH_HEX_LENGTH = 128 // 64 bytes from scrypt

export function hashPin(pin: string, saltHex: string): string {
  return crypto.scryptSync(pin, Buffer.from(saltHex, 'hex'), 64).toString('hex')
}

/** Constant-time comparison of a submitted PIN against a stored record. */
export function pinsMatch(pin: string, record: { salt: string; hash: string }): boolean {
  const candidate = Buffer.from(hashPin(pin, record.salt), 'hex')
  const expected = Buffer.from(record.hash, 'hex')
  return (
    candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected)
  )
}

export function isValidNewPin(pin: unknown): pin is string {
  return (
    typeof pin === 'string' &&
    pin.length >= PIN_MIN_LENGTH &&
    pin.length <= PIN_MAX_LENGTH &&
    /^\d+$/.test(pin)
  )
}
