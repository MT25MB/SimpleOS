# SimpleOS unattended installer kickstart.
# Rendered by scripts/build-iso.sh, which replaces @IMAGE_REF@ with the image
# being installed. The installer wipes the chosen target disk completely.
lang en_US.UTF-8
keyboard us
timezone UTC

# Boot straight into the graphical kiosk session (greetd -> labwc -> shell).
xconfig --startxonboot

# Use the whole target disk and create a clean GPT layout. Caregivers are warned
# in docs/usb-install.md that everything on that disk will be erased.
zerombr
clearpart --all --initlabel
autopart --type=plain
bootloader --location=mbr

# First boot needs the network for Flathub and the core applications.
network --bootproto=dhcp --device=link --activate

# No root password and no user prompts: simpleos-firstboot.service creates the
# locked-down "senior" account after installation.
rootpw --lock
firstboot --disable
services --enabled=greetd.service

# Install this bootc image as the operating system. @IMAGE_REF@ pins the image
# used to build the installer; @TARGET_IMAGE_REF@ is what the installed system
# tracks for updates (release ISOs use :latest so updates keep working).
bootc --source-imgref @IMAGE_REF@ --target-imgref @TARGET_IMAGE_REF@

# Finish and restart into SimpleOS.
reboot
