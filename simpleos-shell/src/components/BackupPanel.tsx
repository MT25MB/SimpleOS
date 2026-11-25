import { useState, type ChangeEvent } from 'react'
import {
  BACKUP_FILENAME,
  MAX_BACKUP_BYTES,
  backupSummary,
  buildBackup,
  parseBackup,
  type BackupFile,
} from '../backup'
import { friendlyMessage } from '../messages'
import type { FontScale } from '../hooks/useFontScale'
import type { FrameDelay } from '../types'

interface BackupPanelProps {
  seniorName: string
  scale: FontScale
  frameDelay: FrameDelay
  onApply: (backup: BackupFile) => Promise<string | null>
}

/** Export and restore caregiver preferences without ever touching the PIN file. */
export function BackupPanel({ seniorName, scale, frameDelay, onApply }: BackupPanelProps) {
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [preview, setPreview] = useState<BackupFile | null>(null)
  const [busy, setBusy] = useState(false)

  async function saveBackup() {
    setError(null)
    setMessage(null)
    const bridge = window.simpleOS
    if (!bridge) {
      setError(friendlyMessage('BRIDGE_UNAVAILABLE'))
      return
    }
    const [status, reminders, contacts] = await Promise.all([
      bridge.getSetupStatus(),
      bridge.loadReminders(),
      bridge.loadContacts(),
    ])
    if (!status.ok) return setError(friendlyMessage(status.code))
    if (!reminders.ok) return setError(friendlyMessage(reminders.code))
    if (!contacts.ok) return setError(friendlyMessage(contacts.code))

    const backup = buildBackup({
      seniorName: status.value.seniorName ?? seniorName,
      fontScale: scale,
      reminders: reminders.value,
      contacts: contacts.value,
      frameDelay,
      rustdeskId: status.value.rustdeskId ?? null,
    })
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }),
    )
    const link = document.createElement('a')
    link.href = url
    link.download = BACKUP_FILENAME
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    setMessage(`${BACKUP_FILENAME} saved. Copy it to a USB drive if you want a second copy.`)
  }

  async function chooseBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setError(null)
    setMessage(null)
    setPreview(null)
    if (file.size > MAX_BACKUP_BYTES) {
      setError('That file is too big to be a SimpleOS backup. Choose a smaller one.')
      return
    }
    const text = await file.text()
    const result = parseBackup(text, file.size)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setPreview(result.value)
  }

  async function applyBackup() {
    if (!preview) return
    setBusy(true)
    setError(null)
    try {
      const message = await onApply(preview)
      if (message) {
        setError(message)
        return
      }
      setMessage('Backup restored. Your settings are back.')
      setPreview(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="backup" aria-labelledby="backup-title">
      <h3 className="panel__subheading" id="backup-title">
        Save and restore settings
      </h3>
      <p className="panel__note">
        Save the name, text size, reminders, family cards and photo frame setting. The caregiver PIN
        is never included.
      </p>
      <div className="panel__button-row">
        <button type="button" className="button button--secondary" onClick={() => void saveBackup()}>
          Save backup file
        </button>
        <label className="button button--secondary backup__choose" htmlFor="backup-file">
          Choose backup file
        </label>
        <input
          id="backup-file"
          className="backup__input"
          type="file"
          accept="application/json,.json"
          onChange={(event) => void chooseBackup(event)}
        />
      </div>

      {preview && (
        <div className="backup__preview" role="region" aria-label="Backup preview">
          <p className="panel__note">This is what will be restored:</p>
          <ul>
            {backupSummary(preview).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <div className="panel__button-row">
            <button type="button" className="button" disabled={busy} onClick={() => void applyBackup()}>
              Apply backup
            </button>
            <button
              type="button"
              className="button button--secondary"
              disabled={busy}
              onClick={() => setPreview(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {message && (
        <p className="status status--info" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="status status--error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
