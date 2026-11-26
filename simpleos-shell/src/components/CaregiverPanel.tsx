import { friendlyMessage } from '../messages'
import type { FontScale } from '../hooks/useFontScale'
import type {
  Contact,
  ContactsFile,
  ErrorCode,
  FrameDelay,
  HardwareStatus,
  HealthStatus,
  RecoveryAction,
  SettingsTarget,
} from '../types'
import type { BackupFile } from '../backup'
import { BackupPanel } from './BackupPanel'
import { ContactEditor } from './ContactEditor'
import { FontScaleControl } from './FontScaleControl'
import { QuickCheckPanel } from './QuickCheckPanel'
import { RecoveryPanel } from './RecoveryPanel'

interface CaregiverPanelProps {
  scale: FontScale
  onScaleChange: (value: FontScale) => void
  hardware: HardwareStatus
  onRefreshHardware: () => void
  contacts: Contact[]
  onSaveContacts: (file: ContactsFile) => Promise<string | null>
  frameDelay: FrameDelay
  onFrameDelayChange: (value: FrameDelay) => void
  health: HealthStatus | null
  onCopyHealth: (summary: string) => void
  onRecovery: (action: RecoveryAction) => Promise<string>
  recoveryMessage: string | null
  updateSummary: string | null
  onOpenSettings: (target: SettingsTarget) => void
  onOpenRemoteHelp: () => void
  onCheckUpdates: () => void
  onTriggerUpdate: () => void
  onChangePin: () => void
  onRerunSetup: () => void
  seniorName: string
  onApplyBackup: (backup: BackupFile) => Promise<string | null>
  error: ErrorCode | null
  onDismissError: () => void
}

/** Plain-language settings a caregiver is allowed to change. */
export function CaregiverPanel({
  scale,
  onScaleChange,
  hardware,
  onRefreshHardware,
  contacts,
  onSaveContacts,
  frameDelay,
  onFrameDelayChange,
  health,
  onCopyHealth,
  onRecovery,
  recoveryMessage,
  updateSummary,
  onOpenSettings,
  onOpenRemoteHelp,
  onCheckUpdates,
  onTriggerUpdate,
  onChangePin,
  onRerunSetup,
  seniorName,
  onApplyBackup,
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
      />

      <RecoveryPanel
        health={health}
        onCopySummary={onCopyHealth}
        onAction={onRecovery}
        message={recoveryMessage}
      />

      <FontScaleControl value={scale} onChange={onScaleChange} />

      <fieldset className="frame-setting">
        <legend>Photo frame</legend>
        <p className="panel__note">
          After a quiet period, show family photos and a big clock. Any touch or key press brings the
          launcher straight back.
        </p>
        <div className="frame-setting__options">
          {([0, 2, 5, 10, 15] as const).map((minutes) => (
            <label className="frame-setting__option" key={minutes}>
              <input
                type="radio"
                name="frame-delay"
                value={minutes}
                checked={frameDelay === minutes}
                onChange={() => onFrameDelayChange(minutes)}
              />
              <span>{minutes === 0 ? 'Off' : `${minutes} minutes`}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <ContactEditor contacts={contacts} onSave={onSaveContacts} />

      <h3 className="panel__subheading">Computer settings</h3>
      <div className="panel__button-row">
        <button
          type="button"
          className="button button--secondary"
          aria-label="Wi-Fi &amp; Network — open network settings"
          onClick={() => onOpenSettings('network')}
        >
          Wi-Fi &amp; Network
        </button>
        <button
          type="button"
          className="button button--secondary"
          aria-label="Printers — open printer settings"
          onClick={() => onOpenSettings('printer')}
        >
          Printers
        </button>
        <button
          type="button"
          className="button button--secondary"
          aria-label="Check for updates now"
          onClick={onCheckUpdates}
        >
          Check for updates
        </button>
        <button
          type="button"
          className="button button--secondary"
          aria-label="Install system update now"
          onClick={onTriggerUpdate}
        >
          Install system update
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

      <BackupPanel
        seniorName={seniorName}
        scale={scale}
        frameDelay={frameDelay}
        onApply={onApplyBackup}
      />

      <h3 className="panel__subheading">Caregiver PIN</h3>
      <p className="panel__note">
        Change the PIN that opens Settings. Use at least 4 numbers.
      </p>
      <button
        type="button"
        className="button button--secondary"
        aria-label="Change PIN — change your caregiver PIN"
        onClick={onChangePin}
      >
        Change PIN
      </button>

      <h3 className="panel__subheading">First-run setup</h3>
      <p className="panel__note">
        Go through the five setup steps again to change the name, sound checks or family cards.
      </p>
      <button
        type="button"
        className="button button--secondary"
        aria-label="Run Setup Again — run the setup wizard again"
        onClick={onRerunSetup}
      >
        Run Setup Again
      </button>
    </section>
  )
}
