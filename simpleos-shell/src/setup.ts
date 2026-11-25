/*
 * First-run wizard state. Pure functions only: no React, no IPC, no storage.
 * Keeping progression and validation here makes every rule testable without a
 * browser and lets the UI stay a thin, calm layer over it.
 */
import { isAllowedVideoRoom } from '../electron/allowlists'
import type { Contact, ErrorCode, Reminder } from './types'

export const SETUP_STEPS = [
  { id: 'name', title: 'A warm name', hint: 'So the computer can greet them by name.' },
  { id: 'pin', title: 'Caregiver PIN', hint: 'Four to six numbers, kept on this computer only.' },
  { id: 'connection', title: 'Internet and sound', hint: 'Check Wi-Fi, speakers and the microphone.' },
  { id: 'people', title: 'Family and reminders', hint: 'Add call cards and, if you like, daily reminders.' },
  { id: 'finish', title: 'Remote help', hint: 'Write down the number a helper will ask for.' },
] as const

export type SetupStepId = (typeof SETUP_STEPS)[number]['id']
export const LAST_SETUP_STEP = SETUP_STEPS.length - 1

export interface SetupState {
  step: number
  seniorName: string
  pin: string
  confirmPin: string
  rustdeskId: string
  contacts: Contact[]
  reminders: Reminder[]
}

export type SetupAction =
  | { type: 'name'; value: string }
  | { type: 'pin'; value: string }
  | { type: 'confirmPin'; value: string }
  | { type: 'rustdeskId'; value: string }
  | { type: 'contacts'; value: Contact[] }
  | { type: 'reminders'; value: Reminder[] }
  | { type: 'next' }
  | { type: 'back' }

export const PIN_MIN_DIGITS = 4
export const PIN_MAX_DIGITS = 6
export const MAX_SETUP_CONTACTS = 4
export const MAX_SETUP_REMINDERS = 8

export function initialSetupState(seniorName = ''): SetupState {
  return {
    step: 0,
    seniorName,
    pin: '',
    confirmPin: '',
    rustdeskId: '',
    contacts: [],
    reminders: [],
  }
}

/** Plain-English-safe: a short name with no controls or markup. */
export function validateSeniorName(value: unknown): ErrorCode | null {
  if (typeof value !== 'string' || value.trim().length === 0 || value.trim().length > 40) {
    return 'INVALID_INPUT'
  }
  if (/[\u0000-\u001f\u007f<>]/.test(value)) return 'INVALID_INPUT'
  return null
}

/** Wizard PINs are deliberately short: 4 to 6 digits, matching the prompt. */
export function validatePin(value: unknown): ErrorCode | null {
  if (typeof value !== 'string') return 'PIN_NOT_NUMERIC'
  if (value.length < PIN_MIN_DIGITS) return 'PIN_TOO_SHORT'
  if (value.length > PIN_MAX_DIGITS) return 'PIN_TOO_LONG'
  if (!/^\d+$/.test(value)) return 'PIN_NOT_NUMERIC'
  return null
}

export function validatePinConfirmation(pin: string, confirm: string): ErrorCode | null {
  if (validatePin(pin) !== null) return validatePin(pin)
  if (pin !== confirm) return 'PINS_DONT_MATCH'
  return null
}

export function validateContacts(value: unknown): ErrorCode | null {
  if (!Array.isArray(value) || value.length > MAX_SETUP_CONTACTS) return 'INVALID_INPUT'
  for (const contact of value as Contact[]) {
    if (!contact || typeof contact !== 'object') return 'INVALID_INPUT'
    if (typeof contact.name !== 'string' || contact.name.trim().length === 0) return 'INVALID_INPUT'
    if (!isAllowedVideoRoom(contact.roomUrl)) return 'INVALID_INPUT'
  }
  return null
}

export function validateReminders(value: unknown): ErrorCode | null {
  if (!Array.isArray(value) || value.length > MAX_SETUP_REMINDERS) return 'INVALID_INPUT'
  for (const item of value as Reminder[]) {
    if (!item || typeof item !== 'object') return 'INVALID_INPUT'
    if (typeof item.text !== 'string' || item.text.trim().length === 0) return 'INVALID_INPUT'
    if (typeof item.time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(item.time)) {
      return 'INVALID_INPUT'
    }
  }
  return null
}

/** A step may only be left when its own information is complete. */
export function isStepValid(state: SetupState, step = state.step): boolean {
  switch (step) {
    case 0:
      return validateSeniorName(state.seniorName) === null
    case 1:
      return validatePinConfirmation(state.pin, state.confirmPin) === null
    default:
      // Connection, people and finish are all optional; a caregiver may skip
      // any of them and still hand the computer over safely.
      return true
  }
}

export function setupReducer(state: SetupState, action: SetupAction): SetupState {
  switch (action.type) {
    case 'name':
      return { ...state, seniorName: action.value }
    case 'pin':
      return { ...state, pin: action.value }
    case 'confirmPin':
      return { ...state, confirmPin: action.value }
    case 'rustdeskId':
      return { ...state, rustdeskId: action.value }
    case 'contacts':
      return { ...state, contacts: action.value }
    case 'reminders':
      return { ...state, reminders: action.value }
    case 'next':
      return isStepValid(state)
        ? { ...state, step: Math.min(LAST_SETUP_STEP, state.step + 1) }
        : state
    case 'back':
      return { ...state, step: Math.max(0, state.step - 1) }
  }
}

/** Time-of-day greeting for the finished home screen. */
export function greetingFor(name: string, now: Date = new Date()): string {
  const hour = now.getHours()
  const part = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'
  const trimmed = name.trim()
  return trimmed ? `Good ${part}, ${trimmed}` : `Good ${part}`
}
