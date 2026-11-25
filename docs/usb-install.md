# Installing SimpleOS from a USB stick

This guide is for a caregiver. It takes about 15 minutes once you have the
installer file. Read it before you start, because one step erases a USB stick.

## What you need

- A USB stick of at least 8 GB. **Everything on it will be erased.**
- The SimpleOS installer file (an `.iso`), or a Linux computer to build one.
- About 15 minutes, plus a few minutes for the first start to finish setup.

## 1. Get the installer

### The easy way

Download the latest installer from the [releases page](https://github.com/MT25MB/SimpleOS/releases). The ISO is larger than GitHub's limit for a single download, so it is attached as numbered parts plus a checksum.

**Easiest:** download `combine-iso-parts.bat` (Windows) or `combine-iso-parts.sh` (Linux/macOS) along with all the parts and the `.sha256` file. Put them in one folder and run the script. It joins the parts, checks the hash, and tells you when the ISO is ready. The manual steps below do the same thing without a script.

**On Windows**, open Command Prompt in that folder. Put the part names from the release page into this command, in order:

```bat
copy /b SimpleOS-vX.Y.Z.iso.part0+SimpleOS-vX.Y.Z.iso.part1+SimpleOS-vX.Y.Z.iso.part2 SimpleOS-vX.Y.Z.iso
certutil -hashfile SimpleOS-vX.Y.Z.iso SHA256
```

The hash must match the value in the `.sha256` file you downloaded. If there are more parts, add them to the `copy` command in order.

**On Linux or macOS**, open Terminal in that folder:

```sh
cat SimpleOS-*.iso.part* > SimpleOS.iso
sha256sum -c SimpleOS-*.iso.sha256
```

On macOS use `shasum -a 256 -c SimpleOS-*.iso.sha256`. If the check passes, continue below with the joined `.iso`.

### Build it yourself (Linux)

On a Linux computer with Podman and sudo:

```sh
git clone https://github.com/MT25MB/SimpleOS.git
cd SimpleOS
bash scripts/build-iso.sh
```

The ISO appears in `output/`. Add `--build` if you also want to build the
system image locally first.

## 2. Put the installer on a USB stick

Pick **one** method.

### Linux — the SimpleOS script (recommended on Linux)

Plug in the USB stick, find its device name with `lsblk`, then run:

```sh
bash scripts/flash-usb.sh output/simpleos.iso /dev/sdX
```

Replace `/dev/sdX` with the real name of your USB stick. The script prints the
model and size first. It refuses the computer's own system disk and any mounted
drive. Type `FLASH` only when you are sure. Add `--dry-run` to look first.

### Windows or macOS — a graphical tool

- **Fedora Media Writer** (<https://getfedora.org/workstation/download>) is simple and free.
- **Balena Etcher** (<https://www.balena.io/etcher/>) also works.

Choose the downloaded `.iso`, choose the USB stick, and start. Both tools ask
you to confirm because the stick will be erased.

**Stop now if you are unsure which drive is the USB stick.** Choosing the wrong
one can erase the computer you are using.

## 3. Boot from the USB stick

1. Plug the stick into the computer that will run SimpleOS.
2. Start the computer and press the boot-menu key. It is usually **F12**, **Esc**
   or **F8**, depending on the computer. Choose the USB device. Pick the UEFI
   option if you see one.
3. The installer starts. It uses the whole disk and creates the partitions
   automatically. There is no root password and no user-creation question:
   SimpleOS sets up the `senior` account on first boot.
4. Wait for the installation to finish. The computer restarts.
5. Remove the USB stick when asked, or once the restart begins.

## 4. Finish the caregiver setup

On the first start, the computer signs in by itself as `senior`. Give it a few
minutes while it creates the account, adds the app store and installs Firefox,
the photo viewer and RustDesk.

Then open **Caregiver Settings** and:

1. Set a caregiver PIN of at least four numbers. Write it down — it cannot be
   recovered if forgotten.
2. Connect Wi-Fi and add a printer if you need one.
3. Add up to four family contact cards, each with a video room link.
4. Choose a text size, and decide whether to turn on Read Aloud, Hold to Speak,
   the photo frame and the health checks.
5. Show the person the six big buttons and let them try while you are still there.

The full walkthrough is in the [caregiver guide](caregiver-guide.md). If an
update ever causes trouble, [Updates and recovery](updates-and-recovery.md)
explains how to go back to the previous version.

For security problems, report privately through
[SECURITY.md](https://github.com/MT25MB/SimpleOS/blob/main/SECURITY.md), not in
a public issue.
