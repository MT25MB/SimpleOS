import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(resolve(root, path), 'utf8')

const containerfile = read('os-image/Containerfile')
const autostart = read('system-configs/labwc/autostart')
const rc = read('system-configs/labwc/rc.xml')
const policies = JSON.parse(read('system-configs/firefox/policies.json'))
const greetd = read('system-configs/greetd/config.toml')
const firstboot = read('system-configs/systemd/simpleos-firstboot.sh')
const firstbootService = read('system-configs/systemd/simpleos-firstboot.service')
const buildIso = read('scripts/build-iso.sh')
const workflow = read('.github/workflows/build-image.yml')

describe('system guardrails contract', () => {
  it('builds from the uBlue immutable base and commits cleanly', () => {
    expect(containerfile).toContain('FROM ghcr.io/ublue-os/base-main:latest')
    expect(containerfile).toContain('rpm-ostree install')
    expect(containerfile).toContain('ostree container commit')
  })

  it('installs every essential package including foot and orca', () => {
    for (const pkg of ['labwc', 'greetd', 'swaybg', 'foot', 'flatpak', 'pipewire', 'cups', 'orca']) {
      expect(containerfile).toMatch(new RegExp(`\\b${pkg}\\b`))
    }
  })

  it('defaults to UTC and hides foot from menus', () => {
    expect(containerfile).toContain('TZ=UTC')
    expect(containerfile).toContain('zoneinfo/UTC')
    expect(containerfile).toContain('NoDisplay=true')
  })

  it('autologins the unprivileged senior user into labwc', () => {
    expect(greetd).toContain('[initial_session]')
    expect(greetd).toContain('command = "labwc"')
    expect(greetd).toContain('user = "senior"')
    expect(firstboot).toMatch(/for group in wheel sudo admin/)
    expect(firstboot).toContain('useradd --create-home --user-group')
  })

  it('runs first boot once, after the network is ready, before greetd', () => {
    expect(firstbootService).toContain('ConditionPathExists=!/var/lib/simpleos/firstboot-complete')
    expect(firstbootService).toContain('After=local-fs.target network-online.target')
    expect(firstbootService).toContain('Wants=network-online.target')
    expect(firstbootService).toContain('Before=greetd.service')
    expect(firstbootService).toContain('Type=oneshot')
    expect(firstbootService).toContain('ExecStartPost=/usr/bin/touch /var/lib/simpleos/firstboot-complete')
  })

  it('sets senior ownership on home and config directories', () => {
    expect(firstboot).toContain('chown -R "$SENIOR_USER:$SENIOR_USER" "$SENIOR_HOME"')
    expect(firstboot).toContain('mkdir -p "$SENIOR_HOME/.config/simpleos"')
    expect(firstboot).toContain('chmod 0700')
  })

  it('logs to journald and never fails the boot on a network hiccup', () => {
    expect(firstbootService).toContain('StandardOutput=journal')
    expect(firstbootService).toContain('SyslogIdentifier=simpleos-firstboot')
    expect(firstboot).toContain('logger -t simpleos-firstboot')
    expect(firstboot).toContain('network problem?')
    // The network steps are wrapped so a failure cannot trip strict mode.
    expect(firstboot).toContain('if ! flatpak remote-add')
    expect(firstboot).toContain('if ! flatpak install')
    expect(firstboot.trimEnd()).toMatch(/exit 0$/)
  })

  it('installs the three core flatpaks', () => {
    expect(firstboot).toContain('org.mozilla.firefox')
    expect(firstboot).toContain('org.gnome.Loupe')
    expect(firstboot).toContain('com.rustdesk.RustDesk')
  })

  it('keeps the shell supervised with a dark background and large cursor', () => {
    expect(autostart).toContain("swaybg -c '#0b1120'")
    expect(autostart).toContain('XCURSOR_SIZE="${XCURSOR_SIZE:-48}"')
    expect(autostart).toContain('while true; do')
  })

  it('maximizes windows, removes desktop clicks and disables snapping', () => {
    expect(rc).toContain('<action name="Maximize"/>')
    expect(rc).toContain('<context name="Desktop">')
    expect(rc).toContain('<context name="Root">')
    expect(rc).toContain('<inner>0</inner>')
    expect(rc).toContain('<outer>0</outer>')
    expect(rc).toContain('<cornerRange>0</cornerRange>')
  })

  it('locks down Firefox telemetry, Pocket, HTTPS and permissions', () => {
    expect(policies.policies.HttpsOnlyMode).toBe('force_enabled')
    expect(policies.policies.DisableTelemetry).toBe(true)
    expect(policies.policies.DisablePocket).toBe(true)
    expect(policies.policies.FirefoxHome.Locked).toBe(true)
    expect(policies.policies.Permissions.Notifications.BlockNewRequests).toBe(true)
    expect(policies.policies.Permissions.Location.BlockNewRequests).toBe(true)
    expect(policies.policies.ExtensionSettings['uBlock0@raymondhill.net'].installation_mode).toBe('force_installed')
  })

  it('publishes short-SHA tags weekly on push to main', () => {
    expect(workflow).toContain('branches: [main]')
    expect(workflow).toContain("cron: '0 6 * * 1'")
    expect(workflow).toContain('type=sha,format=short')
    expect(workflow).toContain('packages: write')
  })

  it('warns before overwriting a USB drive', () => {
    expect(buildIso).toContain('bootc-image-builder')
    expect(buildIso).toContain('OVERWRITE the USB drive')
    expect(buildIso).toContain('SIMPLEOS_CONFIRM_FLASH=YES')
    expect(buildIso).toContain('Type the device path exactly')
  })

  it('installs firmware, drivers and real-hardware services', () => {
    for (const pkg of [
      'linux-firmware',
      'mesa-dri-drivers',
      'NetworkManager',
      'bluez',
      'power-profiles-daemon',
      'upower',
      'brightnessctl',
      'pulseaudio-utils',
    ]) {
      expect(containerfile, pkg).toMatch(new RegExp(`\\b${pkg}\\b`))
    }
    for (const unit of [
      'NetworkManager.service',
      'bluetooth.service',
      'power-profiles-daemon.service',
      'upower.service',
    ]) {
      expect(containerfile, unit).toContain(unit)
    }
  })

  it('copies the power drop-ins into the image', () => {
    expect(containerfile).toContain('logind.conf.d/10-simpleos-power.conf')
    expect(containerfile).toContain('sleep.conf.d/10-simpleos-sleep.conf')
  })

  it('ships safe power defaults with no idle, lid or hibernation surprises', () => {
    const logind = read('system-configs/systemd/logind.conf.d/10-simpleos-power.conf')
    const sleep = read('system-configs/systemd/sleep.conf.d/10-simpleos-sleep.conf')
    expect(logind).toContain('[Login]')
    expect(logind).toContain('HandleLidSwitch=ignore')
    expect(logind).toContain('HandleLidSwitchDocked=ignore')
    expect(logind).toContain('IdleAction=ignore')
    expect(logind).toContain('HandlePowerKey=ignore')
    expect(sleep).toContain('[Sleep]')
    expect(sleep).toContain('AllowSuspend=yes')
    expect(sleep).toContain('AllowHibernation=no')
  })

  it('builds and installs the launcher that the desktop session supervises', () => {
    expect(containerfile).toContain('FROM node:22 AS shell-build')
    expect(containerfile).toContain('COPY docs/assets/ /docs/assets/')
    expect(containerfile).toContain('RUN npm run build')
    expect(containerfile).toContain('test -x node_modules/electron/dist/electron')
    expect(containerfile).toContain('COPY --from=shell-build /src/dist /usr/lib/simpleos/app/dist')
    expect(containerfile).toContain(
      'COPY --from=shell-build /src/dist-electron /usr/lib/simpleos/app/dist-electron',
    )
    expect(containerfile).toContain(
      'COPY --from=shell-build /src/node_modules/electron /usr/lib/simpleos/app/node_modules/electron',
    )
    expect(containerfile).toContain('/usr/libexec/simpleos/simpleos-shell')
    expect(autostart).toContain('/usr/libexec/simpleos/simpleos-shell')
  })

  it('ships the offline voice runtime without any cloud dependency', () => {
    for (const pkg of ['espeak-ng', 'python3', 'python3-pip', 'unzip', 'curl']) {
      expect(containerfile, pkg).toMatch(new RegExp(`\\b${pkg}\\b`))
    }
    expect(containerfile).toContain('--target /usr/lib/simpleos/python')
    expect(containerfile).toContain('vosk-model-small-en-us-0.15.zip')
    expect(containerfile).toContain('system-configs/simpleos/transcribe.py')
    const transcribe = read('system-configs/simpleos/transcribe.py')
    expect(transcribe).toContain('from vosk import KaldiRecognizer, Model')
    expect(transcribe).not.toMatch(/^\s*(import|from)\s+(requests|urllib)/m)
    expect(transcribe).not.toMatch(/https?:\/\//)
  })

  it('gives senior hardware groups without ever granting admin rights', () => {
    expect(firstboot).toContain('for group in video audio lp')
    expect(firstboot).toContain('usermod --append --groups')
    expect(firstboot).toMatch(/for group in wheel sudo admin/)
  })
})
