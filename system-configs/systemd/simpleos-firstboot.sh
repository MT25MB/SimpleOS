#!/usr/bin/env bash
# One-time SimpleOS setup, run by simpleos-firstboot.service.
# Every step is idempotent so a retry after a failure is safe.
set -euo pipefail

SENIOR_USER="senior"

# -----------------------------------------------------------------------------
# 1. Create the unprivileged daily-use account.
#    It is deliberately NOT added to wheel/sudo — there is no admin path here.
# -----------------------------------------------------------------------------
if ! id -u "$SENIOR_USER" >/dev/null 2>&1; then
  useradd --create-home --user-group --shell /bin/bash "$SENIOR_USER"
  echo "Created user: $SENIOR_USER"
fi

# Defensive: strip any administrative groups if they were ever added.
for group in wheel sudo admin; do
  if getent group "$group" >/dev/null 2>&1; then
    gpasswd --delete "$SENIOR_USER" "$group" >/dev/null 2>&1 || true
  fi
done

# -----------------------------------------------------------------------------
# 2. Register Flathub as a system-wide source of applications.
# -----------------------------------------------------------------------------
flatpak remote-add --if-not-exists --system flathub \
  https://dl.flathub.org/repo/flathub.flatpakrepo

# -----------------------------------------------------------------------------
# 3. Install the core applications: browser, image viewer, remote support.
# -----------------------------------------------------------------------------
flatpak install --system --assumeyes flathub \
  org.mozilla.firefox \
  org.gnome.Loupe \
  com.rustdesk.RustDesk
