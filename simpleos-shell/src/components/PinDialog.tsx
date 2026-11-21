import { useEffect, useRef, useState, type FormEvent } from 'react'
import { friendlyMessage } from '../messages'
import type { ErrorCode } from '../types'

interface PinDialogProps {
  mode: 'unlock' | 'create' | 'change'
  onCancel: () => void
  /** Returns null on success, or an error code to show in plain English. */
  onSubmit: (currentPin: string, newPin: string) => Promise<ErrorCode | null>
}

const COPY = {
  unlock: {
    title: 'Caregiver Settings',
    intro: 'Enter your caregiver PIN to continue.',
    action: 'Unlock',
  },
  create: {
    title: 'Set a caregiver PIN',
    intro: 'Choose a PIN of at least 4 numbers. Keep it somewhere safe.',
    action: 'Save PIN',
  },
  change: {
    title: 'Change caregiver PIN',
    intro: 'Enter your current PIN, then choose a new one.',
    action: 'Change PIN',
  },
} as const

/** Modal PIN gate using a native <dialog> for built-in focus trapping. */
export function PinDialog({ mode, onCancel, onSubmit }: PinDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const firstInputRef = useRef<HTMLInputElement>(null)
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [error, setError] = useState<ErrorCode | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    dialogRef.current?.showModal()
    firstInputRef.current?.focus()
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (mode !== 'unlock' && newPin !== confirmPin) {
      setError('PINS_DONT_MATCH')
      return
    }

    setBusy(true)
    try {
      const code = await onSubmit(currentPin, newPin)
      if (code) {
        setError(code)
        return
      }
      dialogRef.current?.close()
    } catch {
      setError('UNEXPECTED')
    } finally {
      setBusy(false)
    }
  }

  const copy = COPY[mode]

  return (
    <dialog
      ref={dialogRef}
      className="pin-dialog"
      aria-labelledby="pin-title"
      onCancel={onCancel}
    >
      <h2 id="pin-title">{copy.title}</h2>
      <p>{copy.intro}</p>

      <form onSubmit={handleSubmit}>
        {mode !== 'create' && (
          <>
            <label htmlFor="pin-current">{mode === 'unlock' ? 'PIN' : 'Current PIN'}</label>
            <input
              id="pin-current"
              ref={firstInputRef}
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={8}
              value={currentPin}
              onChange={(event) => setCurrentPin(event.target.value)}
            />
          </>
        )}

        {mode !== 'unlock' && (
          <>
            <label htmlFor="pin-new">New PIN</label>
            <input
              id="pin-new"
              ref={mode === 'create' ? firstInputRef : undefined}
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={8}
              value={newPin}
              onChange={(event) => setNewPin(event.target.value)}
            />

            <label htmlFor="pin-confirm">Type the new PIN again</label>
            <input
              id="pin-confirm"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={8}
              value={confirmPin}
              onChange={(event) => setConfirmPin(event.target.value)}
            />
          </>
        )}

        {error && (
          <p className="pin-dialog__error" role="alert">
            {friendlyMessage(error)}
          </p>
        )}

        <div className="pin-dialog__actions">
          <button type="button" className="button button--secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="button" disabled={busy}>
            {copy.action}
          </button>
        </div>
      </form>
    </dialog>
  )
}
