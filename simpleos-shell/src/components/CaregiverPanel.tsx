import { friendlyMessage } from '../messages'
import type { FontScale } from '../hooks/useFontScale'
import type { ErrorCode, SettingsTarget } from '../types'
import { FontScaleControl } from './FontScaleControl'

interface CaregiverPanelProps {
  scale: FontScale
  onScaleChange: (value: FontScale) => void
  updateSummary: string | null
  onOpenSettings: (target: SettingsTarget) => void
  onOpenRemoteHelp: () => void
  onCheckUpdates: () => void
  onChangePin: () => void
  error: ErrorCode | null
  onDismissError: () => void
}

/** Plain-language settings a caregiver is allowed to change. */
export function CaregiverPanel({
  scale,
  onScaleChange,
  updateSummary,
  onOpenSettings,
  onOpenRemoteHelp,
  onCheckUpdates,
  onChangePin,
  error,
  onDismissError,
}: CaregiverPanelProps) {
  return (
    <section className="panel" aria-labelledby="caregiver-title">
      <h2 id="caregiver-title">Caregiver Settings</h2>
      <p className="panel__intro">
        Make the computer more comfortable to read and use.
      </p>

      {error && (
        <p className="status status--error" role="alert">
          {friendlyMessage(error)}{' '}
          <button type="button" className="status__dismiss" onClick={onDismissError}>
            Got it
          </button>
        </p>
      )}

      <FontScaleControl value={scale} onChange={onScaleChange} />

      <h3 className="panel__subheading">Computer settings</h3>
      <div className="panel__button-row">
        <button
          type="button"
          className="button button--secondary"
          onClick={() => onOpenSettings('network')}
        >
          Wi-Fi &amp; Network
        </button>
        <button
          type="button"
          className="button button--secondary"
          onClick={() => onOpenSettings('printer')}
        >
          Printers
        </button>
        <button type="button" className="button button--secondary" onClick={onCheckUpdates}>
          Check for updates
        </button>
      </div>

      {updateSummary && (
        <p className="status status--info" role="status">
          {updateSummary}
        </p>
      )}

      <h3 className="panel__subheading">Remote help</h3>
      <p className="panel__note">
        Open RustDesk to share the screen with someone you trust.
      </p>
      <button type="button" className="button button--secondary" onClick={onOpenRemoteHelp}>
        Open RustDesk
      </button>

      <h3 className="panel__subheading">Caregiver PIN</h3>
      <p className="panel__note">
        Change the PIN used to open this area. Choose at least 4 numbers.
      </p>
      <button type="button" className="button button--secondary" onClick={onChangePin}>
        Change caregiver PIN
      </button>
    </section>
  )
}
