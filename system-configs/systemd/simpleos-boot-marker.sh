#!/usr/bin/env bash
# Boot-test milestone helper.
# Only active when the kernel command line contains simpleos.boot_marker=1,
# which the headless boot harness adds to the test image. It waits for the real
# desktop session (labwc + the kiosk launcher), writes a single success line to
# the serial console, then powers the VM off so the harness can finish.
set -uo pipefail

for _ in $(seq 1 120); do
  if pgrep -x labwc >/dev/null 2>&1 \
    && pgrep -f '/usr/libexec/simpleos/simpleos-shell' >/dev/null 2>&1; then
    echo 'SIMPLEOS_BOOT_SUCCESS' > /dev/ttyS0
    /usr/bin/systemctl poweroff
    exit 0
  fi
  sleep 1
done

echo 'SIMPLEOS_BOOT_FAILED: desktop session did not start' > /dev/ttyS0
/usr/bin/systemctl poweroff
exit 1
