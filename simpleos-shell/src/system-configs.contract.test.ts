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
})
