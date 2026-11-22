import { describe, it, expect } from 'vitest'
import { VOICE_ACTIONS, VOICE_ACTION_LABELS, matchVoiceAction } from './voiceActions'

describe('offline voice command matching', () => {
  it('maps each spoken phrase to exactly one allowlisted action', () => {
    expect(matchVoiceAction('open video call')).toBe('openVideoCall')
    expect(matchVoiceAction('call the family')).toBe('openVideoCall')
    expect(matchVoiceAction('open the internet')).toBe('openInternet')
    expect(matchVoiceAction('web browser')).toBe('openInternet')
    expect(matchVoiceAction('read my reminders')).toBe('readReminders')
    expect(matchVoiceAction('ask for help')).toBe('askForHelp')
    expect(matchVoiceAction('go home')).toBe('goHome')
  })

  it('ignores control characters and never returns arbitrary text', () => {
    expect(matchVoiceAction('\u0000go home\u007f')).toBe('goHome')
    expect(matchVoiceAction('delete all my files')).toBeNull()
    expect(matchVoiceAction('')).toBeNull()
  })

  it('exposes only five fixed action names and plain-English labels', () => {
    expect(VOICE_ACTIONS).toEqual([
      'openVideoCall',
      'openInternet',
      'readReminders',
      'askForHelp',
      'goHome',
    ])
    for (const action of VOICE_ACTIONS) {
      expect(VOICE_ACTION_LABELS[action]).toMatch(/^[A-Z]/)
    }
  })
})
