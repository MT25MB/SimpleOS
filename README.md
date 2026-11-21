# SimpleOS

**SimpleOS** is a free, open-source, immutable Linux operating system designed for older adults and anyone who finds modern desktop computing stressful.

It is built around one idea: a computer should be dependable, readable, and hard to break by accident.

> **Status:** Released as **v0.2.0**. The immutable image, accessible desktop, launcher, reminders, and caregiver tools are implemented; ISO/VM tooling, CI publishing, and a 76-test suite are in place. Features continue to be refined.

---

## The problem we solve

Mainstream desktops are optimised for power users, which leaves two groups behind:

### Accessibility gaps
- **Tiny text and low contrast.** Menus, labels, and dialogs are small and hard to read.
- **Cluttered interfaces.** Dozens of icons, nested menus, and settings create constant decision fatigue.
- **Inconsistent controls.** The same action behaves differently in different apps.
- **Fear of "breaking it."** Users avoid exploring because they are afraid of clicking the wrong thing.

### Safety gaps
- **Scams and phishing.** Misleading pop-ups, fake "update" buttons, and predatory ads target less experienced users.
- **Accidental system damage.** A mistaken click can delete files or change critical settings.
- **Confusing update behaviour.** Updates that fail, nag, or silently change the interface.
- **Malware and bloatware.** Pre-installed junk and risky default browser settings.

---

## How SimpleOS responds

| Principle | What it means in SimpleOS |
| --- | --- |
| **Readable by default** | Large type, high-contrast theme, generous spacing, simple icon set. |
| **Few, clear choices** | A minimal desktop with a small set of obvious, consistently placed actions. |
| **Hard to break** | Immutable, read-only system root. User changes cannot corrupt the OS. |
| **Safe by default** | Hardened browser policies, no account nags, no telemetry, no misleading prompts. |
| **Recoverable** | Atomic, automatic updates. If something goes wrong, reboot into the previous version. |
| **Free and open** | No subscriptions, no lock-in, no tracking. MIT licensed. |

### What is implemented

- A **bootable container** based on uBlue's immutable base (`os-image/Containerfile`) for versioned, atomic system builds.
- A **labwc** Wayland desktop tuned for readability: dark high-contrast background, 48px cursor, 18px minimum text, maximized windows, no background click menus, and snapping disabled (`system-configs/labwc/`).
- **greetd autologin** into an unprivileged `senior` account that is never in `wheel`/`sudo` (`system-configs/greetd/`).
- A **first-boot service** that creates the account, fixes ownership, adds Flathub, and installs Firefox, Loupe and RustDesk — logging to journald and continuing past network hiccups (`system-configs/systemd/`).
- A full-screen **React + TypeScript + Electron** launcher with large tiles, reminders saved to `~/.config/simpleos`, and a hashed PIN protecting caregiver settings (`simpleos-shell/`).

### Scam and safety guardrails

- **HTTPS everywhere.** Firefox is locked to HTTPS-Only mode, so insecure pages warn instead of loading silently.
- **No fake "update" pop-ups or notification spam.** Website notification and location prompts are blocked by policy, and Firefox telemetry, Pocket, sponsored shortcuts and studies are disabled.
- **uBlock Origin is force-installed and locked.** Other extensions cannot be installed, so a malicious "helper" add-on cannot be added by a scam page.
- **Nothing to break.** The system root is immutable; a mistaken click cannot corrupt the OS. Updates are atomic and can be rolled back.
- **No admin path.** The daily `senior` account has no sudo/wheel access; the caregiver PIN is hashed with scrypt and never stored in plain text.

---

## Repository layout

```
.
├── os-image/
│   └── Containerfile              # Immutable bootable image definition
├── system-configs/
│   ├── labwc/                     # autostart, rc.xml, environment
│   ├── greetd/                    # autologin into the "senior" session
│   ├── firefox/                   # enterprise policies.json
│   └── systemd/                   # first-boot service + helper script
├── simpleos-shell/
│   ├── electron/                  # main.ts + preload.ts (compiled to dist-electron/)
│   ├── src/                       # React components, hooks, IPC types, Vitest tests
│   └── package.json
├── scripts/
│   ├── build-iso.sh               # Build/pull image → bootable ISO (+ USB flash checks)
│   └── test-vm.sh                 # Build image → boot in QEMU/KVM (qcow2 or iso)
└── .github/
    ├── dependabot.yml             # Groups npm updates to avoid peer conflicts
    └── workflows/build-image.yml  # Build/publish GHCR + test/build the shell
```

---

## Build and test for $0

Everything below uses only free, open-source tooling and free tiers. No paid accounts, cloud credits, or proprietary licences are required.

### Prerequisites (all free)

- **Podman**, **sudo** and **Git** — image/ISO builds. Podman is required because `bootc-image-builder` mounts host container storage.
- **QEMU/KVM** (with `ovmf`) or **VirtualBox** — to boot the image locally.
- **Node.js + npm** — only for helper shell development.
- A **GitHub** account — free CI and `ghcr.io` image hosting.

### 1. Build the ISO

```sh
# From the repository root: pulls the CI-built image, then writes output/*.iso
bash scripts/build-iso.sh
```

To build the image locally instead of pulling from GHCR:

```sh
bash scripts/build-iso.sh --build
```

To pull from a fork's registry:

```sh
REMOTE_IMAGE=ghcr.io/your-username/simpleos:latest bash scripts/build-iso.sh
```

Overrides: `IMAGE_TAG`, `OUTPUT_DIR`, `BUILDER_IMAGE`, `CONTAINER_ENGINE`. Run `bash scripts/build-iso.sh --help` for details.

To flash a USB stick, the script adds safety checks (removable-device check, unmounted check, an acknowledgement variable, and typed confirmation):

```sh
SIMPLEOS_CONFIRM_FLASH=YES bash scripts/build-iso.sh --flash /dev/sdb
```

**WARNING:** flashing erases everything on the target device. Back up your data first and double-check the device path.

### 2. Run the tests and build the helper shell

```sh
cd simpleos-shell
npm ci
npm run test       # Vitest: hooks, components, integration, config contracts
npm run build      # type-check + Vite bundle + Electron compile
```

### 3. Continuous integration

`.github/workflows/build-image.yml` rebuilds on every push to `main`, once a week (Monday 06:00 UTC), and on manual dispatch. It builds `os-image/Containerfile`, runs the shell tests and build, and publishes `ghcr.io/<owner>/simpleos` with `latest`, short-SHA and weekly tags using `GITHUB_TOKEN` (`packages: write`). Pull requests build without publishing. Everything runs on free GitHub runners.

---

## Quickstart for Testing in a VM

The image boots in **UEFI** mode. Give the VM at least **4 GB RAM**, **2 CPUs**, and **20 GB disk**. On first boot greetd signs in as `senior`, then the first-boot service creates the account, adds Flathub, and installs Firefox, Loupe and RustDesk. Wait a few minutes for the home launcher to appear.

### Option A: one-command QEMU/KVM test (recommended)

Install the tools first:

```sh
# Debian / Ubuntu
sudo apt install qemu-kvm qemu-system-gui qemu-utils ovmf
# Fedora
sudo dnf install @virtualization qemu-img ovmf
```

Then let the script build the image and boot it with KVM + virtio graphics:

```sh
bash scripts/test-vm.sh              # build image → boot qcow2 disk
bash scripts/test-vm.sh --reset      # recreate the disk and re-test first boot
bash scripts/test-vm.sh --iso        # build an ISO and boot the installer
```

The disk lives at `build-vm/simpleos-test.qcow2`. Keep it between runs to preserve reminders and settings; use `--reset` when you want a clean first boot.

### Option B: manual QEMU/KVM command

If you prefer to run QEMU yourself, locate the ISO with `find output -name '*.iso'` and boot:

```sh
qemu-img create -f qcow2 simpleos-test.qcow2 20G

qemu-system-x86_64 \
  -m 4096 -smp 2 -accel kvm \
  -bios /usr/share/OVMF/OVMF_CODE.fd \
  -cdrom output/bootiso/install.iso \
  -drive file=simpleos-test.qcow2,format=qcow2 \
  -vga virtio -display gtk
```

Adjust the OVMF path for your distribution (`find /usr/share -name 'OVMF_CODE.fd'`). If KVM is unavailable, remove `-accel kvm` — slower, but it still works.

### Option C: VirtualBox

1. **New** → name it `SimpleOS`, Type **Linux**, Version **Fedora (64-bit)**.
2. Allocate **4096 MB RAM**, **2 CPUs**, and a **20 GB** dynamic VDI.
3. Settings → System → check **Enable EFI**; Processor → check **Enable I/O APIC**.
4. Settings → Storage → attach the ISO (`output/bootiso/install.iso`) to the optical drive.
5. Start the VM, choose **Install SimpleOS**, follow the prompts, then reboot and remove the ISO when asked.

If the ISO is nested differently, locate it with `find output -name '*.iso'`.

### Quick troubleshooting

| Symptom | Check |
| --- | --- |
| Black screen on boot | UEFI/OVMF must be enabled, not legacy BIOS. |
| No network in the VM | Use NAT networking in the VM settings. |
| First boot seems stuck | Flatpak apps are downloading; wait, then reboot if needed. |
| Text too small | Caregiver Settings → Text size → Large or Extra Large. |

---

## Caregiver setup checklist (short version)

1. Set the caregiver PIN when prompted (at least 4 numbers — save it somewhere safe; there is no recovery).
2. Open **Caregiver Settings → Text size** and pick Large or Extra Large.
3. Add one or two **Daily Reminders** with times, then try **Mark Done** and **Start a new day**.
4. Open **Ask for Help** and confirm RustDesk starts with the blue "Screen sharing is starting" banner.
5. Reboot and confirm the PIN and reminders still work.

## 15-Minute Caregiver Setup

For a full end-to-end walkthrough, run through this checklist on a fresh boot. Each step has a plain-English result you can verify.

- [ ] **0–2 min** — Confirm the home screen shows six large tiles and that the text is comfortable to read.
- [ ] **2–4 min** — Open **Caregiver Settings**. On first use you will be asked to **set a PIN** (at least 4 numbers). Save it somewhere safe — there is no default PIN and it cannot be recovered.
- [ ] **4–5 min** — Set **Text size** to Large or Extra Large. Check that labels and buttons still fit on screen.
- [ ] **5–7 min** — Open **Daily Reminders**. Add two reminders with times (for example "Call Anna" at 5:00 PM), press **Mark Done** on one, then press **Start a new day** to see the reset.
- [ ] **7–9 min** — Open **Web & Email**. Confirm Firefox opens, uBlock Origin is present, and sites are upgraded to HTTPS. Check that no notification or location pop-ups appear.
- [ ] **9–10 min** — Open **Photo Album** and view a photo.
- [ ] **10–12 min** — Open **Ask for Help**. Confirm the blue "Screen sharing is starting" banner, then make sure RustDesk opens and that sharing can be stopped inside it.
- [ ] **12–13 min** — In **Caregiver Settings**, open **Wi-Fi & Network**, **Printers** and **Open RustDesk**. Confirm each opens and closes cleanly.
- [ ] **13–14 min** — Choose **Check for updates**. You should see a short sentence such as "Your system is up to date. Version 41."
- [ ] **14–15 min** — Reboot. Confirm the PIN still unlocks Settings and both reminders are still on the list.

---

## Contributing

Contributions are welcome. Please keep changes focused, documented, and aligned with the accessibility and safety principles above. This project is in an early stage, so expect the structure to grow.

## Licence

SimpleOS is released under the [MIT License](LICENSE).
