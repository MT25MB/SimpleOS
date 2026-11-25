# SimpleOS launch copy

Drafts for announcing SimpleOS. Nothing here is published yet — copy, adapt, and
post only where it fits the community rules. Every draft is written to stand on
its own, and every draft includes both links.

- Repository: <https://github.com/MT25MB/SimpleOS>
- Website: <https://mt25mb.github.io/SimpleOS/>

## Current state — read before posting

| Fact | Why it matters |
| --- | --- |
| Published releases: `v0.1.0`, `v0.2.0`, `v0.3.0`, `v1.0.0`, `v1.1.0`, `v1.2.0`, `v1.2.1` and `v1.2.2` | Do not call `v0.1.0` the current release. |
| `v1.2.2` is the current release; it ships a downloadable ISO | Say "latest release is v1.2.2". |
| 224 automated tests pass on `main` | A real, verifiable number — safe to state with the date. |
| Free, MIT licensed, no account or tracking | True for the whole project. |
| Caregiver PIN has no recovery path yet | A real limitation. State it rather than hiding it. |
| Remote help uses RustDesk and needs setup | Never imply anyone can connect without the person's knowledge. |

Say **early and actively developed**, not "finished", "battle-tested", or
"used by thousands". There are no user numbers, testimonials, or clinical
claims to cite.

---

## 1. Caregiver and family communities

Good places: caregiver forums, Aging Parents threads, local carers' groups,
friendly newsletters. These readers want to know: *will this make life calmer
for my person, and can I still help when I am not there?*

### Draft A — short post for a thread or group

**Subject:** A free, simple computer I built for older adults — would love honest thoughts

> I have been building a free computer setup for older adults, and it is at the
> stage where a few families can try it and tell me what is still confusing.
>
> The home screen is six big buttons: video calls, web and email, photos, daily
> reminders, asking for help, and caregiver settings. Text starts large, the
> cursor is big, and windows fill the screen so there is less to line up or
> click by accident. If the launcher ever closes, it comes straight back.
>
> A few things that matter for safety: websites are HTTPS only, ads and scam
> pop-ups are blocked, sites cannot ask for notification or location access,
> and the person using it has no admin rights. Updates install in one piece, so
> a bad update restarts into the version that worked before.
>
> I can connect with RustDesk when someone asks for help, and there is a PIN on
> the settings so the everyday account cannot wander into them.
>
> It is early — the latest published release is v1.2.2, and it is still being
> tested and improved. Two honest caveats: the caregiver PIN cannot be reset if
> forgotten, and remote help needs a one-time setup. I would rather say that up
> front.
>
> It costs nothing and needs no account. If you want to look:
> <https://mt25mb.github.io/SimpleOS/>
> Code and downloads: <https://github.com/MT25MB/SimpleOS>
>
> If you try it, I would really like to know which screen slowed you down.

### Draft B — longer post with the 15-minute setup

**Subject:** I made a calm, no-subscription desktop for older adults (free, early release)

> If you are helping a parent or partner who finds today's computers stressful,
> this might be useful. SimpleOS is a free Linux computer aimed at people who
> want fewer choices and bigger text.
>
> **What it feels like day to day**
>
> The screen opens full-size with six large buttons. There is no desktop full of
> icons, no right-click menus, and no terminal to stumble into. Text is at least
> 18 pixels and can be made larger with one control. The person can keep a short
> daily reminder list, open email and video calls, look at photos, and press one
> button to ask for help.
>
> **What is quietly protecting them**
>
> Firefox is set to HTTPS only, with an ad and scam blocker installed and locked
> in place. Websites cannot ask for notification or location permission. The
> daily account has no administrator rights, so a convincing pop-up cannot
> install software. The system files are read-only and updates are all-or-
> nothing; if an update misbehaves, a restart brings back the previous working
> version.
>
> **How you help from somewhere else**
>
> The Ask for Help button opens RustDesk so you can see the screen and talk them
> through a problem. They agree to the connection first, and you stop it when
> you are done. Caregiver settings sit behind a PIN.
>
> **Setup is something you do once, in about fifteen minutes**
>
> Get the image, put it on a USB stick with the safety-checked script, start the
> computer from the stick, connect Wi-Fi and a printer, then choose the PIN.
> The full walkthrough is here: <https://mt25mb.github.io/SimpleOS/caregiver-guide.md>
>
> **Where it stands honestly**
>
> This is an early project. The latest published release is v1.2.2. Two things
> are not done yet: a forgotten caregiver PIN
> cannot be recovered, and remote help needs a one-time setup by you. If either
> of those is a dealbreaker, wait a little.
>
> Free and open source, no account, no tracking:
> Website <https://mt25mb.github.io/SimpleOS/> ·
> Source and downloads <https://github.com/MT25MB/SimpleOS>
>
> I am looking for plain feedback: what was hard to read, what was hard to tap,
> and what wording felt wrong.

### Caregiver headlines — alternatives

| Option | Rationale |
| --- | --- |
| "A free, simple computer I built for older adults" | Leads with who it is for; no jargon. |
| "Six big buttons instead of a desktop full of icons" | Concrete and visual; easy to picture. |
| "A calmer computer for someone you care about" | Emotional but not manipulative; good for newsletters. |

### Caregiver CTAs — alternatives

| Option | Rationale |
| --- | --- |
| "If you try it, tell me which screen slowed you down." | Asks for specific, low-effort feedback. |
| "Have a look at the website and the caregiver guide." | Two soft steps, no commitment. |
| "Would this help someone you know? I would like honest thoughts." | Invites conversation rather than a sale. |

**Annotation:** benefits come before architecture. The phrase "hard to break by
accident" replaces "immutable" because it describes the outcome. "Restart into
the version that worked" replaces "atomic rollback". Long technical terms are
reserved for the second audience.

---

## 2. Technical and open-source communities

Good places: Show HN, Linux and Wayland communities, accessibility forums,
Fedora/Atomic discussion threads. These readers will ask *what is it actually
made of, and is it real?* Answer that in the first paragraph.

### Draft C — Show HN

**Title options**

| Option | Rationale |
| --- | --- |
| "Show HN: SimpleOS – an immutable, accessible Linux kiosk for older adults" | Describes the stack and the user in one line. |
| "Show HN: A bootc desktop with a locked-down Electron shell for seniors" | More technical; signals the interesting architecture. |

**Body**

> Hi HN — I built SimpleOS, an immutable Linux desktop aimed at older adults and
> the family members who support them. It is free and MIT licensed.
>
> The stack:
>
> - **Base:** `ghcr.io/ublue-os/base-main:latest`, a Fedora Atomic / bootc image.
>   Packages are layered with `rpm-ostree` and committed into the image, so
>   upgrades are atomic and the previous deployment can be booted again.
> - **Session:** labwc on Wayland, started through greetd autologin as an
>   unprivileged `senior` account that is never in wheel/sudo/admin. The
>   compositor config maximises every window, removes desktop mouse menus,
>   disables snapping, and overrides inherited terminal keybinds.
> - **Shell:** Electron + React + TypeScript. `contextIsolation: true`,
>   `nodeIntegration: false`, `sandbox: true`, `webSecurity: true`, a strict CSP,
>   navigation and new-window blocking, and a preload bridge exposing only
>   fixed methods. Every one of the 12 IPC handlers validates input and checks
>   the sender frame. Renderer input is only ever a key into a frozen allowlist —
>   never a command, argument, or path.
> - **Browser guardrails:** Firefox enterprise policies force HTTPS-only,
>   force-install and lock uBlock Origin, deny new extension installs, block
>   `about:config` and the add-ons manager, disable developer tools, and block
>   `file:`/`ftp:` navigation.
> - **Hardware:** firmware and Mesa drivers, NetworkManager, BlueZ,
>   power-profiles-daemon, CUPS, PipeWire/WirePlumber, brightnessctl and upower.
>   Power defaults avoid surprise suspend on lid close or idle.
> - **State:** reminders and a salted scrypt PIN hash are written atomically with
>   `0600` permissions. The PIN has a five-attempt, 30-second cooldown enforced
>   in the main process.
> - **Verification:** one `bash scripts/test-all.sh` runs 224 tests, type-check,
>   production build, shell syntax checks and a staged-artifact gate. The same
>   job gates image builds, Pages deploys and releases in CI. `scripts/test-vm.sh`
>   boots the image in QEMU/KVM with qcow2, ISO and reset modes; `scripts/build-iso.sh`
>   produces an installer; `scripts/flash-usb.sh` is a deliberately cautious writer.
>
> Accessibility is enforced, not aspirational: 18px minimum root font, WCAG AAA
> contrast tokens, 48px+ tap targets, visible focus rings, no zoom blocking, and
> tests that reject technical jargon in senior-facing components.
>
> Where it stands: the latest published release is v1.2.2. It is early and I
> would call it early-adopter ready, not production-hardened for everyone. Known gaps: no PIN recovery, and
> remote help via RustDesk needs a one-time setup. There is also one open
> moderate transitive dependency advisory in the repo that I am tracking.
>
> Website: <https://mt25mb.github.io/SimpleOS/>
> Source: <https://github.com/MT25MB/SimpleOS>
>
> Feedback on the architecture or the accessibility tradeoffs is very welcome —
> especially places where the guardrails are too strict or not strict enough.

### Draft D — Linux / accessibility forum post

**Subject:** Immutable, accessible desktop for older adults — architecture and honest limits

> I would like to share a project and get a technical review of the approach.
>
> SimpleOS is a kiosk-style desktop built on the uBlue Fedora Atomic base, with
> labwc on Wayland and greetd autologin into an unprivileged account. The shell
> is Electron + React/TypeScript running with full sandboxing and a narrow,
> allowlisted IPC bridge. Firefox is deployed with enterprise policies rather
> than extensions alone.
>
> The design goal is that a wrong click cannot ruin the computer: read-only
> system files, atomic updates with rollback, no admin rights for the daily
> user, no desktop menu, no terminal keybind, and a launcher that restarts
> itself. For accessibility, the floor is 18px text, AAA contrast, 48px+ targets
> and visible focus; tests check those rules so they do not drift.
>
> Concretely in the image: firmware and Mesa drivers, NetworkManager, BlueZ,
> power-profiles-daemon, upower, brightnessctl, CUPS and PipeWire. Hardware
> status, volume and brightness controls reach the shell through fixed, tested
> commands; the battery chip and brightness buttons disappear on desktops that
> do not have that hardware.
>
> What I would value feedback on:
>
> - Is the logind approach (`IdleAction=ignore`, lid switches ignored) the right
>   tradeoff for an unattended kiosk, or is there a cleaner way to avoid suspend
>   during a video call?
> - Are there Firefox policies I should add for scam reduction without breaking
>   ordinary sites?
> - Does the IPC sender check plus allowlists cover the realistic escape paths,
>   or am I missing one?
>
> Status: early. Latest release is v1.2.2. 224 tests pass locally and in CI.
> No PIN recovery yet.
>
> <https://github.com/MT25MB/SimpleOS> · <https://mt25mb.github.io/SimpleOS/>

### Technical headlines — alternatives

| Option | Rationale |
| --- | --- |
| "immutable, accessible Linux kiosk for older adults" | Leads with the two defining properties. |
| "bootc + labwc + locked-down Electron: a senior-friendly desktop" | Names the stack for an audience that values it. |

### Technical CTAs — alternatives

| Option | Rationale |
| --- | --- |
| "Feedback on the architecture or the accessibility tradeoffs is welcome." | Invites review, which suits these communities. |
| "Read the repo before you comment — the guardrails are documented." | Sets an expectation of substance. |

**Annotation:** for technical readers, specificity is credibility. Named
packages, flags, test counts and known gaps do more work than adjectives. The
CTA asks for review rather than adoption because the project is early.

---

## 3. Accuracy and tone check

Before posting any draft:

- [ ] Both links are present: <https://github.com/MT25MB/SimpleOS> and <https://mt25mb.github.io/SimpleOS/>
- [ ] Release framing is correct: v1.2.2 is the latest published release
- [ ] "Early", "testing" and "early adopter" are used; "battle-tested", "production-ready for everyone" and "thousands of users" are not
- [ ] No invented testimonials, user counts, download counts, or clinical/health claims
- [ ] "Unbreakable" is never used as a literal guarantee — prefer "hard to break by accident" and "restarts into the version that worked"
- [ ] Remote help is described as opt-in and caregiver-set-up, never as always-on access
- [ ] The two known limitations are mentioned where a reader would rely on them: no PIN recovery, RustDesk setup needed
- [ ] The test count (222) is restated with its date if the post will live for a while
- [ ] Caregiver copy contains no Linux jargon: no bootc, rpm-ostree, IPC, CSP, compositor, scrypt, or QEMU
- [ ] Technical copy does not drift into marketing adjectives
- [ ] Community-specific rules are checked before posting (self-promotion limits, title formats, flair)

## Assumptions made in these drafts

- No audience size, email list, or prior launch is known, so no owned-channel or
  waitlist claims are made.
- No permissions to publish were given; these are drafts only.
- The website at `mt25mb.github.io/SimpleOS/` was reachable when these drafts
  were written, and the repository is public.
- The 222-test figure is accurate as of this document; re-run
  `bash scripts/test-all.sh` before restating it later.
