# Changelog

All notable changes to SimpleOS are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

Nothing yet.

## [v1.0.0]

The first stable release. It adds family connection tools, offline accessibility,
a privacy-safe health panel and guarded OS recovery on top of the v0.3.0
hardware, security and governance work.

### Added

- A plain-English System Health & Safe Recovery panel in Caregiver Settings with
  six status checks, a privacy-safe "Copy Health Summary" button and three
  confirmation-guarded actions: restart launcher, check OS updates and roll back
  the last OS update.
- Rollback runs through one narrow polkit-authorized systemd service; the daily
  user gains no general sudo rights.
- Up to four caregiver-managed family contact cards with names, relationships,
  local resized avatars and approved HTTPS video rooms. "Video Call Family" now
  opens large cards with one Call Now button per person.
- An optional calm photo frame after 2, 5, 10 or 15 minutes of inactivity, using
  local photos from `~/Pictures/SimpleOS/` with a large clock and date, dismissed
  by any click or key press.
- Optional **Read Aloud**: a high-visibility header toggle that speaks screen
  titles, button labels and reminders using a local browser voice, with an
  espeak-ng fallback through allowlisted IPC. One click or Escape stops speech.
- Optional **Hold to Speak** push-to-talk: audio is recorded locally, transcribed
  by an offline Vosk model and shown back as exact text before a big Confirm
  button runs one of five allowlisted actions. Nothing is uploaded.
- A plain-English note in the caregiver guide explaining both features.

### Fixed

- The bootable image now builds and installs the React/Electron launcher at
  `/usr/libexec/simpleos/simpleos-shell`, the path supervised by `labwc/autostart`.
  Previously a fresh boot could only show the wallpaper.
- The image build fails early if the Electron runtime is missing.
- `scripts/test-vm.sh` accepts the documented `qcow2` and `iso` mode tokens.
- README now lists the canonical repository and website URLs.

## [v0.3.0]

The first release intended for early adopters. It brings **hardware readiness**
for real laptops and desktops, **security hardening** of the desktop and browser
boundaries, the **community and governance docs** that make the project safe to
contribute to, and a full automated quality gate.

### Added

- Firmware and driver essentials for common Intel/AMD laptops and desktops,
  plus enabled NetworkManager, Bluetooth, power-profiles-daemon and upower.
- Safe power defaults that never suspend on lid close, idle or a stray power
  key, and that avoid hibernation surprises.
- A header status strip with Wi-Fi state and one-click Wi-Fi settings, a
  laptop-only battery/charging indicator, and allowlisted volume and screen
  brightness buttons.
- [Hardware support and power behaviour](docs/hardware-support.md) notes.

### Security

- Electron now blocks navigation away from the app, denies all new windows and
  embedded webviews, ships a strict content security policy, and checks the
  sender on every IPC handler.
- Firefox policies now block `file:`/`ftp:` navigation, `about:config`, the
  add-ons manager and developer tools, deny new extension installs and lock
  uBlock Origin so it cannot be removed.
- Labwc overrides the inherited terminal shortcuts so no shell can be opened
  from the keyboard.
- Caregiver PIN attempts are rate limited in the main process (five tries, then
  a 30-second cooldown), with a matching pause in the PIN screen.
- Automated security regression tests cover every one of these guardrails.

### Community

- Added `CONTRIBUTING.md`, the Contributor Covenant `CODE_OF_CONDUCT.md` and
  `SECURITY.md`, plus Bug Report, Accessibility / Usability Feedback and
  Caregiver Feature Request issue forms.
- Added regression tests for the governance documents and for every issue form
  so a broken link or malformed YAML is caught before merge.
- Added `LAUNCH.md` with launch copy drafts for caregiver communities and for
  technical/open-source audiences, plus an accuracy and tone checklist.
- Added `docs/updates-and-recovery.md`: how immutable updates work, how to boot
  from the previous deployment, a monthly caregiver checklist, and a maintainer
  release checklist. Linked from the README, caregiver guide and website.

### Accessibility

- Audited the keyboard and screen-reader flow across the launcher and site. Home
  tiles, reminder actions, PIN fields and caregiver buttons now have explicit,
  specific accessible names; an in-app skip link and PIN error descriptions were
  added.
- Added a Quick Check panel inside Caregiver Settings. It explains Wi-Fi, sound,
  screen brightness, RustDesk and system version in plain English and offers
  only safe, reversible recovery actions.
- Verified all three text sizes in a browser: 18px, 20.7px and 24.3px, with no
  clipped labels, off-screen buttons or horizontal overflow.

### Changed

- Grew the test suite from 127 to 181 passing tests across 21 files. The new
  tests cover hardware packages and power config, Electron and Firefox
  guardrails, PIN cooldown behaviour, community docs, and the accessibility and
  caregiver status flows.
- `bash scripts/test-all.sh` is the single local gate: tests, type-check,
  production build, shell syntax checks and the staged-artifact check all pass.

### Added

- A static GitHub Pages site in `docs/` with an interactive home-screen preview,
  a working text-size control, and a plain-English
  [caregiver guide](docs/caregiver-guide.md).
- Optimized brand assets in `docs/assets/` with documented size limits and
  export commands.
- `scripts/flash-usb.sh`, a cautious USB writer. It shows the device model,
  size and mounts, refuses the running system disk or any mounted device,
  supports `--dry-run`, and needs the typed word `FLASH` before writing.
- `scripts/test-vm.sh` for one-command QEMU/KVM testing, with qcow2 and ISO
  modes and a `--reset` flag for clean first-boot tests.
- `scripts/test-all.sh` as a single local command for the full test suite,
  type-check, build, shell syntax checks and artifact gate.
- A shared reusable test workflow (`.github/workflows/test.yml`) that gates
  image builds, Pages deployment and releases.
- Automated releases (`.github/workflows/release.yml`) triggered by `v*.*.*`
  tags or manual input, with generated notes and image/ISO instructions.
- Direct tests for PIN cryptography, IPC allowlists, accessibility defaults,
  docs links and assets, workflow YAML, and shell script safety.
- A `CHANGELOG.md` covering the release history.

### Changed

- Hardened reminder validation: bounded text and list length, strict time
  format, corrupt-data protection, atomic `0600` writes, and caught IPC errors.
- Every reminder action now gives a short plain-English confirmation.
- PIN handling now bounds length, rejects corrupt records, and writes the hash
  atomically with owner-only permissions. Verification still uses `scryptSync`
  and `timingSafeEqual`.
- The labwc shell supervisor now backs off after repeated instant crashes while
  still relaunching the interface.
- Caregiver actions go through one allowlisted `runAction` entry point with
  fixed commands. No renderer string can become a shell command.
- Repository prose was rewritten in plain, warm language.

### Fixed

- A real build break where `Object.hasOwn` in a newly extracted module failed
  the ES2020 root type-check. Replaced with a universally available check.
- A reproducible Pages deploy failure caused by artifact metadata lag. Added a
  short wait before the deploy step.
- Three over-broad test assertions and several contract tests that still
  referenced code moved into extracted modules.

## [v0.2.0]

- Immutable bootc/Fedora Atomic image with labwc, greetd, swaybg, foot, Flatpak,
  PipeWire, CUPS, Orca and readable fonts. UTC by default and a clean
  `ostree container commit`.
- Labwc kiosk guardrails: dark slate background, 48px cursor, 18px text,
  maximized windows, no desktop click menus, zero snapping, and a supervised
  shell that restarts itself.
- greetd autologin into the unprivileged `senior` account; first-boot service
  creates the account, adds Flathub and installs Firefox, Loupe and RustDesk.
- Firefox policies force HTTPS-Only and lock in uBlock Origin, while blocking
  telemetry, Pocket, sponsored shortcuts, notification prompts and location
  prompts.
- Full-screen React/TypeScript/Electron launcher with six large tiles, daily
  reminders, font scaling and PIN-gated caregiver settings.
- ISO and VM scripts, GHCR publishing on push and weekly schedules, and a
  Vitest suite integrated into CI.

## [v0.1.0]

- First prototype: initial image definition, system configs, Electron launcher,
  build script and documentation.

[Unreleased]: https://github.com/MT25MB/SimpleOS/compare/v1.0.0...HEAD
[v1.0.0]: https://github.com/MT25MB/SimpleOS/compare/v0.3.0...v1.0.0
[v0.3.0]: https://github.com/MT25MB/SimpleOS/compare/v0.2.0...v0.3.0
[v0.2.0]: https://github.com/MT25MB/SimpleOS/compare/v0.1.0...v0.2.0
[v0.1.0]: https://github.com/MT25MB/SimpleOS/releases/tag/v0.1.0
