# Caregiver Guide

This guide is for the person who sets up SimpleOS. You do the tricky bits once. After that, the person using the computer should be able to manage on their own.

Take your time. Nothing you do here can break the computer permanently. The system files are read-only, so a wrong click cannot damage them.

## Before you start

You need:

- A USB stick of at least 8 GB. Everything on it will be erased, so use one you do not need.
- A computer with internet access to download the image.
- About 15 minutes, plus time for the first boot to finish installing apps.

## 1. Get SimpleOS

Download the latest release from [GitHub](https://github.com/MT25MB/SimpleOS/releases). The file you want ends in `.iso`.

If you would rather build it yourself, you can do that on a Linux computer. The README has the commands. Both ways cost nothing.

## 2. Put it on the USB stick

On a Linux computer, open a terminal in the downloaded project and run:

```sh
bash scripts/flash-usb.sh path/to/simpleos.iso /dev/sdX
```

Replace `/dev/sdX` with the name of your USB stick. The script prints the model and size first so you can check. Type `FLASH` only when you are sure.

If you want to look before writing anything, add `--dry-run` at the start. It shows the device details and stops.

A warning: flashing erases the whole drive. If the script says the disk is mounted or is the computer's own system disk, stop. Choose a different drive.

## 3. Install and connect

Start the target computer from the USB stick. You may need to press a key such as F12 or Esc to pick a boot device. Choose the USB stick and pick the UEFI option if you see one.

Follow the prompts to install SimpleOS. When it finishes, take out the USB stick and let the computer restart.

The first start takes a few minutes. The computer signs in as `senior`, creates the account, adds the app store and installs Firefox, the photo viewer and RustDesk. Leave it alone while this happens.

### Wi-Fi

1. Open **Caregiver Settings** from the home screen.
2. Choose **Wi-Fi & Network**.
3. Pick your network and enter the password.

The top of the home screen always tells you whether Wi-Fi is connected and to
which network. If it says **Not connected to Wi-Fi**, press **Open Wi-Fi
Settings** — that button takes you straight there. On a laptop you will also see
the battery level and whether it is charging. The computer will not drop into
sleep in the middle of a call, even if the lid is closed.

### Printers

1. Open **Caregiver Settings**.
2. Choose **Printers**.
3. Add the printer and accept the suggested driver.

## 4. Set the caregiver PIN

Caregiver Settings is protected so the everyday user cannot change these options by accident.

1. On the first visit you are asked to **set a PIN**.
2. Use at least four numbers. Twelve at most.
3. Write it down and keep it somewhere safe. There is no way to reset a forgotten PIN yet.

To change it later, open Caregiver Settings, enter your current PIN, then choose a new one. The old PIN will stop working straight away.

The PIN is not stored as plain text. The computer keeps a scrambled version, so reading the file would not reveal your numbers.

## System health and safe recovery

Caregiver Settings also has a **System health and safe recovery** section. It
shows six short lines: internet, sound, microphone, disk space, system version
and when updates were last checked. Press **Copy Health Summary** to copy those
six lines only. The summary never includes your files, reminders, Wi-Fi name or
PIN, so it is safe to paste into a support message or GitHub issue.

Three safe actions are available, and each asks you to confirm first:

- **Restart Launcher** closes and reopens the home screen. Reminders are already
  saved.
- **Check for OS Updates** looks for a newer system version. It changes nothing
  by itself.
- **Roll Back Last OS Update** returns to the previous system version if an
  update caused trouble. Your files, reminders and PIN stay, and the computer
  restarts. This is allowed only for this one recovery step — the everyday
  account still has no administrator rights.

## Family call cards and the photo frame

Inside **Caregiver Settings** you can add up to four people in **Family call
cards**. For each person, enter their name, relationship, a video room link, and
optionally a photo. Only links from approved video sites are accepted, so a
mistyped or unsafe link will not be saved. Save the cards, and the **Video Call
Family** button on the home screen will show one big card per person with a
single **Call Now** button.

The video room opens in the locked-down Firefox. If no cards have been added
yet, the button still opens a general video call.

You can also turn on the **Photo frame**. Choose Off, 2, 5, 10 or 15 minutes.
After that time with no activity, the screen shows local family photos from
`~/Pictures/SimpleOS/` with a large clock and date. Any click or key press brings
the launcher straight back. No photos are uploaded anywhere.

## 5. Make the screen comfortable

Still in Caregiver Settings, look for **Text size**. Try **Large** or **Extra Large** and ask the person which feels best. The choice is saved, so it stays after a restart.

The mouse pointer is already large, and windows open full screen so there is less to line up or line out.

For quick fixes, the top of the home screen has big **Softer**, **Louder** and **Mute** buttons for sound, and **Darker** and **Lighter** buttons for the screen. The screen buttons only appear on a laptop, where there is a backlight to adjust.

**Read Aloud** is a big button in the header. Press **Read Aloud: Off** once and the computer will say the name of the screen and its buttons in plain speech. While it is reading, the button says **Stop Reading**; press it once, or press Escape, to stop straight away. Press the button again later to turn reading off.

**Hold to Speak** lets the person use their voice instead of a button. Hold it, say one of five short commands, then let go. The computer shows exactly what it heard and asks you to press **Confirm** before anything happens. The commands are: "Open Video Call", "Open Internet", "Read Reminders", "Ask for Help", and "Go Home". If the microphone or the offline voice files are not set up, the button is replaced with a plain message. No recording is ever sent to the internet — it is turned into text on the computer itself.

## 6. Ask for Help with RustDesk

The **Ask for Help** tile opens RustDesk. This lets someone you trust see the screen and guide the person through a problem.

1. Agree with the person first before you connect. They should know you are looking.
2. Open RustDesk on both computers and use the ID and password shown on theirs.
3. When you are finished, stop the shared session on their computer.

The launcher shows a blue banner while screen sharing is starting, so it is clear what is happening. RustDesk stays installed but nothing is shared until someone connects.

## 7. Daily Reminders

The **Daily Reminders** tile opens a short list.

- Add a reminder by typing what is needed, for example "Call Anna", and a time if it matters.
- Press **Mark Done** when it is finished.
- Press **Remove** to take something off the list.
- Press **Start a new day** to clear the done marks. The reminders themselves stay.

Reminders are saved on the computer. They survive a restart, and they come back each morning ready to use again.

## When something needs attention

**A reminder will not save.** Check that the words are not too long and the time looks like `17:00`. The screen will tell you in plain language what to try. If it keeps failing, restart the computer once.

**An app will not open.** Go back to the home screen and press the tile again. If it still fails, the app may still be installing after a first boot. Wait a few minutes and try once more.

**The screen is empty.** The launcher restarts itself if it ever closes. Wait a moment. If it does not return, restart the computer. Nothing is lost.

**The computer asks for a PIN you do not know.** There is no recovery yet. If it is the caregiver PIN, you will need to reinstall and set a new one. This is why writing it down matters.

**An update is available.** Open **Caregiver Settings** and choose **Check for updates**. You will see a short sentence saying what is happening. Updates are installed when the computer restarts, and the previous version is kept if something goes wrong.

For the full walkthrough, including how to start the computer from the previous version if an update causes trouble, see [Updates and recovery](updates-and-recovery.md).

## Passing the computer over

Before you hand it back:

1. Restart once and check that the PIN still opens Settings.
2. Check that a reminder is still on the list.
3. Show the person the six big buttons and how to get back home.
4. Let them try it while you are still in the room.

That is the whole job. After this, they should be able to use the computer without you.
