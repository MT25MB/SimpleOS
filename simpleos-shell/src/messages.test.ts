import { describe, it, expect } from 'vitest'
import { MESSAGES, friendlyMessage } from './messages'
import type { ErrorCode } from './types'

const CODES = Object.keys(MESSAGES) as ErrorCode[]

describe('friendlyMessage', () => {
  it.each(CODES)('maps %s to a non-empty plain-English message', (code) => {
    const message = friendlyMessage(code)
    expect(message.trim().length).toBeGreaterThan(0)
  })

  it('never leaks technical jargon or stack traces', () => {
    const forbidden = /\b(Error|Exception|stack|undefined|null|ECONN|ERESOLVE|at\s+\w+\s+\()/i
    for (const code of CODES) {
      expect(friendlyMessage(code)).not.toMatch(forbidden)
    }
  })

  it('falls back to a calm generic message for unknown or missing codes', () => {
    expect(friendlyMessage(undefined)).toBe(MESSAGES.UNEXPECTED)
    expect(friendlyMessage(null)).toBe(MESSAGES.UNEXPECTED)
    expect(friendlyMessage('NOT_A_REAL_CODE' as ErrorCode)).toBe(MESSAGES.UNEXPECTED)
  })
})
