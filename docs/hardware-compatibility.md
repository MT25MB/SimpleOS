# Hardware compatibility and setup checklist

SimpleOS runs on ordinary Intel and AMD computers. This page answers two
questions a caregiver usually has: *will it run on this machine?* and *what do I
need to plug in before I hand it over?*

Take it one step at a time. Nothing here is permanent, and none of these steps
can damage the computer.

## Minimum and recommended specifications

| Part | Minimum | Recommended |
| --- | --- | --- |
| Processor | 64-bit **x86_64** CPU with **UEFI** firmware | A newer Intel or AMD x86_64 CPU with UEFI |
| Memory | **4 GB RAM** | **8 GB RAM** or more |
| Storage | **32 GB SSD** or larger | **64 GB SSD** or larger |
| Graphics | Intel or AMD integrated graphics that can run Wayland and labwc | Any modern Intel or AMD integrated graphics |
| Sound | Standard USB audio, or a built-in microphone and speakers, for **Vosk** voice commands | Built-in microphone and speakers, or a simple USB headset |

A few notes in plain English:

- **x86_64** means a normal 64-bit Intel or AMD desktop or laptop. An ARM
  computer, a 32-bit-only PC, or a phone cannot run this image.
- **UEFI is required.** A computer that only offers Legacy BIOS will not boot
  SimpleOS. Nearly every machine sold in the last decade has UEFI.
- You do **not** need a separate graphics card. The desktop uses software
  rendering so older integrated graphics keep working.
- An SSD matters more than raw speed. A spinning hard drive will work, but
  everything feels slower.
- A microphone is only needed for Hold to Speak. If the person will not use
  voice commands, the other five buttons work without one.

## A calm setup checklist for caregivers

Do these steps while you still have the computer in front of you. If a step
does not match what you see, skip it and come back with the release notes or
the [USB install walkthrough](usb-install.md).

### 1. Check Secure Boot

Secure Boot is a safety feature that stops unsigned software from starting. The
official release ISO may start with it on. A locally built ISO is unsigned, so
you may need to turn Secure Boot off to install it.

1. Restart the computer and press the setup key as it starts. It is usually
   **F2**, **F10**, **F12**, **Delete**, or **Esc**, depending on the make.
2. Look for a tab called **Security**, **Boot**, or **Authentication**.
3. Find **Secure Boot** and set it to **Disabled**. If the option is greyed
   out, set a supervisor password first, then come back to it.
4. Press **F10** to save and exit. The computer restarts.

Turning Secure Boot off does not erase anything or harm the computer. If you
see a black screen with a message like "Security Boot Fail", this is the step
to revisit. You can turn Secure Boot back on later if you want; SimpleOS does
not need it.

### 2. Start the computer from the USB stick

1. Plug the prepared USB stick into a USB port.
2. Restart the computer and press the boot-menu key. It is often **F12**,
   **Esc**, **F11**, or **F8**.
3. Choose the entry that names your USB stick. It may say **UEFI: ...** first.
   Pick the UEFI entry when there are two.
4. Press **Enter**. The installer starts.

Read each screen before you press anything. The installer only writes to the
disk you choose. When the install finishes, remove the USB stick when asked,
then restart. On the first start, give the computer a few minutes while it
sets up accounts and installs the built-in applications.

### 3. Connect speakers, a microphone, or a webcam

For a video call with family, the computer needs a camera, a microphone, and
something to hear through.

- **USB devices:** plug them in. SimpleOS uses them straight away, with no
  setup screen and no driver install.
- **Built-in devices:** most laptops already have a microphone, speakers, and
  a camera. Nothing to plug in.
- **Bluetooth devices:** pair these once during setup, before you hand the
  computer over. The home screen does not have a Bluetooth menu, so a
  caregiver should do this part. If pairing is awkward, a USB device or a USB
  Bluetooth receiver is the simpler and more reliable choice.

The browser is already set up so the family video rooms can use the camera and
microphone without repeated permission questions. Other websites are not
allowed to ask.

### 4. Check the Wi-Fi driver

Most common Intel and AMD Wi-Fi cards work because the image includes
`linux-firmware` and NetworkManager. To check yours:

1. Open **Caregiver Settings** with the PIN.
2. Choose **Wi-Fi & Network**. A window lists the networks in range.
3. Pick your network and connect. If a password is needed, enter it here.
4. Close the window with the **Back to SimpleOS** button.

The header shows the connected network name, or a clear "Not connected to
Wi-Fi" message. If no networks appear at all:

- check that the laptop's Wi-Fi is not switched off with a physical switch or
  an **Fn** key;
- move closer to the router and try again;
- ask a caregiver to choose **Check for updates** in Caregiver Settings;
- if the card is unusual, a small USB Wi-Fi adapter with a common chipset is
  an easy fix.

### 5. Using SimpleOS in VMware (or another virtual machine)

SimpleOS fills the **guest display** — the screen area inside the virtual
machine. It always keeps the correct aspect ratio. If the picture inside the
VMware window looks stretched sideways, or has black bars around it, that is
VMware scaling the guest display to fit the host window, not a problem with
SimpleOS.

In VMware Workstation, fix the display once:

1. With the virtual machine running, open the **View** menu.
2. Choose **Autofit**, then **Fit Guest Now**. This makes VMware keep the
   guest's shape (aspect ratio) and add small black bars instead of stretching.
   Do **not** choose **Stretch Guest**.
3. If you want the guest display to change size whenever you resize the VMware
   window, leave **Autofit Guest** switched on. Otherwise switch it off and use
   **Fit Guest Now** after resizing.

A 16:9 guest display (for example 1920 × 1080) is the best match for most
monitors. SimpleOS needs no extra display driver in VMware.

## If something looks wrong

| What you see | What to try |
| --- | --- |
| Black screen on first start | The machine needs UEFI. Check Secure Boot above. |
| The picture is stretched sideways in VMware | VMware menu **View → Autofit → Fit Guest Now**; do not use **Stretch Guest**. |
| No Wi-Fi networks at all | Check the Wi-Fi switch, then try a USB adapter. |
| No sound in a call | Plug in USB speakers, or check the volume buttons in the header. |
| Text is hard to read | Caregiver Settings, then Text size, then Large or Extra Large. |
| The Wi-Fi window will not close | Press the **Back to SimpleOS** button at the top of that window. |

## About this documentation

The SimpleOS documentation site is built to be readable. Text never drops
below **18px** and grows with the Text size control, colours meet **WCAG AAA**
contrast, and every link and button is at least **48 × 48px**. If anything on
these pages is hard to read or hard to press, please
[report it](https://github.com/MT25MB/SimpleOS/issues).
