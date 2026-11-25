#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Headless boot test for SimpleOS.
#
# 1. Builds the container image from os-image/Containerfile.
# 2. Produces a bootable qcow2 disk with bootc-image-builder using
#    os-image/boot-test.toml, which enables the serial console and the test-only
#    boot milestone service.
# 3. Boots that disk in QEMU with no window, redirects serial output to a log,
#    applies a hard timeout, and captures interrupt/CPU-reset debug logs.
# 4. Passes only when the guest prints SIMPLEOS_BOOT_SUCCESS, which means
#    greetd, labwc and the kiosk launcher all started.
#
# Requirements: podman, sudo, qemu-system-x86_64, qemu-img, OVMF firmware.
# -----------------------------------------------------------------------------

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTAINERFILE="$REPO_ROOT/os-image/Containerfile"
TEST_CONFIG="$REPO_ROOT/os-image/boot-test.toml"

VM_DIR="${VM_DIR:-$REPO_ROOT/build-vm}"
DISK="$VM_DIR/simpleos-boot-test.qcow2"
LOG_DIR="${LOG_DIR:-$VM_DIR/boot-test-logs}"
BOOT_LOG="$LOG_DIR/serial.log"
QEMU_DEBUG="$LOG_DIR/qemu-debug.log"

CONTAINER_ENGINE="${CONTAINER_ENGINE:-podman}"
IMAGE_TAG="${IMAGE_TAG:-localhost/simpleos:boot-test}"
BUILDER_IMAGE="${BUILDER_IMAGE:-quay.io/centos-bootc/bootc-image-builder:latest}"

MEMORY="${MEMORY:-4096}"
CPUS="${CPUS:-2}"
BOOT_TIMEOUT="${BOOT_TIMEOUT:-300}"
RESET=0
KEEP=0

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

Headless boot test: build image, build qcow2, boot in QEMU, assert milestone.

Options:
  --reset           Rebuild the image and disk from scratch
  --timeout SECS    Hard boot timeout (default: $BOOT_TIMEOUT)
  --memory MB       VM memory (default: $MEMORY)
  --cpus N          VM CPUs (default: $CPUS)
  --keep            Keep the disk and logs after the test
  -h, --help        Show this help

Milestone: SIMPLEOS_BOOT_SUCCESS on the serial console.
Logs: $BOOT_LOG and $QEMU_DEBUG
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --reset) RESET=1; shift ;;
    --keep) KEEP=1; shift ;;
    --timeout)
      [[ $# -ge 2 ]] || die "--timeout needs seconds."
      BOOT_TIMEOUT="$2"; shift 2 ;;
    --memory)
      [[ $# -ge 2 ]] || die "--memory needs MB."
      MEMORY="$2"; shift 2 ;;
    --cpus)
      [[ $# -ge 2 ]] || die "--cpus needs a number."
      CPUS="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) die "Unknown option: $1 (try --help)." ;;
  esac
done

[[ "$BOOT_TIMEOUT" =~ ^[0-9]+$ ]] || die "--timeout must be seconds."
[[ "$MEMORY" =~ ^[0-9]+$ ]] || die "--memory must be megabytes."
[[ "$CPUS" =~ ^[0-9]+$ ]] || die "--cpus must be a number."

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "'$1' is not installed or not on PATH."
}

require_command "$CONTAINER_ENGINE"
require_command qemu-system-x86_64
require_command qemu-img
[[ -f "$CONTAINERFILE" ]] || die "Containerfile not found: $CONTAINERFILE"
[[ -f "$TEST_CONFIG" ]] || die "Boot-test config not found: $TEST_CONFIG"

if [[ $(id -u) -eq 0 ]]; then
  SUDO=()
else
  require_command sudo
  SUDO=(sudo)
fi

# UEFI firmware is required by the bootc image.
OVMF=""
for candidate in \
  /usr/share/OVMF/OVMF_CODE.fd \
  /usr/share/OVMF/OVMF_CODE.secboot.fd \
  /usr/share/qemu/OVMF.fd \
  /usr/share/ovmf/OVMF.fd; do
  if [[ -f "$candidate" ]]; then OVMF="$candidate"; break; fi
done
[[ -n "$OVMF" ]] || die "No OVMF firmware found. Install the 'ovmf' package."

mkdir -p "$VM_DIR" "$LOG_DIR"
: > "$BOOT_LOG"
: > "$QEMU_DEBUG"

# ------------------------------------------------------------------ 1. build

if [[ "$RESET" -eq 1 ]]; then
  log "Removing previous boot-test artifacts"
  rm -f "$DISK" "$BOOT_LOG" "$QEMU_DEBUG"
fi

log "Building $IMAGE_TAG from $CONTAINERFILE"
"${SUDO[@]}" "$CONTAINER_ENGINE" build \
  --file "$CONTAINERFILE" \
  --tag "$IMAGE_TAG" \
  "$REPO_ROOT"

log "Verifying kiosk session wiring in the built image"
"${SUDO[@]}" "$CONTAINER_ENGINE" run --rm --entrypoint /bin/sh "$IMAGE_TAG" -c \
  'test -L /etc/systemd/system/graphical.target.wants/greetd.service \
    && test -L /etc/systemd/system/display-manager.service \
    && test "$(readlink -f /etc/systemd/system/default.target)" = /usr/lib/systemd/system/graphical.target \
    && command -v labwc \
    && test -x /usr/libexec/simpleos/simpleos-shell' \
  || die "Built image is missing kiosk session wiring."

if [[ ! -s "$DISK" ]]; then
  log "Generating bootable qcow2 disk"
  GEN_DIR="$VM_DIR/boot-test-generated"
  rm -rf "$GEN_DIR"
  mkdir -p "$GEN_DIR"
  "${SUDO[@]}" "$CONTAINER_ENGINE" run \
    --rm -i \
    --privileged \
    --pull=newer \
    --security-opt label=type:unconfined_t \
    --volume "$GEN_DIR:/output" \
    --volume "$TEST_CONFIG:/config.toml:ro" \
    --volume /var/lib/containers/storage:/var/lib/containers/storage \
    "$BUILDER_IMAGE" \
    --config /config.toml \
    --rootfs ext4 \
    --type qcow2 \
    --output /output \
    "$IMAGE_TAG"
  GENERATED="$(find "$GEN_DIR" -type f -name '*.qcow2' -print -quit)"
  [[ -n "$GENERATED" ]] || die "bootc-image-builder produced no qcow2 file."
  mv "$GENERATED" "$DISK"
  rm -rf "$GEN_DIR"
fi

# ------------------------------------------------------------------ 2. boot

ACCEL_ARGS=()
if [[ -r /dev/kvm && -w /dev/kvm ]]; then
  ACCEL_ARGS=(-accel kvm)
else
  echo "WARNING: /dev/kvm unavailable; booting with TCG (slow)." >&2
fi

QEMU_ARGS=(
  "${ACCEL_ARGS[@]}"
  -m "$MEMORY"
  -smp "$CPUS"
  -bios "$OVMF"
  -display none
  -serial stdio
  -monitor none
  -no-reboot
  -d int,cpu_reset
  -D "$QEMU_DEBUG"
  -device virtio-net-pci,netdev=net0
  -netdev user,id=net0
  -drive "file=$DISK,format=qcow2,if=virtio"
)

log "Booting headless (timeout ${BOOT_TIMEOUT}s); serial log: $BOOT_LOG"
set +e
timeout --signal=TERM --kill-after=10s "$BOOT_TIMEOUT" \
  qemu-system-x86_64 "${QEMU_ARGS[@]}" > "$BOOT_LOG" 2>&1
QEMU_RC=$?
set -e

# ------------------------------------------------------------------ 3. assert

FAILED=0
if grep -q 'SIMPLEOS_BOOT_SUCCESS' "$BOOT_LOG"; then
  log "Milestone reached: greetd, labwc and the launcher all started."
elif grep -q 'SIMPLEOS_BOOT_FAILED' "$BOOT_LOG"; then
  echo "FAILURE: desktop session did not start." >&2
  FAILED=1
elif [[ "$QEMU_RC" -eq 124 ]]; then
  echo "FAILURE: boot timed out after ${BOOT_TIMEOUT}s." >&2
  FAILED=1
elif [[ "$QEMU_RC" -ne 0 ]]; then
  echo "FAILURE: QEMU exited with code $QEMU_RC." >&2
  FAILED=1
else
  echo "FAILURE: QEMU exited cleanly without the boot milestone." >&2
  FAILED=1
fi

if grep -qiE 'kernel panic|triple fault' "$BOOT_LOG" "$QEMU_DEBUG"; then
  echo "FAILURE: panic or CPU reset detected in boot logs." >&2
  FAILED=1
fi

if [[ "$FAILED" -ne 0 ]]; then
  echo "--- serial log (tail) ---" >&2
  tail -n 60 "$BOOT_LOG" >&2
  echo "--- qemu debug (tail) ---" >&2
  tail -n 40 "$QEMU_DEBUG" >&2
  exit 1
fi

log "Boot test passed."

if [[ "$KEEP" -eq 0 ]]; then
  rm -f "$DISK"
  rm -rf "$LOG_DIR"
fi
