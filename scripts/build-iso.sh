#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Build a bootable SimpleOS ISO installer from the published container image.
#
# What it does:
#   1. Pulls the image built by CI (default) or builds it locally (--build).
#   2. Feeds that image to bootc-image-builder, which produces a bootable ISO
#      installer in ./output (override with --output).
#   3. Optionally flashes the ISO to a USB stick (--flash) behind strict checks
#      and an explicit typed confirmation.
#
# Requirements (all free/open source):
#   - Podman, sudo, and basic coreutils (find, dd, basename).
#   - bootc-image-builder is pulled automatically as a container image.
#
# Examples:
#   bash scripts/build-iso.sh                       # pull published image + ISO
#   bash scripts/build-iso.sh --build               # build locally first + ISO
#   REMOTE_IMAGE=ghcr.io/you/simpleos:latest bash scripts/build-iso.sh
#   bash scripts/build-iso.sh --flash /dev/sdb      # flash after checks
#
# NOTE: ISO generation needs root privileges because bootc-image-builder mounts
# the host container storage. The script uses sudo when you are not already root.
# -----------------------------------------------------------------------------

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTAINERFILE="$REPO_ROOT/os-image/Containerfile"

OUTPUT_DIR="${OUTPUT_DIR:-$REPO_ROOT/output}"
IMAGE_TAG="${IMAGE_TAG:-localhost/simpleos:local}"
REMOTE_IMAGE="${REMOTE_IMAGE:-ghcr.io/${GITHUB_REPOSITORY_OWNER:-MT25MB}/simpleos:latest}"
BUILDER_IMAGE="${BUILDER_IMAGE:-quay.io/centos-bootc/bootc-image-builder:latest}"
CONTAINER_ENGINE="${CONTAINER_ENGINE:-podman}"

MODE="pull"
IMAGE_EXPLICIT=0
FLASH_DEVICE=""
ISO_PATH=""

die() {
  echo "ERROR: $*" >&2
  exit 1
}

usage() {
  sed -n '2,24p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "'$1' is not installed or not on PATH."
}

# ------------------------------------------------------------------ arguments

while [[ $# -gt 0 ]]; do
  case "$1" in
    --build)
      MODE="build"
      shift
      ;;
    --pull)
      MODE="pull"
      shift
      ;;
    --image)
      [[ $# -ge 2 ]] || die "--image needs an image reference."
      IMAGE_TAG="$2"
      IMAGE_EXPLICIT=1
      shift 2
      ;;
    --output)
      [[ $# -ge 2 ]] || die "--output needs a directory."
      OUTPUT_DIR="$2"
      shift 2
      ;;
    --flash)
      [[ $# -ge 2 ]] || die "--flash needs a device, e.g. /dev/sdb."
      FLASH_DEVICE="$2"
      shift 2
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      die "Unknown option: $1 (try --help)."
      ;;
  esac
done

# -------------------------------------------------------------- preflight checks

require_command "$CONTAINER_ENGINE"
[[ -f "$CONTAINERFILE" ]] || die "Containerfile not found at $CONTAINERFILE"

# bootc-image-builder reads images from root container storage. Use sudo for
# all container commands so build/pull and ISO generation see the same image.
if [[ $(id -u) -eq 0 ]]; then
  SUDO=()
else
  require_command sudo
  SUDO=(sudo)
fi

if [[ "$MODE" == "build" ]]; then
  echo "==> Building image '$IMAGE_TAG' from $CONTAINERFILE"
  "${SUDO[@]}" "$CONTAINER_ENGINE" build \
    --file "$CONTAINERFILE" \
    --tag "$IMAGE_TAG" \
    "$REPO_ROOT"
else
  if [[ "$IMAGE_EXPLICIT" -eq 1 ]]; then
    echo "==> Pulling image '$IMAGE_TAG'"
    "${SUDO[@]}" "$CONTAINER_ENGINE" pull "$IMAGE_TAG"
  else
    echo "==> Pulling published image '$REMOTE_IMAGE'"
    "${SUDO[@]}" "$CONTAINER_ENGINE" pull "$REMOTE_IMAGE"
    IMAGE_TAG="$REMOTE_IMAGE"
  fi
fi

# ------------------------------------------------------------------ ISO build

echo "==> Generating bootable ISO in $OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

# A TTY is only useful when a person is watching; skip it in CI or scripts.
TTY_ARGS=()
if [[ -t 0 ]]; then
  TTY_ARGS=(-t)
fi

"${SUDO[@]}" "$CONTAINER_ENGINE" run \
  --rm -i "${TTY_ARGS[@]}" \
  --privileged \
  --pull=newer \
  --security-opt label=type:unconfined_t \
  --volume "$OUTPUT_DIR:/output" \
  --volume /var/lib/containers/storage:/var/lib/containers/storage \
  "$BUILDER_IMAGE" \
  --type iso \
  --output /output \
  "$IMAGE_TAG"

ISO_PATH="$(find "$OUTPUT_DIR" -type f -name '*.iso' -print -quit)"
[[ -n "$ISO_PATH" ]] || die "No .iso file was produced in $OUTPUT_DIR."

echo
echo "==> ISO ready: $ISO_PATH"
du -h "$ISO_PATH"
echo
echo "Next: test it in a VM (see README.md > Quickstart for Testing in a VM)."
echo "SAFETY: Do NOT flash this image to a disk you need. Back up your data first."

# ------------------------------------------------------------- optional flashing

if [[ -n "$FLASH_DEVICE" ]]; then
  echo
  echo "########################################################################"
  echo "# WARNING: This will OVERWRITE the USB drive $FLASH_DEVICE."
  echo "# EVERYTHING on it will be ERASED. This cannot be undone."
  echo "# Unplug every other USB drive before continuing."
  echo "# Verify the device path carefully before typing it below."
  echo "########################################################################"

  [[ -b "$FLASH_DEVICE" ]] || die "'$FLASH_DEVICE' is not a block device."

  DEVICE_NAME="$(basename "$FLASH_DEVICE")"
  REMOVABLE_FILE="/sys/block/$DEVICE_NAME/removable"
  [[ -r "$REMOVABLE_FILE" ]] || die "Cannot verify that $FLASH_DEVICE is removable. Refusing to continue."
  [[ "$(cat "$REMOVABLE_FILE")" == "1" ]] || die "$FLASH_DEVICE is not a removable drive. Refusing to continue."

  require_command findmnt
  if findmnt -n "$FLASH_DEVICE" >/dev/null 2>&1; then
    die "$FLASH_DEVICE appears to be mounted. Unmount it first."
  fi

  [[ "${SIMPLEOS_CONFIRM_FLASH:-}" == "YES" ]] ||
    die "Set SIMPLEOS_CONFIRM_FLASH=YES to acknowledge the data-loss warning."

  read -r -p "Type the device path exactly ($FLASH_DEVICE) to continue: " ANSWER
  [[ "$ANSWER" == "$FLASH_DEVICE" ]] || die "Confirmation did not match. Nothing was written."

  echo "==> Writing $ISO_PATH to $FLASH_DEVICE"
  "${SUDO[@]}" dd if="$ISO_PATH" of="$FLASH_DEVICE" bs=4M status=progress conv=fsync
  echo "==> Done. Remove the USB drive and use it to boot the target machine."
fi
