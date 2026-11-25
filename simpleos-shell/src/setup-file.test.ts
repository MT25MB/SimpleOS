import { describe, it, expect } from 'vitest'
import {
  SETUP_VERSION,
  isSetupCompleteFile,
  isValidRustdeskId,
  isValidSeniorName,
  setupCompletePath,
  type SetupCompleteFile,
} from '../electron/setup'

const validFile: SetupCompleteFile = {
  version: SETUP_VERSION,
  seniorName: 'Mom',
  rustdeskId: '123456789',
  completedAt: '2026-11-25T12:00:00.000Z',
}

describe('setup-complete file validation', () => {
  it('uses the documented config file name', () => {
    const target = setupCompletePath('/home/senior/.config/simpleos')
    expect(target.split(/[\\/]/).slice(-1)[0]).toBe('setup-complete.json')
    expect(target).toContain('simpleos')
  })

  it('accepts only short printable names', () => {
    expect(isValidSeniorName('Mom')).toBe(true)
    expect(isValidSeniorName('Mary Anne-O’Neil')).toBe(true)
    expect(isValidSeniorName('')).toBe(false)
    expect(isValidSeniorName('   ')).toBe(false)
    expect(isValidSeniorName('a'.repeat(41))).toBe(false)
    expect(isValidSeniorName('line\nbreak')).toBe(false)
    expect(isValidSeniorName(null)).toBe(false)
  })

  it('accepts a numeric RustDesk ID or nothing at all', () => {
    expect(isValidRustdeskId(null)).toBe(true)
    expect(isValidRustdeskId('')).toBe(true)
    expect(isValidRustdeskId('123456789')).toBe(true)
    expect(isValidRustdeskId('abc')).toBe(false)
    expect(isValidRustdeskId('a'.repeat(25))).toBe(false)
  })

  it('rejects a malformed marker instead of treating it as complete', () => {
    expect(isSetupCompleteFile(validFile)).toBe(true)
    expect(isSetupCompleteFile({ ...validFile, version: 2 })).toBe(false)
    expect(isSetupCompleteFile({ ...validFile, seniorName: '' })).toBe(false)
    expect(isSetupCompleteFile({ ...validFile, rustdeskId: 'oops' })).toBe(false)
    expect(isSetupCompleteFile({ ...validFile, completedAt: 'not a date' })).toBe(false)
    expect(isSetupCompleteFile(null)).toBe(false)
    expect(isSetupCompleteFile({})).toBe(false)
  })
})
