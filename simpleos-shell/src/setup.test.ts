import { describe, it, expect } from 'vitest'
import {
  LAST_SETUP_STEP,
  SETUP_STEPS,
  greetingFor,
  initialSetupState,
  isStepValid,
  setupReducer,
  validateContacts,
  validatePin,
  validatePinConfirmation,
  validateReminders,
  validateSeniorName,
} from './setup'
import type { Contact, Reminder } from './types'

const contact = (roomUrl = 'https://meet.jit.si/family'): Contact => ({
  id: 'anna',
  name: 'Anna',
  relationship: 'Daughter',
  avatarFile: null,
  roomUrl,
})

const reminder = (text = 'Take medicine'): Reminder => ({
  id: 'r1',
  text,
  time: '09:00',
  done: false,
  createdAt: 1,
})

describe('setup state', () => {
  it('starts on step one with empty, safe values', () => {
    const state = initialSetupState()
    expect(state).toMatchObject({
      step: 0,
      seniorName: '',
      pin: '',
      confirmPin: '',
      rustdeskId: '',
      contacts: [],
      reminders: [],
    })
    expect(SETUP_STEPS).toHaveLength(5)
    expect(LAST_SETUP_STEP).toBe(4)
  })

  it('stores each field without changing the step', () => {
    let state = initialSetupState()
    state = setupReducer(state, { type: 'name', value: 'Mom' })
    state = setupReducer(state, { type: 'pin', value: '1234' })
    state = setupReducer(state, { type: 'confirmPin', value: '1234' })
    state = setupReducer(state, { type: 'rustdeskId', value: '1234567' })
    state = setupReducer(state, { type: 'contacts', value: [contact()] })
    state = setupReducer(state, { type: 'reminders', value: [reminder()] })
    expect(state).toMatchObject({
      step: 0,
      seniorName: 'Mom',
      pin: '1234',
      confirmPin: '1234',
      rustdeskId: '1234567',
      contacts: [contact()],
      reminders: [reminder()],
    })
  })

  it('refuses to leave step one until there is a name', () => {
    const empty = initialSetupState()
    expect(isStepValid(empty)).toBe(false)
    expect(setupReducer(empty, { type: 'next' }).step).toBe(0)

    const named = setupReducer(empty, { type: 'name', value: '  Mom  ' })
    expect(isStepValid(named)).toBe(true)
    expect(setupReducer(named, { type: 'next' }).step).toBe(1)
  })

  it('refuses to leave step two until the PIN is valid and confirmed', () => {
    const base = { ...initialSetupState(), seniorName: 'Mom', step: 1 }
    const short = setupReducer(base, { type: 'pin', value: '123' })
    expect(setupReducer(short, { type: 'next' }).step).toBe(1)

    const mismatched = setupReducer(setupReducer(base, { type: 'pin', value: '1234' }), {
      type: 'confirmPin',
      value: '4321',
    })
    expect(setupReducer(mismatched, { type: 'next' }).step).toBe(1)

    const matched = setupReducer(mismatched, { type: 'confirmPin', value: '1234' })
    expect(setupReducer(matched, { type: 'next' }).step).toBe(2)
  })

  it('allows the optional steps to be skipped and clamps at both ends', () => {
    const ready = { ...initialSetupState(), seniorName: 'Mom', pin: '1234', confirmPin: '1234' }
    let state = setupReducer(ready, { type: 'next' })
    for (let i = 0; i < 6; i += 1) state = setupReducer(state, { type: 'next' })
    expect(state.step).toBe(LAST_SETUP_STEP)

    for (let i = 0; i < 8; i += 1) state = setupReducer(state, { type: 'back' })
    expect(state.step).toBe(0)
  })
})

describe('setup validation', () => {
  it('accepts a short human name and rejects empty, long or markup names', () => {
    expect(validateSeniorName('Mom')).toBeNull()
    expect(validateSeniorName('Mary Anne')).toBeNull()
    expect(validateSeniorName('  ')).toBe('INVALID_INPUT')
    expect(validateSeniorName('x'.repeat(41))).toBe('INVALID_INPUT')
    expect(validateSeniorName('<script>')).toBe('INVALID_INPUT')
    expect(validateSeniorName(42)).toBe('INVALID_INPUT')
  })

  it('accepts only four to six numeric digits for the wizard PIN', () => {
    expect(validatePin('1234')).toBeNull()
    expect(validatePin('123456')).toBeNull()
    expect(validatePin('123')).toBe('PIN_TOO_SHORT')
    expect(validatePin('1234567')).toBe('PIN_TOO_LONG')
    expect(validatePin('12a4')).toBe('PIN_NOT_NUMERIC')
    expect(validatePin(null)).toBe('PIN_NOT_NUMERIC')
    expect(validatePinConfirmation('1234', '1234')).toBeNull()
    expect(validatePinConfirmation('1234', '4321')).toBe('PINS_DONT_MATCH')
  })

  it('limits contacts to four and requires approved video rooms', () => {
    expect(validateContacts([contact(), contact()])).toBeNull()
    expect(validateContacts(Array.from({ length: 5 }, () => contact()))).toBe('INVALID_INPUT')
    expect(validateContacts([contact('https://evil.example/room')])).toBe('INVALID_INPUT')
    expect(validateContacts([{ ...contact(), name: '  ' }])).toBe('INVALID_INPUT')
  })

  it('limits reminders and requires a time and some text', () => {
    expect(validateReminders([reminder()])).toBeNull()
    expect(validateReminders(Array.from({ length: 9 }, () => reminder()))).toBe('INVALID_INPUT')
    expect(validateReminders([{ ...reminder(), time: '' }])).toBe('INVALID_INPUT')
    expect(validateReminders([reminder('  ')])).toBe('INVALID_INPUT')
  })
})

describe('greetingFor', () => {
  it('uses the right part of the day and the senior name', () => {
    expect(greetingFor('Mom', new Date(2026, 0, 1, 9))).toBe('Good morning, Mom')
    expect(greetingFor('Dad', new Date(2026, 0, 1, 14))).toBe('Good afternoon, Dad')
    expect(greetingFor('Grandma', new Date(2026, 0, 1, 20))).toBe('Good evening, Grandma')
    expect(greetingFor('', new Date(2026, 0, 1, 9))).toBe('Good morning')
  })
})
