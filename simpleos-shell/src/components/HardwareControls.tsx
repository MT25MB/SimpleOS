import type { BatteryStatus, BrightnessAction, HardwareStatus, VolumeAction } from '../types'

interface HardwareControlsProps {
  status: HardwareStatus
  onOpenWifiSettings: () => void
  onAdjustVolume: (action: VolumeAction) => void
  onAdjustBrightness: (action: BrightnessAction) => void
}

function batteryText(battery: BatteryStatus): string {
  const level = battery.percent === null ? 'unknown' : `${battery.percent}%`
  if (battery.charging === null) return `Battery ${level}`
  return battery.charging ? `Battery ${level} · Charging` : `Battery ${level} · On battery`
}

/**
 * The quiet status strip in the header. The Wi-Fi message and the one-click
 * settings button are always visible when there is no connection; laptop-only
 * details simply do not appear on a desktop.
 */
export function HardwareControls({
  status,
  onOpenWifiSettings,
  onAdjustVolume,
  onAdjustBrightness,
}: HardwareControlsProps) {
  const { wifi, battery, brightnessAvailable } = status

  return (
    <section className="hardware" aria-label="Computer status and quick controls">
      {wifi.connected ? (
        <p className="hardware__chip hardware__chip--good">
          <span aria-hidden="true">✓</span> Connected to {wifi.ssid ?? 'Wi-Fi'}
        </p>
      ) : (
        <div className="hardware__wifi" role="status">
          <span>Not connected to Wi-Fi.</span>
          <button type="button" className="button button--small" onClick={onOpenWifiSettings}>
            Open Wi-Fi Settings
          </button>
        </div>
      )}

      {battery.present && <p className="hardware__chip">{batteryText(battery)}</p>}

      <div className="hardware__group" role="group" aria-label="Sound">
        <span className="hardware__label">Sound</span>
        <button type="button" className="button button--small" onClick={() => onAdjustVolume('volumeDown')}>
          Softer
        </button>
        <button type="button" className="button button--small" onClick={() => onAdjustVolume('volumeUp')}>
          Louder
        </button>
        <button type="button" className="button button--small" onClick={() => onAdjustVolume('volumeMute')}>
          Mute
        </button>
      </div>

      {brightnessAvailable && (
        <div className="hardware__group" role="group" aria-label="Screen brightness">
          <span className="hardware__label">Screen</span>
          <button
            type="button"
            className="button button--small"
            onClick={() => onAdjustBrightness('brightnessDown')}
          >
            Darker
          </button>
          <button
            type="button"
            className="button button--small"
            onClick={() => onAdjustBrightness('brightnessUp')}
          >
            Lighter
          </button>
        </div>
      )}
    </section>
  )
}
