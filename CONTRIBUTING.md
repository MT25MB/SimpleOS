# Contributing to SimpleOS

Thank you for wanting to help. SimpleOS is a small, free project with a serious goal: a computer that is calm, readable and hard to break for people who do not want to fight with technology. Every improvement counts, whether it is a line of code, a clearer sentence, or a bug you took the time to report.

You do not need to be an expert. You do need to be kind — please read our [Code of Conduct](CODE_OF_CONDUCT.md) first.

## Ways to help

- **Tell us what is confusing.** If a screen, label or message is hard to understand, that is a real bug. Use the **Accessibility / Usability Feedback** issue template.
- **Report a bug.** Use the **Bug Report** template. Tell us what you expected and what happened instead.
- **Suggest something for caregivers.** Use the **Caregiver Feature Request** template and describe the real situation it would help with.
- **Improve the docs.** The [caregiver guide](docs/caregiver-guide.md), [README](README.md) and [hardware notes](docs/hardware-support.md) are all plain Markdown. Fixing a wrong or unclear sentence is a perfectly good first contribution.
- **Write code.** See the rules below, then open a pull request.

For security problems and kiosk escapes, **do not open a public issue**. Follow [SECURITY.md](SECURITY.md) instead.

## Getting set up

You need:

- Node.js 20 or newer and npm, for the launcher
- Git
- Podman and sudo, if you want to build the image and ISO
- QEMU with KVM, if you want to boot the result on a Linux machine

Clone your fork and install the launcher dependencies:

```sh
git clone https://github.com/<your-account>/SimpleOS.git
cd SimpleOS
cd simpleos-shell && npm ci && cd ..
```

## Run the tests

One command checks the whole repository:

```sh
bash scripts/test-all.sh
```

It runs the full Vitest suite, type-checks and builds the launcher, checks every shell script with `bash -n`, and refuses staged build artifacts or disk images. CI runs this same command, so if it passes here it should pass there.

While working on the launcher only, the shorter loop is:

```sh
cd simpleos-shell
npm run test
npm run build
```

Tests that change a configuration file are often _contract tests_: they read the real `Containerfile`, policy JSON, workflow YAML or script and check the safety rule directly. If you change one of those files, expect a test to need updating too. Do not weaken a test just to make it pass — work out what guarantee it was protecting.

## Test your change in a real boot (QEMU/KVM)

The automated suite cannot prove that the desktop boots. For changes to `os-image/`, `system-configs/` or the shell, please also boot the image:

```sh
# On a Linux host with KVM:
sudo apt install qemu-kvm qemu-system-gui qemu-utils ovmf   # Debian/Ubuntu
# or: sudo dnf install @virtualization qemu-img ovmf        # Fedora

bash scripts/test-vm.sh          # build the image and boot the disk
bash scripts/test-vm.sh --reset  # start over and test first boot again
bash scripts/test-vm.sh --iso    # build an ISO and boot the installer
```

Give the VM **UEFI**, at least **4 GB RAM**, **2 CPUs** and **20 GB disk**. The first boot signs in as `senior`, creates the account, adds Flathub and installs Firefox, Loupe and RustDesk. Give it a few minutes before the launcher appears.

The disk stays at `build-vm/simpleos-test.qcow2`, so reminders and settings survive between runs. Use `--reset` when you specifically want to test first boot. `build-vm/` is gitignored — never commit a disk image or ISO.

If you need to check the exact QEMU command, see the [virtual machine section of the README](README.md#testing-in-a-virtual-machine).

## Accessibility rules — not optional

The person using SimpleOS may have poor eyesight, shaky hands, or little patience for computers. These are hard rules, checked by tests in `simpleos-shell/src/accessibility-defaults.test.ts`:

- **Text is at least 18px.** The root is `max(1.125rem, ...)` in both `simpleos-shell/src/styles.css` and `docs/styles.css`. The text-size control may only make it bigger. Never hard-code a smaller font size for senior-facing text.
- **Contrast is WCAG AAA.** Body text is `#f8fafc` on `#0b1120` (over 7:1). Use the existing colour tokens; if you add a pair, measure it before submitting.
- **Tap targets are at least 48 × 48px.** App buttons are `3.25rem`, small controls are `3rem`, and font-scale options are `3rem` at the 18px root. Do not shrink them to fit more on screen.
- **Focus is always visible.** Interactive elements keep a bright outline (4px in the app, 3px on the site). Never remove `:focus-visible`.
- **Keyboard and zoom must keep working.** Do not add `maximum-scale=1` or `user-scalable=no`, and make sure every new control can be reached with Tab and activated with Enter or Space.
- **No motion traps.** Avoid flashing, rapid animation, or anything that moves on its own for long.

## Plain-English UI rules

SimpleOS speaks to people, not to developers. A technical message is a bug even when the code works.

- Put **every** error string in `simpleos-shell/src/messages.ts`. The main process sends a short code such as `PIN_INCORRECT`; the renderer maps it to a calm sentence. Never show a raw error, exception, stack trace, code, path or command in the UI.
- Write short, specific sentences. Say **"That PIN isn't right. Try again."**, not "Authentication failure: invalid credentials".
- Say what to do next. **"We couldn't check for updates just now. Try again in a few minutes."** tells the user more than "Update check failed".
- Never blame the person. Avoid words like *failed*, *invalid*, *error*, *fatal* and *illegal* in senior-facing screens.
- Keep the same tone in the website, the caregiver guide, issue templates and commit messages. Tests check that user-facing components contain no jargon.

If you are unsure whether a sentence is plain enough, read it out loud as if you were explaining it to someone on the phone who has never used a computer.

## Pull requests

1. Fork the repository and make a small branch from `main`.
2. Keep changes focused. One idea per pull request is much easier to review.
3. Run `bash scripts/test-all.sh` and, for boot-related work, `bash scripts/test-vm.sh`.
4. Use a short conventional commit message such as `fix: keep focus ring on new control` or `docs: clarify printer setup`.
5. In the PR, say **what changed, why, and how you checked it**. If you could not test a real boot, say so.
6. All CI checks must be green before merge. Image, Pages and release workflows all depend on the same test gate.

We review kindly and assume good intent. If we ask for changes, it is about the work, not about you.

## Where things live

| Path | What it holds |
| --- | --- |
| `os-image/Containerfile` | Immutable bootc image definition |
| `system-configs/` | labwc, greetd, Firefox and systemd guardrails |
| `simpleos-shell/electron/` | Main process, preload bridge, allowlists, PIN crypto |
| `simpleos-shell/src/` | React renderer, hooks, styles and tests |
| `scripts/` | ISO, VM, flash, release-notes and test scripts |
| `docs/` | Website, caregiver guide and brand assets |
| `scripts/render-guides.mjs` | Generates the styled guide pages from `docs/*.md` |
| `.github/workflows/` | Test gate, image, Pages and release automation |

After editing a Markdown guide, run `node scripts/render-guides.mjs` so its HTML page picks up the change. The generator copies the site's real header and footer, so both stay in sync.

## License

By contributing you agree that your work is released under the [MIT License](LICENSE).
