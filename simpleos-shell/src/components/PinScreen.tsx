import { useEffect, useRef, useState, type FormEvent } from 'react'
import { friendlyMessage } from '../messages'
import type { ErrorCode } from '../types'

interface PinScreenProps {
  mode: 'unlock' | 'create' | 'change'
  onCancel: () => void
  /** Returns null on success, or an error code to show in plain English. */
  onSubmit: (currentPin: string, newPin: string) => Promise<ErrorCode | null>
}

const COPY = {
  unlock: {
    title: 'Caregiver Settings',
    intro: 'Enter your PIN to open Settings.',
    action: 'Unlock',
  },
  create: {
    title: 'Set a caregiver PIN',
    intro: 'Pick at least 4 numbers and keep them somewhere safe.',
    action: 'Save PIN',
  },
  change: {
    title: 'Change caregiver PIN',
    intro: 'Enter your old PIN, then pick a new one.',
    action: 'Change PIN',
  },
} as const

/**
 * Full-screen PIN entry gate.
 *
 * The PIN lives only in these transient input fields while the user types. It
 * is sent straight to the main process over IPC and is never written to
 * localStorage, a cookie, or any other renderer-side storage. The main process
 * holds only a salted scrypt hash.
 */
export function PinScreen({ mode, onCancel, onSubmit }: PinScreenProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const firstInputRef = useRef<HTMLInputElement>(null)
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [error, setError] = useState<ErrorCode | null>(null)
  const [busy, setBusy] = useState(false)
  const [paused, setPaused] = useState(false)
  const cooldownTimer = useRef<number | null>(null)

  // showModal() gives us focus trapping, Escape handling and an inert backdrop.
  useEffect(() => {
    dialogRef.current?.showModal()
    firstInputRef.current?.focus()
  }, [])

  useEffect(
    () => () => {
      if (cooldownTimer.current !== null) window.clearTimeout(cooldownTimer.current)
    },
    [],
  )

  /** A short UI pause; the main process owns the real attempt counter. */
  function pauseFor(ms: number) {
    setPaused(true)
    if (cooldownTimer.current !== null) window.clearTimeout(cooldownTimer.current)
    cooldownTimer.current = window.setTimeout(() => {
      setPaused(false)
      cooldownTimer.current = null
    }, ms)
  }

  function clearPins() {
    setCurrentPin('')
    setNewPin('')
    setConfirmPin('')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (mode !== 'unlock' && newPin !== confirmPin) {
      setError('PINS_DONT_MATCH')
      clearPins()
      return
    }

    setBusy(true)
    try {
      const code = await onSubmit(currentPin, newPin)
      if (code) {
        setError(code)
        // Stops a stuck button from firing many times. The main process keeps
        // the authoritative 5-attempt / 30-second cooldown.
        pauseFor(code === 'TOO_MANY_TRIES' ? 30_000 : 1_000)
        return
      }
      dialogRef.current?.close()
    } catch {
      setError('UNEXPECTED')
    } finally {
      // Never leave a typed PIN sitting in component state.
      clearPins()
      setBusy(false)
    }
  }

  const copy = COPY[mode]

  return (
    <dialog
      ref={dialogRef}
      className="pin-screen"
      aria-labelledby="pin-title"
      onCancel={onCancel}
    >
      <div className="pin-screen__card">
        <h1 id="pin-title">{copy.title}</h1>
        <p className="pin-screen__intro">{copy.intro}</p>

        <form onSubmit={handleSubmit}>
          {mode !== 'create' && (
            <>
              <label htmlFor="pin-current">{mode === 'unlock' ? 'PIN' : 'Old PIN'}</label>
              <input
                id="pin-current"
                name="current-pin"
                ref={firstInputRef}
                type="password"
                inputMode="numeric"
                autoComplete="off"
                maxLength={12}
                value={currentPin}
                onChange={(event) => setCurrentPin(event.target.value)}
                aria-invalid={error ? true : undefined}
              />
            </>
          )}

          {mode !== 'unlock' && (
            <>
              <label htmlFor="pin-new">New PIN</label>
              <input
                id="pin-new"
                name="new-pin"
                ref={mode === 'create' ? firstInputRef : undefined}
                type="password"
                inputMode="numeric"
                autoComplete="off"
                maxLength={12}
                value={newPin}
                onChange={(event) => setNewPin(event.target.value)}
                aria-invalid={error ? true : undefined}
              />

              <label htmlFor="pin-confirm">New PIN again</label>
              <input
                id="pin-confirm"
                name="confirm-pin"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                maxLength={12}
                value={confirmPin}
                onChange={(event) => setConfirmPin(event.target.value)}
                aria-invalid={error ? true : undefined}
              />
            </>
          )}

          <p className="pin-screen__error" role="alert">
            {error ? friendlyMessage(error) : ''}
          </p>

          <div className="pin-screen__actions">
            <button type="button" className="button button--secondary" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="button" disabled={busy || paused}>
              {copy.action}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  )
}
