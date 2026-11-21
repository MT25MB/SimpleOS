#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Write a SimpleOS ISO to a USB stick or spare disk.
#
# This script is deliberately cautious. It refuses to touch the disk that runs
# the current system, refuses mounted disks, shows exactly what it found, and
# will not write anything until you type FLASH.
#
# Usage:
#   bash scripts/flash-usb.sh OUTPUT/simpleos.iso /dev/sdX
#   bash scripts/flash-usb.sh --dry-run OUTPUT/simpleos.iso /dev/sdX
# -----------------------------------------------------------------------------

set -euo pipefail

SCRIPT_NAME="$(basename -- "$0")"
DRY_RUN=0
ISO_PATH=""
DEVICE=""

die() {
  echo "ERROR: $*" >&2
  exit 1
}

usage() {
  cat <<EOF
Usage: $SCRIPT_NAME [OPTIONS] <iso-file> <target-device>

Write a SimpleOS ISO to a USB stick or spare disk. The target must be a whole
disk, not a partition (use /dev/sdX, not /dev/sdX1).

Options:
  --dry-run    Inspect the device and show what would be written, then stop
  -h, --help   Show this help

Examples:
  bash $SCRIPT_NAME output/bootiso/install.iso /dev/sdb
  bash $SCRIPT_NAME --dry-run output/bootiso/install.iso /dev/nvme0n1

Safety:
  - Refuses the disk that boots this computer
  - Refuses any device with mounted partitions or swap
  - Requires you to type FLASH before writing
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    -*)
      die "Unknown option: $1 (try --help)."
      ;;
    *)
      if [[ -z "$ISO_PATH" ]]; then
        ISO_PATH="$1"
      elif [[ -z "$DEVICE" ]]; then
        DEVICE="$1"
      else
        die "Too many arguments (try --help)."
      fi
      shift
      ;;
  esac
done

[[ -n "$ISO_PATH" ]] || { usage >&2; die "Missing ISO path."; }
[[ -n "$DEVICE" ]] || { usage >&2; die "Missing target device."; }

# -------------------------------------------------------------- 1. ISO checks

[[ -f "$ISO_PATH" ]] || die "ISO file not found: $ISO_PATH"
[[ -r "$ISO_PATH" ]] || die "ISO file is not readable: $ISO_PATH"
ISO_BYTES="$(stat -c '%s' "$ISO_PATH")"
[[ "$ISO_BYTES" -gt 0 ]] || die "ISO file is empty: $ISO_PATH"

# ----------------------------------------------------------- 2. tool preflight

for tool in lsblk findmnt dd sync; do
  command -v "$tool" >/dev/null 2>&1 || die "Required tool '$tool' is not installed."
done

if [[ $(id -u) -eq 0 ]]; then
  SUDO=()
else
  command -v sudo >/dev/null 2>&1 || die "sudo is required to write to a disk."
  SUDO=(sudo)
fi

# ---------------------------------------------------------- 3. device identity

[[ -b "$DEVICE" ]] || die "Target is not a block device: $DEVICE"

DEV_NAME="$(basename "$DEVICE")"

# Work with the kernel name under /dev so symlinks and by-id paths resolve.
RESOLVED="$(readlink -f "$DEVICE")"
[[ -b "$RESOLVED" ]] || die "Could not resolve target device: $DEVICE"
DEV_NAME="$(basename "$RESOLVED")"

DEV_TYPE="$(lsblk -dn -o TYPE "$RESOLVED" 2>/dev/null | tr -d ' ' || true)"
[[ "$DEV_TYPE" == "disk" ]] ||
  die "Target must be a whole disk, not a '$DEV_TYPE'. Use /dev/sdX, not /dev/sdX1."

MODEL="$(lsblk -dn -o MODEL "$RESOLVED" 2>/dev/null | sed 's/^ *//;s/ *$//' || true)"
SIZE_BYTES="$(lsblk -dn -b -o SIZE "$RESOLVED" 2>/dev/null | tr -d ' ' || true)"
SIZE_HUMAN="$(lsblk -dn -o SIZE "$RESOLVED" 2>/dev/null | tr -d ' ' || true)"
REMOVABLE="$(lsblk -dn -o RM "$RESOLVED" 2>/dev/null | tr -d ' ' || true)"
ROTA="$(lsblk -dn -o ROTA "$RESOLVED" 2>/dev/null | tr -d ' ' || true)"

[[ -n "$SIZE_BYTES" ]] || die "Could not read the size of $RESOLVED."
if [[ "$ISO_BYTES" -gt "$SIZE_BYTES" ]]; then
  die "The ISO ($ISO_BYTES bytes) is larger than the target ($SIZE_BYTES bytes)."
fi

echo
echo "Target device : $RESOLVED"
echo "Model         : ${MODEL:-unknown}"
echo "Size          : ${SIZE_HUMAN:-unknown}"
echo "Bus type      : $(lsblk -dn -o TRAN "$RESOLVED" 2>/dev/null | tr -d ' ' || echo unknown)"
echo "Removable     : ${REMOVABLE:-unknown} (1 = yes, 0 = no)"
echo "Rotational    : ${ROTA:-unknown} (1 = spinning disk, 0 = SSD/USB)"
echo "ISO to write  : $ISO_PATH ($ISO_BYTES bytes)"
echo

# ---------------------------------------------- 4. block the current root disk

echo "Mounted filesystems and partitions on this device:"
MOUNTS="$(lsblk -n -o NAME,MOUNTPOINT,FSTYPE "$RESOLVED" 2>/dev/null || true)"
if [[ -n "$MOUNTS" ]]; then
  echo "$MOUNTS" | sed 's/^/  /'
else
  echo "  (none reported)"
fi

# The partition that holds / and the ones that hold boot must never be wiped.
ROOT_SOURCE="$(findmnt -n -o SOURCE / 2>/dev/null || true)"
for critical in / /boot /boot/efi /usr /var; do
  source_dev="$(findmnt -n -o SOURCE "$critical" 2>/dev/null || true)"
  [[ -n "$source_dev" ]] || continue
  source_disk=""
  if command -v lsblk >/dev/null 2>&1; then
    source_disk="$(lsblk -no PKNAME "$source_dev" 2>/dev/null | head -n 1 || true)"
  fi
  [[ -n "$source_disk" ]] || source_disk="$(basename "$source_dev")"
  if [[ "$source_disk" == "$DEV_NAME" || "$source_dev" == "$RESOLVED" ]]; then
    die "Refusing to flash $RESOLVED: it holds the mounted $critical filesystem."
  fi
done

# Any mount at all on the target is a sign it is in use. Refuse rather than
# guessing; unmount it yourself and run the script again if that is intended.
if echo "$MOUNTS" | grep -qE ' /|\[SWAP\]|/boot|/home|/var|/mnt'; then
  die "Refusing to flash $RESOLVED: it appears to be mounted or in use. Unmount it first."
fi

# Swap partitions show up without a conventional mount point.
if command -v swapon >/dev/null 2>&1; then
  if swapon --show=NAME 2>/dev/null | grep -q "^$DEV_NAME"; then
    die "Refusing to flash $RESOLVED: it contains an active swap area."
  fi
fi

# ------------------------------------------------- 5. loud warning for internals

if [[ "$REMOVABLE" == "0" ]]; then
  echo
  echo "########################################################################"
  echo "# WARNING: $RESOLVED is NOT marked removable."
  echo "# It may be an internal drive. Flashing will erase it completely."
  echo "# Unplug every disk you do not mean to overwrite before you continue."
  echo "########################################################################"
fi

echo
echo "########################################################################"
echo "# THIS WILL ERASE EVERYTHING ON $RESOLVED."
echo "# Double-check the model and size above. This cannot be undone."
echo "########################################################################"
echo

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "Dry run complete. Nothing was written."
  exit 0
fi

# --------------------------------------------------------- 6. typed confirmation

read -r -p 'Type FLASH to confirm, or anything else to cancel: ' ANSWER
[[ "$ANSWER" == "FLASH" ]] || die "Confirmation did not match. Nothing was written."

# --------------------------------------------------------------- 7. write image

if command -v wipefs >/dev/null 2>&1; then
  echo "==> Clearing old filesystem signatures"
  "${SUDO[@]}" wipefs --all "$RESOLVED"
else
  echo "==> wipefs not available; continuing with dd only"
fi

echo "==> Writing the ISO to $RESOLVED"
"${SUDO[@]}" dd if="$ISO_PATH" of="$RESOLVED" bs=4M status=progress conv=fsync

echo "==> Flushing writes"
sync
if command -v blockdev >/dev/null 2>&1; then
  "${SUDO[@]}" blockdev --flushbufs "$RESOLVED" 2>/dev/null || true
fi

echo
echo "==> Done. The USB installer is ready."
echo
echo "Next steps:"
echo "  1. Remove the drive and connect it to the target computer."
echo "  2. Start the computer from the USB drive (choose UEFI boot)."
echo "  3. Install SimpleOS, then connect Wi-Fi and printers in Caregiver Settings."
echo "  4. Set the caregiver PIN and hand the computer over."
echo
echo "See docs/caregiver-guide.md for the plain-English walkthrough."
