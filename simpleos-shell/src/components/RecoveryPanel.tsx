import { useState } from 'react'
import type { HealthStatus, RecoveryAction } from '../types'

interface RecoveryPanelProps {
  health: HealthStatus | null
  onCopySummary: (summary: string) => void
  onAction: (action: RecoveryAction) => Promise<string>
  message: string | null
}

const CONFIRM: Record<RecoveryAction, { title: string; body: string; button: string }> = {
  restartLauncher: {
    title: 'Restart the launcher?',
    body: 'The home screen will close and open again after a few seconds. Your reminders are already saved.',
    button: 'Restart launcher',
  },
  rollBack: {
    title: 'Go back to the previous version?',
    body: 'This undoes the last system update. Your files, reminders and PIN stay exactly as they are. The computer will restart afterwards.',
    button: 'Go back',
  },
}

/** Plain-English health checks and three guarded, reversible recovery steps. */
export function RecoveryPanel({ health, onCopySummary, onAction, message }: RecoveryPanelProps) {
  const [pending, setPending] = useState<RecoveryAction | null>(null)
  const [busy, setBusy] = useState(false)

  async function confirm() {
    if (!pending) return
    setBusy(true)
    try {
      await onAction(pending)
    } finally {
      setBusy(false)
      setPending(null)
    }
  }

  return (
    <section className="recovery" aria-labelledby="health-title">
      <h3 className="panel__subheading" id="health-title">
        System health and safe recovery
      </h3>

      <dl className="recovery__list">
        <div>
          <dt>Internet</dt>
          <dd>{health?.internet ?? 'Checking…'}</dd>
        </div>
        <div>
          <dt>Sound</dt>
          <dd>{health?.audio ?? 'Checking…'}</dd>
        </div>
        <div>
          <dt>Microphone</dt>
          <dd>{health?.microphone ?? 'Checking…'}</dd>
        </div>
        <div>
          <dt>Disk</dt>
          <dd>{health?.disk ?? 'Checking…'}</dd>
        </div>
        <div>
          <dt>Image</dt>
          <dd>{health?.imageVersion ?? 'Checking…'}</dd>
        </div>
        <div>
          <dt>Updates</dt>
          <dd>{health?.lastUpdateCheck ?? 'Checking…'}</dd>
        </div>
      </dl>

      <button
        type="button"
        className="button button--secondary"
        disabled={!health}
        onClick={() => health && onCopySummary(health.summary)}
      >
        Copy Health Summary
      </button>
      <p className="panel__note">
        The summary contains only these six lines. It never includes your files, reminders, Wi-Fi
        name or PIN.
      </p>

      <div className="recovery__actions">
        <button
          type="button"
          className="button button--secondary"
          onClick={() => setPending('restartLauncher')}
        >
          Restart Launcher
        </button>
        <button
          type="button"
          className="button button--secondary"
          onClick={() => setPending('rollBack')}
        >
          Roll Back Last OS Update
        </button>
      </div>

      {message && (
        <p className="status status--info" role="status">
          {message}
        </p>
      )}

      {pending && (
        <dialog className="recovery__dialog" open aria-labelledby="recovery-confirm-title">
          <h4 id="recovery-confirm-title">{CONFIRM[pending].title}</h4>
          <p>{CONFIRM[pending].body}</p>
          <div className="pin-screen__actions">
            <button
              type="button"
              className="button button--secondary"
              disabled={busy}
              onClick={() => setPending(null)}
            >
              Cancel
            </button>
            <button type="button" className="button" disabled={busy} onClick={() => void confirm()}>
              {CONFIRM[pending].button}
            </button>
          </div>
        </dialog>
      )}
    </section>
  )
}
