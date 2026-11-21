# Hardware support and power behaviour

This page records how SimpleOS handles real laptop and desktop hardware, and
why. It is both the design record and a plain-English reference for whoever
sets the computer up.

## What the image includes

The immutable image layers firmware and drivers for common Intel and AMD
machines on top of the uBlue base:

- `linux-firmware` — Wi-Fi, Bluetooth and GPU firmware
- `mesa-dri-drivers` — Intel/AMD graphics drivers
- `NetworkManager` — wired and Wi-Fi connections
- `bluez` — Bluetooth
- `power-profiles-daemon` — power/performance profiles
- `brightnessctl` — screen brightness
- `upower` — battery information
- `pulseaudio-utils` — the `pactl` command used for volume
- plus the existing PipeWire/WirePlumber, CUPS and Orca stack

`NetworkManager`, `bluetooth`, `power-profiles-daemon`, `upower` and `cups` are
enabled at boot. The daily `senior` account is added to the `video`, `audio`
and `lp` groups so brightness, sound and printing work without ever giving that
account administrative rights.

## Power defaults

Two systemd drop-ins ship in `system-configs/systemd/`:

- `logind.conf.d/10-simpleos-power.conf` — closing the lid, pressing the power
  key or leaving the computer idle does **not** suspend it. A video call or a
  long reading session is never cut short, and the screen does not go black and
  look broken.
- `sleep.conf.d/10-simpleos-sleep.conf` — normal suspend is allowed, but
  hibernation and hybrid sleep are disabled so a wake never comes back in a
  surprising state.

## What you see in the shell

The header shows a small hardware strip:

- **Wi-Fi:** the connected network name, or a clear "Not connected to Wi-Fi"
  message with a single **Open Wi-Fi Settings** button.
- **Battery** (laptops only): percentage and whether it is charging or running
  on battery. It is hidden entirely on desktops with no battery.
- **Volume:** bigger/smaller and mute buttons.
- **Screen brightness:** lighter/darker buttons, hidden when the machine has no
  backlight.

## Security boundary

The renderer never sends a command, argument, device path or network name. It
sends only fixed keys such as `volumeUp` or `brightnessDown`; the main process
looks them up in frozen allowlists in `electron/allowlists.ts`. Battery state is
read directly from `/sys/class/power_supply` with no external process. Every
call returns a plain `{ ok, code? }` result, and error codes are shown as
short, calm sentences.

## Decision log

| Decision | Alternatives considered | Why chosen |
| --- | --- | --- |
| logind/sleep drop-ins, no call-detection daemon | background `systemd-inhibit` service; explicit "keep awake" toggle | No new service, no password prompt, safest for an unattended kiosk |
| `pactl`, `brightnessctl`, `nmcli`, sysfs battery | D-Bus calls, `wpctl`, `upower --dump` | Fixed argument lists, no shell strings, available on Fedora Atomic |
| One `getHardwareStatus()` plus two fixed adjust methods | one IPC channel per control | A single lightweight poll and three well-typed bridge methods |
| Hide battery/backlight UI when hardware is absent | show "unavailable" placeholders | No dead controls that confuse the person using the computer |
