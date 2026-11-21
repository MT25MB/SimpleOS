import { friendlyMessage } from '../messages'
import type { FontScale } from '../hooks/useFontScale'
import type { ErrorCode, HardwareStatus, SettingsTarget } from '../types'
import { FontScaleControl } from './FontScaleControl'
import { QuickCheckPanel } from './QuickCheckPanel'

interface CaregiverPanelProps {
  scale: FontScale
  onScaleChange: (value: FontScale) => void
  hardware: HardwareStatus
  onRefreshHardware: () => void
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
  hardware,
  onRefreshHardware,
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
        Make things easier to see and use.
      </p>

      {error && (
        <p className="status status--error" role="alert">
          {friendlyMessage(error)}{' '}
          <button type="button" className="status__dismiss" onClick={onDismissError}>
            Got it
          </button>
        </p>
      )}

      <QuickCheckPanel
        hardware={hardware}
        updateSummary={updateSummary}
        onRefresh={onRefreshHardware}
        onOpenWifiSettings={() => onOpenSettings('network')}
        onCheckUpdates={onCheckUpdates}
      />

      <FontScaleControl value={scale} onChange={onScaleChange} />

      <h3 className="panel__subheading">Computer settings</h3>
      <div className="panel__button-row">
        <button
          type="button"
          className="button button--secondary"
          aria-label="Open Wi-Fi and network settings"
          onClick={() => onOpenSettings('network')}
        >
          Wi-Fi &amp; Network
        </button>
        <button
          type="button"
          className="button button--secondary"
          aria-label="Open printer settings"
          onClick={() => onOpenSettings('printer')}
        >
          Printers
        </button>
        <button
          type="button"
          className="button button--secondary"
          aria-label="Check for system updates"
          onClick={onCheckUpdates}
        >
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
        Let someone you trust see your screen and help.
      </p>
      <button
        type="button"
        className="button button--secondary"
        aria-label="Open RustDesk for remote help"
        onClick={onOpenRemoteHelp}
      >
        Open RustDesk
      </button>

      <h3 className="panel__subheading">Caregiver PIN</h3>
      <p className="panel__note">
        Change the PIN that opens Settings. Use at least 4 numbers.
      </p>
      <button
        type="button"
        className="button button--secondary"
        aria-label="Change your caregiver PIN"
        onClick={onChangePin}
      >
        Change PIN
      </button>
    </section>
  )
}
