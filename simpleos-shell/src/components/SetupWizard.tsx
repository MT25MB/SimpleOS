import { useEffect, useReducer, useRef, useState } from 'react'
import { isAllowedVideoRoom } from '../../electron/allowlists'
import { useMicCheck } from '../hooks/useMicCheck'
import type { FontScale } from '../hooks/useFontScale'
import { friendlyMessage } from '../messages'
import {
  LAST_SETUP_STEP,
  MAX_SETUP_CONTACTS,
  SETUP_STEPS,
  initialSetupState,
  isStepValid,
  setupReducer,
  validatePinConfirmation,
} from '../setup'
import type { Contact, ErrorCode, Reminder, WifiStatus } from '../types'
import { FontScaleControl } from './FontScaleControl'

export interface SetupWizardResult {
  seniorName: string
  rustdeskId: string
  contacts: Contact[]
  reminders: Reminder[]
}

interface SetupWizardProps {
  initialName?: string
  scale: FontScale
  onScaleChange: (value: FontScale) => void
  onFinish: (result: SetupWizardResult) => Promise<void>
  /** Only provided when a caregiver re-runs the wizard from Settings. */
  onCancel?: () => void
}

const DEFAULT_WIFI: WifiStatus = { connected: false, ssid: null }

function newContact(): Contact {
  const id = Math.random().toString(36).slice(2, 12)
  return { id, name: '', relationship: '', avatarFile: null, roomUrl: '' }
}

/** Calm, full-screen first-run flow. Every step can be revisited with Back. */
export function SetupWizard({
  initialName = '',
  scale,
  onScaleChange,
  onFinish,
  onCancel,
}: SetupWizardProps) {
  const [state, dispatch] = useReducer(setupReducer, initialSetupState(initialName))
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [error, setError] = useState<ErrorCode | null>(null)
  const [busy, setBusy] = useState(false)
  const [wifi, setWifi] = useState<WifiStatus>(DEFAULT_WIFI)
  const [soundMessage, setSoundMessage] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactRoom, setContactRoom] = useState('')
  const [reminderText, setReminderText] = useState('')
  const [reminderTime, setReminderTime] = useState('09:00')
  const [rustdeskMessage, setRustdeskMessage] = useState('')
  const mic = useMicCheck()
  const step = SETUP_STEPS[state.step]

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  useEffect(() => {
    if (state.step !== 2) return
    const bridge = window.simpleOS
    if (!bridge) return
    void bridge.getHardwareStatus().then((result) => {
      if (result.ok) setWifi(result.value.wifi)
    })
  }, [state.step])

  function go(next: 'next' | 'back') {
    setError(null)
    if (next === 'next' && !isStepValid(state)) {
      setError(
        state.step === 0 ? 'INVALID_INPUT' : validatePinConfirmation(state.pin, state.confirmPin),
      )
      return
    }
    dispatch({ type: next })
  }

  async function playChime() {
    const bridge = window.simpleOS
    if (!bridge) {
      setSoundMessage(friendlyMessage('BRIDGE_UNAVAILABLE'))
      return
    }
    const result = await bridge.speakLocally(
      'This is the sound test. If you can hear me, the sound is working.',
    )
    setSoundMessage(result.ok ? 'You should have heard a short voice message.' : friendlyMessage(result.code))
  }

  async function refreshWifi() {
    const bridge = window.simpleOS
    if (!bridge) return
    const result = await bridge.getHardwareStatus()
    if (result.ok) setWifi(result.value.wifi)
  }

  async function openWifi() {
    const bridge = window.simpleOS
    if (!bridge) return
    const result = await bridge.runAction('networkSettings')
    if (!result.ok) setError(result.code)
  }

  function addContact() {
    const roomUrl = contactRoom.trim()
    if (!contactName.trim() || !isAllowedVideoRoom(roomUrl)) {
      setError('INVALID_INPUT')
      return
    }
    setError(null)
    const contact: Contact = {
      ...newContact(),
      name: contactName.trim(),
      relationship: '',
      roomUrl,
    }
    dispatch({ type: 'contacts', value: [...state.contacts, contact] })
    setContactName('')
    setContactRoom('')
  }

  function addReminder() {
    if (!reminderText.trim() || !/^([01]\d|2[0-3]):[0-5]\d$/.test(reminderTime)) {
      setError('INVALID_INPUT')
      return
    }
    setError(null)
    const item: Reminder = {
      id: `setup-${Date.now()}`,
      text: reminderText.trim(),
      time: reminderTime,
      done: false,
      createdAt: Date.now(),
    }
    dispatch({ type: 'reminders', value: [...state.reminders, item] })
    setReminderText('')
  }

  async function openRustdesk() {
    const bridge = window.simpleOS
    if (!bridge) return
    const result = await bridge.launchApp('rustdesk')
    setRustdeskMessage(
      result.ok
        ? 'RustDesk is opening. Write down the ID and password it shows.'
        : friendlyMessage(result.code),
    )
  }

  async function finish() {
    setBusy(true)
    setError(null)
    try {
      const bridge = window.simpleOS
      if (!bridge) {
        setError('BRIDGE_UNAVAILABLE')
        return
      }
      // A first run must create the PIN before any caregiver screen is reachable.
      // A re-run keeps the existing PIN; it is changed in Caregiver Settings.
      const existing = await bridge.hasPin()
      if (!existing.ok) {
        setError(existing.code)
        return
      }
      if (!existing.value.hasPin) {
        const saved = await bridge.setPin('', state.pin)
        if (!saved.ok) {
          setError(saved.code)
          return
        }
      }
      await onFinish({
        seniorName: state.seniorName.trim(),
        rustdeskId: state.rustdeskId.trim(),
        contacts: state.contacts,
        reminders: state.reminders,
      })
    } catch {
      setError('STORAGE_FAILED')
    } finally {
      setBusy(false)
    }
  }

  const canGoBack = state.step > 0 && Boolean(onCancel)

  return (
    <dialog
      className="setup-wizard"
      ref={dialogRef}
      aria-labelledby="setup-title"
      onCancel={(event) => {
        if (!onCancel) event.preventDefault()
        else onCancel()
      }}
    >
      <div className="setup-wizard__card">
        <p className="setup-wizard__progress">
          Step {state.step + 1} of {SETUP_STEPS.length}
        </p>
        <h1 id="setup-title">{step.title}</h1>
        <p className="setup-wizard__intro">{step.hint}</p>

        {state.step === 0 && (
          <div className="setup-wizard__body">
            <label htmlFor="setup-senior-name">First name</label>
            <input
              id="setup-senior-name"
              value={state.seniorName}
              maxLength={40}
              placeholder="Mom, Dad, Grandma…"
              onChange={(event) => dispatch({ type: 'name', value: event.target.value })}
            />
            <p className="panel__note">
              We will use this for a warm greeting, like “Good morning, {state.seniorName.trim() || 'Mom'}”.
            </p>
            <FontScaleControl value={scale} onChange={onScaleChange} />
            <p className="panel__note">Normal 18px · Large 22px · Extra Large 26px.</p>
          </div>
        )}

        {state.step === 1 && (
          <div className="setup-wizard__body">
            <label htmlFor="setup-pin">New PIN (4 to 6 numbers)</label>
            <input
              id="setup-pin"
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={state.pin}
              onChange={(event) => dispatch({ type: 'pin', value: event.target.value })}
            />
            <label htmlFor="setup-pin-confirm">Enter it again</label>
            <input
              id="setup-pin-confirm"
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={state.confirmPin}
              onChange={(event) => dispatch({ type: 'confirmPin', value: event.target.value })}
            />
            <p className="panel__note">
              This PIN opens Caregiver Settings. Write it down — it cannot be reset yet.
            </p>
          </div>
        )}

        {state.step === 2 && (
          <div className="setup-wizard__body">
            <h2 className="panel__subheading">Wi-Fi</h2>
            <p role="status" className="status status--info">
              {wifi.connected
                ? `Connected to ${wifi.ssid ?? 'Wi-Fi'}.`
                : 'Not connected to Wi-Fi.'}
            </p>
            <div className="setup-wizard__actions">
              <button type="button" className="button button--secondary" onClick={() => void refreshWifi()}>
                Check again
              </button>
              <button type="button" className="button button--secondary" onClick={() => void openWifi()}>
                Open Wi-Fi settings
              </button>
            </div>

            <h2 className="panel__subheading">Sound</h2>
            <button type="button" className="button button--secondary" onClick={() => void playChime()}>
              Play Test Chime
            </button>
            {soundMessage && <p role="status" className="status status--info">{soundMessage}</p>}

            <h2 className="panel__subheading">Microphone</h2>
            <p className="panel__note">
              Say a few words for a three-second local check. Nothing is sent anywhere.
            </p>
            <div className="setup-wizard__actions">
              <button
                type="button"
                className="button button--secondary"
                disabled={mic.state === 'listening' || mic.state === 'checking'}
                onClick={() => void mic.start()}
              >
                Check microphone
              </button>
              {mic.state === 'listening' && (
                <button type="button" className="button button--secondary" onClick={mic.stop}>
                  Stop recording
                </button>
              )}
            </div>
            {mic.message && <p role="status" className="status status--info">{mic.message}</p>}
          </div>
        )}

        {state.step === 3 && (
          <div className="setup-wizard__body">
            <h2 className="panel__subheading">Family video calls (optional)</h2>
            {state.contacts.map((contact) => (
              <p className="status status--info" key={contact.id} role="status">
                {contact.name} · {contact.roomUrl}
              </p>
            ))}
            {state.contacts.length < MAX_SETUP_CONTACTS && (
              <>
                <label htmlFor="setup-contact-name">Name</label>
                <input
                  id="setup-contact-name"
                  value={contactName}
                  maxLength={60}
                  onChange={(event) => setContactName(event.target.value)}
                />
                <label htmlFor="setup-contact-room">Video room link</label>
                <input
                  id="setup-contact-room"
                  value={contactRoom}
                  maxLength={500}
                  placeholder="https://meet.jit.si/our-family"
                  onChange={(event) => setContactRoom(event.target.value)}
                />
                <button type="button" className="button button--secondary" onClick={addContact}>
                  Add person
                </button>
              </>
            )}

            <h2 className="panel__subheading">Daily reminders (optional)</h2>
            {state.reminders.map((reminder) => (
              <p className="status status--info" key={reminder.id} role="status">
                {reminder.time} · {reminder.text}
              </p>
            ))}
            <label htmlFor="setup-reminder">Reminder</label>
            <input
              id="setup-reminder"
              value={reminderText}
              maxLength={200}
              onChange={(event) => setReminderText(event.target.value)}
            />
            <label htmlFor="setup-reminder-time">Time</label>
            <input
              id="setup-reminder-time"
              type="time"
              value={reminderTime}
              onChange={(event) => setReminderTime(event.target.value)}
            />
            <button type="button" className="button button--secondary" onClick={addReminder}>
              Add reminder
            </button>
          </div>
        )}

        {state.step === 4 && (
          <div className="setup-wizard__body">
            <p className="panel__note">
              A helper asks for the RustDesk ID when they connect. It is shown inside the RustDesk
              window. Open it now and write the number down.
            </p>
            <div className="setup-wizard__actions">
              <button type="button" className="button button--secondary" onClick={() => void openRustdesk()}>
                Open RustDesk
              </button>
              <label htmlFor="setup-rustdesk-id">RustDesk ID (optional)</label>
              <input
                id="setup-rustdesk-id"
                inputMode="numeric"
                maxLength={24}
                value={state.rustdeskId}
                onChange={(event) => dispatch({ type: 'rustdeskId', value: event.target.value })}
              />
            </div>
            {state.rustdeskId && (
              <p className="status status--info" role="status">
                Remote help ID: {state.rustdeskId}
              </p>
            )}
            {rustdeskMessage && <p role="status" className="status status--info">{rustdeskMessage}</p>}
          </div>
        )}

        {error && (
          <p className="status status--error" role="alert">
            {friendlyMessage(error)}
          </p>
        )}

        <div className="setup-wizard__actions">
          {canGoBack && (
            <button type="button" className="button button--secondary" onClick={() => go('back')}>
              Back
            </button>
          )}
          {state.step < LAST_SETUP_STEP ? (
            <button type="button" className="button" onClick={() => go('next')}>
              Next
            </button>
          ) : (
            <button type="button" className="button" disabled={busy} onClick={() => void finish()}>
              Finish &amp; Switch to Senior Mode
            </button>
          )}
        </div>
      </div>
    </dialog>
  )
}
