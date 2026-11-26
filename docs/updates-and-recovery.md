# Updates, rollback, and routine care

This page is for the person who looks after the computer. It explains what
happens when SimpleOS updates itself, how to go back if an update causes trouble,
and what a calm monthly check looks like.

Nothing here needs a terminal. SimpleOS deliberately does not create an
administrator account, so there is no secret password to remember and no way for
the everyday user to change system files.

## How updates work

The system part of SimpleOS is **read-only**. Think of the operating system as a
sealed box that gets replaced as a whole, rather than a pile of files that get
edited one at a time.

- New versions arrive as a complete, ready-to-use copy of the system.
- The copy is downloaded quietly in the background while the computer is in use.
- It only takes effect the next time the computer starts. Until then, the person
  keeps using the version they already know.
- The previous working copy is kept. If a new version misbehaves, you can start
  from that older copy instead.
- Your reminders and your caregiver PIN are stored in your home folder, outside
  the sealed system. They are kept across updates and restarts.
- Firefox, Loupe and RustDesk are apps installed on first boot. They update
  themselves in the usual way and are separate from the system copy.

This is why a wrong click cannot damage the system files, and why an update that
goes wrong does not have to mean reinstalling everything.

## Checking for an update

1. Open **Caregiver Settings** and enter the PIN.
2. Look at the **Quick check** section. The **System** line says whether the
   version has been checked and what it found.
3. Press **Check for updates** if you want a fresh answer.

You will see one of three messages:

- **"Your system is up to date."** Nothing to do.
- **"An update is ready. Restart the computer to finish installing it."**
  Choose a good moment and restart.
- **"We couldn't check for updates just now."** Usually a temporary network
  problem. Try again later; the computer keeps working as it is.

## Before you restart into an update

- Let the person finish what they are doing. The restart closes the launcher.
- Connect the charger on a laptop. Do not unplug the computer while it is
  restarting into a new version.
- Make sure you still know the caregiver PIN. There is no way to recover a
  forgotten one, and that stays true after an update.
- Reminders save themselves, so there is no separate save step.

After the restart, give the computer a few minutes. The launcher comes back on
its own. Then check that a reminder is still on the list, that Wi-Fi is connected,
and that the PIN still opens Settings.

## If something goes wrong after an update

Common signs are: the launcher does not appear, the computer keeps restarting,
or an app that worked before no longer opens.

### First, try a plain restart

Restart once and wait a few minutes. Some first starts after an update need time
to finish setting things up.

### Start from the previous working version

If the problem is still there, use the boot menu. This does not delete anything
and does not need a password:

1. Turn the computer off.
2. Turn it on and, while it starts, hold **Shift** or tap **Esc** a few times.
   On some computers it is **F12** or **F8**. You should see a text menu.
3. Choose the older option — it may be called **previous deployment**,
   **Previous version**, or show an earlier date.
4. Let the computer start and check that the launcher is back.

Your reminders, PIN and files are still there, because they were never part of
the system copy that changed.

A boot-menu choice can be just for that one start. If the computer keeps going
back to the bad version, ask a technician to make the older version permanent.
On a system where someone has set up administrator access, the command is
`rpm-ostree rollback` followed by a restart. SimpleOS does not set up that
access by default, so this is normally a job for whoever installed the machine.

### If there is no older option in the menu

Boot from the USB installer you kept from setup and reinstall SimpleOS. Treat
this as a last resort: a reinstall may not keep everything in the home folder,
so ask for help before doing it if reminders matter.

## A calm monthly check

About once a month, or after any big change, open **Caregiver Settings** and read
the **Quick check** section:

- **Internet:** connected to the expected network? If not, press **Open Wi-Fi
  Settings**.
- **Sound:** ready? If not, press **Check again**. A temporary glitch often
  clears on its own.
- **Screen:** on a desktop, "no brightness control" is normal, not a fault.
- **Remote help:** is RustDesk installed and ready? If not, press **Check again**.
- **System:** check for updates and restart when one is ready.

Also worth doing:

- Confirm the printer still prints a test page.
- Confirm the person can open Video Call Family and Web & Email.
- Confirm the caregiver PIN still opens Settings.
- Keep the USB installer in a labelled place. Note where it is in the caregiver
  guide or on a sticky note.
- Write the PIN down somewhere safe. It cannot be recovered.

## What not to do

- Do not open a terminal or try Linux commands. There is deliberately no
  terminal shortcut on the desktop.
- Do not install browser extensions. Firefox is locked to an approved setup so
  that scam and ad blocking cannot be turned off by a webpage.
- Do not share the caregiver PIN with the everyday user unless you want them to
  change settings themselves.
- Do not delete files in the home folder to "clean up" — reminders live there.
- Do not turn the computer off in the middle of a restart that is installing an
  update.

## When to ask for help

Ask a technician or the project maintainers if:

- the computer will not start from either version;
- the same problem comes back after a rollback;
- the caregiver PIN is forgotten;
- a reminder or the PIN disappears after an update;
- you think a scam or malicious site may have been installed.

For security problems or ways to escape the kiosk, report privately through
[SECURITY.md](https://github.com/MT25MB/SimpleOS/blob/main/SECURITY.md), not in
a public issue.

## For maintainers: release checklist

This part is not for caregivers. It is the routine for keeping the repository
ready for the next tag.

1. Keep all finished work in `CHANGELOG.md` under `[Unreleased]`. Use the
   standard sections: Added, Changed, Fixed, Security.
2. Decide the version by compatibility, not by commit count: a bug fix is a
   **patch** (`0.3.1`), a backward-compatible feature is a **minor** (`0.4.0`),
   and a breaking change is a **major** (`1.0.0`). Never move or retag a
   published version.
3. Set the same version in `simpleos-shell/package.json`. It currently reads
   `1.4.0`, matching the latest release, `v1.4.0`.
4. Turn `[Unreleased]` into `[vX.Y.Z]`, add the compare link, and add a fresh
   empty `[Unreleased]` section with a link from the new version to `HEAD`.
5. Run `bash scripts/test-all.sh`. The same gate runs in CI and blocks the
   image, Pages and release jobs.
6. Commit with a short conventional message, then push `main`.
7. Tag and push the tag: `git tag -a vX.Y.Z -m "SimpleOS vX.Y.Z"` then
   `git push origin vX.Y.Z`. A tag matching `v*.*.*` triggers
   `.github/workflows/release.yml`, which re-runs the gate before publishing
   notes generated from the commit history.
8. Confirm the GitHub Release, the attached `.iso` asset and the GHCR image were
   published, then update this page if the supported-version table changes.
9. Keep the audited guardrails intact: the image must pass `bootc container lint`,
   first boot must keep its bounded retries and run-once marker, every Firefox
   policy key must match the official schema, and labwc must keep its `None`
   keybinds and `<initial>` workspace tag. The test suite checks each of these.

`README.md` intentionally does not hard-code a version, so it needs no edit for
a routine patch or minor release.

## Related pages

- [Caregiver guide](caregiver-guide.md)
- [Hardware support and power behaviour](hardware-support.md)
- [README](https://github.com/MT25MB/SimpleOS#readme)
- [Website](https://mt25mb.github.io/SimpleOS/)
