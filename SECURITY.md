# Security Policy

SimpleOS is built for people who should never have to think about security. That makes a kiosk escape or a privilege boundary failure especially serious. If you find one, please tell us privately so we can fix it before it is used against someone.

## Reporting a vulnerability privately

**Do not open a public issue for a security problem.**

Use GitHub's private vulnerability reporting for this repository:

<https://github.com/MT25MB/SimpleOS/security/advisories/new>

That form is visible only to the maintainers. If it is unavailable to you, ask for a private channel through the repository's GitHub profile rather than posting the details in a public issue, comment, or discussion.

Please include:

- What you found, in one or two sentences
- The version or commit you tested (for example `main` at `80110ab`)
- Step-by-step instructions to reproduce it
- What an attacker could do as a result
- Whether you have already told anyone else or published it
- A suggested fix, if you have one

You do not need a proof of concept that causes damage. A clear description of the path is enough. Please do not test against any machine you do not own or have explicit permission to test.

We will acknowledge your report as soon as we can, investigate, and keep you informed as we work on a fix. This is a volunteer project, so we do not offer a formal response time, but we treat escape and privilege reports as high priority. Once a fix is available we will agree on disclosure timing with you, credit you if you wish, and publish a GitHub Security Advisory.

For harassment or conduct issues, use the private reporting method in [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) instead.

## What is in scope

- Escaping the launcher into a desktop, shell, terminal, or file manager
- Gaining `sudo`, `wheel`, root, or any administrative capability as `senior`
- Bypassing the caregiver PIN, its cooldown, or the IPC sender/allowlist checks
- Defeating the Electron sandbox, navigation locks, new-window denial, or content security policy
- Bypassing Firefox's HTTPS-only mode, uBlock enforcement, extension lock, or `about:config` block
- Reading or writing another user's reminders or PIN hash
- Unsafe behaviour in `scripts/flash-usb.sh`, such as writing to the running system disk
- Injecting a command through any IPC handler or configuration file
- Security-relevant flaws in the image build or CI workflows

## What is usually out of scope

- Problems that require physical access to the machine or a password the attacker already has
- Social engineering of a caregiver or the person using the computer
- Vulnerabilities in upstream Fedora, uBlue, Electron or Firefox that we have simply inherited — please report those to the upstream project; we will still accept a note so we can update
- Reports that only say "this is insecure" with no reproducible path
- Denial of service that requires the attacker to already control the local account

If you are unsure whether something is in scope, send the private report anyway. We would rather read it than miss it.

## Supported versions

| Version | Supported |
| --- | --- |
| Current `main` | Yes |
| `v1.1.0` (latest release) | Yes |
| `v0.2.0` and earlier | No — historical prototypes |

Fixes land on `main` first and are included in the next tagged release.

## Safe defaults we expect contributors to preserve

These are the boundaries a change must not weaken without an explicit security review:

- `senior` is never in `wheel`, `sudo` or `admin`
- The Electron renderer has `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` and `webSecurity: true`
- Every IPC handler validates its input and checks that the sender is the launcher's own main frame
- Renderer input is only ever a key into a frozen allowlist, never a command, argument or path
- PINs are stored only as a salted scrypt hash with constant-time comparison
- The compositor keeps a large cursor, no desktop right-click menu and no terminal shortcut
- All error text shown to the user stays in `messages.ts` and contains no technical detail

`bash scripts/test-all.sh` checks most of these. See [CONTRIBUTING.md](CONTRIBUTING.md) for the full contributor guide.
