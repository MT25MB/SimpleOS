import { describe, it, expect } from 'vitest'
import crypto from 'node:crypto'
import {
  HASH_HEX_LENGTH,
  PIN_MAX_LENGTH,
  PIN_MIN_LENGTH,
  SALT_HEX_LENGTH,
  hashPin,
  isValidNewPin,
  pinsMatch,
} from '../electron/pin-crypto'

describe('PIN cryptography', () => {
  const salt = crypto.randomBytes(16).toString('hex')
  const record = { salt, hash: hashPin('1234', salt) }

  it('hashes with scrypt to a fixed-length hex digest', () => {
    expect(salt).toHaveLength(SALT_HEX_LENGTH)
    expect(record.hash).toHaveLength(HASH_HEX_LENGTH)
    expect(record.hash).toMatch(/^[0-9a-f]{128}$/)
  })

  it('verifies the correct PIN and rejects a wrong one', () => {
    expect(pinsMatch('1234', record)).toBe(true)
    expect(pinsMatch('9999', record)).toBe(false)
    expect(pinsMatch('12345', record)).toBe(false)
  })

  it('produces a different hash for a different salt', () => {
    const otherSalt = crypto.randomBytes(16).toString('hex')
    const other = { salt: otherSalt, hash: hashPin('1234', otherSalt) }
    expect(other.hash).not.toBe(record.hash)
    expect(pinsMatch('1234', other)).toBe(true)
    expect(pinsMatch('1234', { ...other, hash: record.hash })).toBe(false)
  })

  it('survives a malformed stored hash without throwing', () => {
    expect(pinsMatch('1234', { salt, hash: 'zz' })).toBe(false)
    expect(pinsMatch('1234', { salt: 'xx', hash: record.hash })).toBe(false)
  })

  it('accepts only 4 to 12 digit PINs', () => {
    expect(PIN_MIN_LENGTH).toBe(4)
    expect(PIN_MAX_LENGTH).toBe(12)
    expect(isValidNewPin('1234')).toBe(true)
    expect(isValidNewPin('000000000000')).toBe(true)
    expect(isValidNewPin('123')).toBe(false)
    expect(isValidNewPin('1234567890123')).toBe(false)
    expect(isValidNewPin('12ab')).toBe(false)
    expect(isValidNewPin(1234)).toBe(false)
    expect(isValidNewPin(null)).toBe(false)
  })
})
