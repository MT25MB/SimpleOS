#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Build the SimpleOS container image locally and boot it in QEMU/KVM.
#
# Modes:
#   qcow2 (default) - boot a bootable qcow2 disk produced by bootc-image-builder
#   iso             - build an ISO installer and boot the installer from CD-ROM
#
# --reset deletes build-vm/simpleos-test.qcow2 first, so the next boot runs the
# first-boot service from scratch (creates 'senior', adds Flathub, installs the
# core apps). This is the cleanest way to re-test first boot.
#
# Requirements (all free/open source):
#   - podman, sudo, qemu-system-x86_64 (with KVM), qemu-img, OVMF firmware
#   - bootc-image-builder is pulled automatically as a container image
#
# Examples:
#   bash scripts/test-vm.sh                    # build image + boot qcow2
#   bash scripts/test-vm.sh --reset            # recreate disk, re-test first boot
#   bash scripts/test-vm.sh --iso              # build ISO + boot installer
#   bash scripts/test-vm.sh --memory 6144      # give the VM 6 GB RAM
# -----------------------------------------------------------------------------

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTAINERFILE="$REPO_ROOT/os-image/Containerfile"
VM_DIR="${VM_DIR:-$REPO_ROOT/build-vm}"
DISK="$VM_DIR/simpleos-test.qcow2"
INSTALL_DISK="$VM_DIR/simpleos-install.qcow2"
ISO_DIR="${ISO_DIR:-$REPO_ROOT/output}"

CONTAINER_ENGINE="${CONTAINER_ENGINE:-podman}"
IMAGE_TAG="${IMAGE_TAG:-localhost/simpleos:local}"
BUILDER_IMAGE="${BUILDER_IMAGE:-quay.io/centos-bootc/bootc-image-builder:latest}"

MODE="qcow2"
RESET=0
MEMORY="${MEMORY:-4096}"
CPUS="${CPUS:-2}"

die() {
  echo "ERROR: $*" >&2
  exit 1
}

log() {
  echo "==> $*"
}

usage() {
  cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Build the SimpleOS image locally with podman and boot it in QEMU/KVM.

Options:
  --qcow2           Boot a bootable qcow2 disk (default)
  --iso             Build an ISO installer and boot from CD-ROM
  --reset           Delete and recreate the qcow2 disk to re-test first boot
  --image TAG       Local image tag (default: $IMAGE_TAG)
  --memory MB       VM memory in MB (default: $MEMORY)
  --cpus N          VM CPU count (default: $CPUS)
  -h, --help        Show this help

Notes:
  - The disk lives at $DISK
  - Generated ISOs live in $ISO_DIR
  - KVM acceleration is used; /dev/kvm must be accessible.
  - The first boot needs network access for Flathub and the core applications.
EOF
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "'$1' is not installed or not on PATH."
}

# ------------------------------------------------------------------ arguments

while [[ $# -gt 0 ]]; do
  case "$1" in
    --qcow2)
      MODE="qcow2"
      shift
      ;;
    --iso)
      MODE="iso"
      shift
      ;;
    --reset)
      RESET=1
      shift
      ;;
    --image)
      [[ $# -ge 2 ]] || die "--image needs an image tag."
      IMAGE_TAG="$2"
      shift 2
      ;;
    --memory)
      [[ $# -ge 2 ]] || die "--memory needs a number (MB)."
      MEMORY="$2"
      shift 2
      ;;
    --cpus)
      [[ $# -ge 2 ]] || die "--cpus needs a number."
      CPUS="$2"
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

[[ "$MEMORY" =~ ^[0-9]+$ ]] || die "--memory must be a number of megabytes."
[[ "$CPUS" =~ ^[0-9]+$ ]] || die "--cpus must be a number."

# -------------------------------------------------------------- preflight checks

require_command "$CONTAINER_ENGINE"
require_command qemu-system-x86_64
[[ -f "$CONTAINERFILE" ]] || die "Containerfile not found at $CONTAINERFILE"

if [[ $(id -u) -eq 0 ]]; then
  SUDO=()
else
  require_command sudo
  SUDO=(sudo)
fi

[[ -r /dev/kvm && -w /dev/kvm ]] ||
  die "/dev/kvm is not accessible. Enable virtualization in BIOS and add your user to the 'kvm' group."

# Choose a UEFI firmware image. Labwc needs a Wayland session, and SimpleOS
# images are UEFI, so legacy BIOS boot is not supported.
OVMF=""
for candidate in \
  /usr/share/OVMF/OVMF_CODE.fd \
  /usr/share/OVMF/OVMF_CODE.secboot.fd \
  /usr/share/qemu/OVMF.fd \
  /usr/share/ovmf/OVMF.fd; do
  if [[ -f "$candidate" ]]; then
    OVMF="$candidate"
    break
  fi
done
[[ -n "$OVMF" ]] || die "No OVMF firmware found. Install the 'ovmf' package."

mkdir -p "$VM_DIR"

# ------------------------------------------------------- 1. build the image

log "Building '$IMAGE_TAG' locally from $CONTAINERFILE"
"${SUDO[@]}" "$CONTAINER_ENGINE" build \
  --file "$CONTAINERFILE" \
  --tag "$IMAGE_TAG" \
  "$REPO_ROOT"

# bootc-image-builder reads images from root container storage, so run it via
# sudo with the host storage mounted for both qcow2 and iso modes.
TTY_ARGS=()
if [[ -t 0 ]]; then
  TTY_ARGS=(-t)
fi

run_builder() {
  local type="$1"
  local out_dir="$2"
  mkdir -p "$out_dir"
  "${SUDO[@]}" "$CONTAINER_ENGINE" run \
    --rm -i "${TTY_ARGS[@]}" \
    --privileged \
    --pull=newer \
    --security-opt label=type:unconfined_t \
    --volume "$out_dir:/output" \
    --volume /var/lib/containers/storage:/var/lib/containers/storage \
    "$BUILDER_IMAGE" \
    --type "$type" \
    --output /output \
    "$IMAGE_TAG"
}

# ------------------------------------------------------- 2. prepare the disk / ISO

if [[ "$MODE" == "qcow2" ]]; then
  if [[ "$RESET" -eq 1 ]]; then
    log "--reset: deleting $DISK"
    rm -f "$DISK"
  fi

  if [[ ! -f "$DISK" ]]; then
    log "Generating a bootable qcow2 disk in $VM_DIR"
    GENERATED_DIR="$VM_DIR/generated-qcow2"
    rm -rf "$GENERATED_DIR"
    run_builder qcow2 "$GENERATED_DIR"
    GENERATED="$(find "$GENERATED_DIR" -type f -name '*.qcow2' -print -quit)"
    [[ -n "$GENERATED" ]] || die "bootc-image-builder produced no qcow2 file."
    mv "$GENERATED" "$DISK"
    rm -rf "$GENERATED_DIR"
    log "Created $DISK"
  else
    log "Reusing existing disk $DISK (use --reset to recreate it)"
  fi

  BOOT_DISK="$DISK"
else
  log "Generating a bootable ISO installer in $ISO_DIR"
  run_builder iso "$ISO_DIR"
  ISO_PATH="$(find "$ISO_DIR" -type f -name '*.iso' -print -quit)"
  [[ -n "$ISO_PATH" ]] || die "bootc-image-builder produced no ISO file."

  require_command qemu-img
  if [[ "$RESET" -eq 1 || ! -f "$INSTALL_DISK" ]]; then
    log "Creating a blank install target at $INSTALL_DISK"
    qemu-img create -f qcow2 "$INSTALL_DISK" 20G
  fi

  log "ISO ready: $ISO_PATH"
fi

# ------------------------------------------------------- 3. boot the VM

DISPLAY_ARGS=("-display" "${QEMU_DISPLAY:-gtk,gl=on}")
QEMU_ARGS=(
  -accel kvm
  -m "$MEMORY"
  -smp "$CPUS"
  -bios "$OVMF"
  -vga virtio
  "${DISPLAY_ARGS[@]}"
  -device virtio-net-pci,netdev=net0
  -netdev user,id=net0
  -usbdevice tablet
  -object rng-random,filename=/dev/urandom,id=rng0
  -device virtio-rng-pci,rng=rng0
)

if [[ "$MODE" == "qcow2" ]]; then
  QEMU_ARGS+=(-drive "file=$BOOT_DISK,format=qcow2,if=virtio")
else
  QEMU_ARGS+=(-cdrom "$ISO_PATH")
  QEMU_ARGS+=(-drive "file=$INSTALL_DISK,format=qcow2,if=virtio")
fi

echo
log "Booting SimpleOS in QEMU/KVM ($MODE mode)"
echo "     BIOS:  $OVMF"
echo "     RAM:   ${MEMORY} MB, CPUs: $CPUS"
if [[ "$MODE" == "qcow2" ]]; then
  echo "     Disk:  $BOOT_DISK"
else
  echo "     ISO:   $ISO_PATH"
fi
echo "Note: first boot needs network access for Flathub and the core applications."
echo

exec qemu-system-x86_64 "${QEMU_ARGS[@]}"
