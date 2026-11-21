import type { HardwareStatus } from '../types'

interface QuickCheckPanelProps {
  hardware: HardwareStatus
  updateSummary: string | null
  onRefresh: () => void
  onOpenWifiSettings: () => void
  onCheckUpdates: () => void
}

interface CheckRowProps {
  label: string
  status: string
  action?: string
  onAction?: () => void
}

/** One plain-English line with an optional safe, reversible next step. */
function CheckRow({ label, status, action, onAction }: CheckRowProps) {
  return (
    <li className="quick-check__row">
      <p className="quick-check__status">
        <span className="quick-check__label">{label}</span> {status}
      </p>
      {action && onAction && (
        <button
          type="button"
          className="button button--small button--secondary"
          onClick={onAction}
        >
          {action}
        </button>
      )}
    </li>
  )
}

/**
 * A calm, at-a-glance check for the things a caregiver is asked about most.
 * Every action here is safe: opening a settings window, re-reading status, or
 * checking for updates. Nothing in this panel can erase data or change access.
 */
export function QuickCheckPanel({
  hardware,
  updateSummary,
  onRefresh,
  onOpenWifiSettings,
  onCheckUpdates,
}: QuickCheckPanelProps) {
  const { wifi, brightnessAvailable, audioAvailable, rustdeskAvailable } = hardware

  return (
    <section className="quick-check" aria-labelledby="quick-check-title">
      <h3 className="panel__subheading" id="quick-check-title">
        Quick check
      </h3>
      <p className="panel__note">Here is how the computer is doing right now.</p>

      <ul className="quick-check__list">
        <CheckRow
          label="Internet:"
          status={
            wifi.connected
              ? `Wi-Fi is connected to ${wifi.ssid ?? 'your network'}.`
              : 'Not connected to Wi-Fi.'
          }
          action={wifi.connected ? undefined : 'Open Wi-Fi Settings'}
          onAction={onOpenWifiSettings}
        />
        <CheckRow
          label="Sound:"
          status={
            audioAvailable
              ? 'Sound is ready.'
              : "Sound isn't ready right now. You can still use the computer."
          }
          action={audioAvailable ? undefined : 'Check again'}
          onAction={onRefresh}
        />
        <CheckRow
          label="Screen:"
          status={
            brightnessAvailable
              ? 'Screen brightness can be changed with the buttons at the top.'
              : 'This computer has no brightness control. That is normal on a desktop.'
          }
        />
        <CheckRow
          label="Remote help:"
          status={
            rustdeskAvailable
              ? 'RustDesk is installed and ready.'
              : "RustDesk isn't installed yet. Remote help will not work until it is."
          }
          action={rustdeskAvailable ? undefined : 'Check again'}
          onAction={onRefresh}
        />
        <CheckRow
          label="System:"
          status={updateSummary ?? 'The system version has not been checked yet.'}
          action="Check for updates"
          onAction={onCheckUpdates}
        />
      </ul>
    </section>
  )
}
