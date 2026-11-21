# SimpleOS

**SimpleOS** is a free, open-source, immutable Linux operating system designed for older adults and anyone who finds modern desktop computing stressful.

It is built around one idea: a computer should be dependable, readable, and hard to break by accident.

> **Status:** Functional prototype. The immutable image, accessible desktop, launcher, reminders, and caregiver tools are implemented; the ISO build and CI are automated. Features continue to be refined.

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

The technical foundations this scaffold is preparing for:

- A **bootable container** based on uBlue's immutable base (`os-image/Containerfile`) for versioned, atomic system builds.
- A **labwc** Wayland desktop tuned for readability: dark high-contrast background, 48px cursor, 18px text, maximized windows, no root menu (`system-configs/labwc/`).
- **greetd autologin** into an unprivileged `senior` account (`system-configs/greetd/`).
- **Firefox enterprise policies**: forced HTTPS-Only mode, forced uBlock Origin, blocked extension installs, no notification/location prompts, simple bookmarks (`system-configs/firefox/`).
- A **first-boot setup service** that creates the account, adds Flathub, and installs Firefox, Loupe, and RustDesk (`system-configs/systemd/`).
- A lightweight **React + TypeScript + Electron** shell (`simpleos-shell/`) for guided setup and helper utilities.
- **Reproducible build scripts** and free CI (`.github/workflows/`, `scripts/`).

---

## Repository layout

```
.
├── os-image/                    # Container / system image definition
│   └── Containerfile
├── system-configs/              # Configuration copied into the image
│   ├── labwc/                   # Desktop (autostart, rc.xml, environment)
│   ├── greetd/                  # Autologin into the "senior" session
│   ├── firefox/                 # Browser policies
│   └── systemd/                 # First-boot service and helper script
├── simpleos-shell/              # React + TypeScript + Electron helper app
├── scripts/                     # Build and developer helper scripts
│   └── build-iso.sh
└── .github/workflows/           # Free CI: build and validate the image
    └── build-image.yml
```

---

## Build and test for $0

Everything below uses only free, open-source tooling and free tiers. No paid accounts, cloud credits, or proprietary licences are required.

### Prerequisites (all free)

- **Podman** and **sudo** — the image build and ISO generation. ISO generation requires Podman because `bootc-image-builder` mounts host container storage.
- **Git**, **Node.js + npm** — helper shell development.
- **QEMU/KVM** or **VirtualBox** — to boot the ISO in a virtual machine.
- A **GitHub** account — free CI and `ghcr.io` image hosting.

### 1. Build the ISO

```sh
# From the repository root: builds the image, then writes output/*.iso
bash scripts/build-iso.sh
```

To use the published image instead of building locally:

```sh
REMOTE_IMAGE=ghcr.io/your-username/simpleos:latest bash scripts/build-iso.sh --pull
```

Overrides: `IMAGE_TAG`, `OUTPUT_DIR`, `BUILDER_IMAGE`, `CONTAINER_ENGINE`. Run `bash scripts/build-iso.sh --help` for details.

To flash a USB stick, the script adds safety checks (removable-device check, unmounted check, an acknowledgement variable, and typed confirmation):

```sh
SIMPLEOS_CONFIRM_FLASH=YES bash scripts/build-iso.sh --flash /dev/sdb
```

**WARNING:** flashing erases everything on the target device. Back up your data first and double-check the device path.

### 2. Work on the helper shell

```sh
cd simpleos-shell
npm install
npm run dev        # web preview during development
npm run build      # TypeScript check + Vite bundle
```

### 3. Continuous integration

`.github/workflows/build-image.yml` rebuilds on every push to `main`, once a week (Monday 06:00 UTC), and on demand. It publishes `ghcr.io/<owner>/simpleos:latest` plus commit-SHA and weekly tags. Pull requests build without publishing. Everything runs on free GitHub runners.

---

## Quickstart for Testing in a VM

The ISO boots in **UEFI** mode. Give the VM at least **4 GB RAM**, **2 CPUs**, and **20 GB disk**. On first boot greetd signs in as `senior`, then the first-boot service creates the account, adds Flathub, and installs Firefox, Loupe, and RustDesk. Wait a few minutes for the home launcher to appear.

### Option A: QEMU/KVM (Linux)

Install the tools with your package manager:

```sh
# Debian / Ubuntu
sudo apt install qemu-kvm qemu-system-gui ovmf
# Fedora
sudo dnf install @virtualization ovmf
```

Create a virtual disk and boot the ISO:

```sh
qemu-img create -f qcow2 simpleos-test.qcow2 20G

qemu-system-x86_64 \
  -m 4096 -smp 2 -accel kvm \
  -bios /usr/share/OVMF/OVMF_CODE.fd \
  -cdrom output/bootiso/install.iso \
  -drive file=simpleos-test.qcow2,format=qcow2 \
  -display gtk
```

Adjust the OVMF path for your distribution (use `find /usr/share -name 'OVMF_CODE.fd'`). If KVM is unavailable, remove `-accel kvm` — it will be slower but still work. Keep the QCOW2 file between runs to preserve reminders and settings.

### Option B: VirtualBox

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

## 15-Minute Caregiver Setup

Run through this checklist on a fresh boot. Each step has a plain-English result you can verify.

- [ ] **0–2 min** — Confirm the home screen shows six large tiles and that the text is comfortable to read.
- [ ] **2–4 min** — Open **Caregiver Settings**. On first use you will be asked to **set a PIN** (at least 4 numbers). Save it somewhere safe — there is no default PIN and it cannot be recovered.
- [ ] **4–5 min** — Set **Text size** to Large or Extra Large. Check that labels and buttons still fit on screen.
- [ ] **5–7 min** — Open **Daily Reminders**. Add two reminders with times (for example "Call Anna" at 5:00 PM), press **Mark Done** on one, then press **Start a new day** to see the reset.
- [ ] **7–9 min** — Open **Web & Email**. Confirm Firefox opens, uBlock Origin is present, and sites are upgraded to HTTPS. Check that no notification or location pop-ups appear.
- [ ] **9–10 min** — Open **Photo Album** and view a photo.
- [ ] **10–12 min** — Open **Ask for Help**. Confirm the blue "Screen sharing is starting" banner, then make sure RustDesk opens and that sharing can be stopped inside it.
- [ ] **12–13 min** — In **Caregiver Settings**, open **Wi-Fi & Network** and **Printers**. Confirm each opens and closes cleanly.
- [ ] **13–14 min** — Choose **Check for updates**. You should see a short sentence such as "Your system is up to date. Version 41."
- [ ] **14–15 min** — Reboot. Confirm the PIN still unlocks Settings and both reminders are still on the list.

---

## Contributing

Contributions are welcome. Please keep changes focused, documented, and aligned with the accessibility and safety principles above. This project is in an early stage, so expect the structure to grow.

## Licence

SimpleOS is released under the [MIT License](LICENSE).
