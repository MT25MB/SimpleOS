#!/usr/bin/env bash
# One-time SimpleOS setup, run by simpleos-firstboot.service.
# -----------------------------------------------------------------------------
# Design rules:
#   - Strict checks for the local account (autologin cannot work without it).
#   - Network operations are optional: a failure logs a clear journald message
#     but never fails the unit or blocks the desktop from starting.
#   - Every step is idempotent, so it is safe to run this script again by hand.
# -----------------------------------------------------------------------------
set -uo pipefail

SENIOR_USER="senior"
SENIOR_HOME="$(getent passwd "$SENIOR_USER" | cut -d: -f6)"
if [[ -z "$SENIOR_HOME" ]]; then
  SENIOR_HOME="/home/$SENIOR_USER"
fi

# All diagnostics go to journald via systemd-cat style tagging.
log_info()  { logger -t simpleos-firstboot -p user.info    -- "$*"; echo "INFO:  $*"; }
log_warn()  { logger -t simpleos-firstboot -p user.warning -- "$*"; echo "WARN:  $*"; }
log_error() { logger -t simpleos-firstboot -p user.err     -- "$*"; echo "ERROR: $*"; }

# -----------------------------------------------------------------------------
# 1. Create the unprivileged daily-use account if it does not exist.
#    It is deliberately NOT added to wheel/sudo — there is no admin path here.
# -----------------------------------------------------------------------------
if ! id -u "$SENIOR_USER" >/dev/null 2>&1; then
  if useradd --create-home --user-group --shell /bin/bash "$SENIOR_USER"; then
    log_info "Created unprivileged user '$SENIOR_USER'."
  else
    log_error "Could not create user '$SENIOR_USER'. Autologin will not work until this is fixed."
    exit 1
  fi
else
  log_info "User '$SENIOR_USER' already exists; skipping creation."
fi

# greetd's fallback session (agreety) runs as 'greeter'. Create it so a failed
# autologin still lands in a usable session instead of an empty VT.
if ! id -u greeter >/dev/null 2>&1; then
  if useradd --no-create-home --groups video greeter; then
    log_info "Created fallback user 'greeter'."
  else
    log_warn "Could not create 'greeter'; greetd's fallback session will be unavailable."
  fi
else
  log_info "User 'greeter' already exists; skipping creation."
fi

# Defensive: strip administrative groups in case they were ever added.
for group in wheel sudo admin; do
  if getent group "$group" >/dev/null 2>&1; then
    gpasswd --delete "$SENIOR_USER" "$group" >/dev/null 2>&1 || true
  fi
done

# Hardware access without administrative rights. "video" allows the
# brightness buttons to write to /sys/class/backlight, "audio" allows volume
# control through PipeWire, and "lp" allows printing.
for group in video audio lp; do
  if getent group "$group" >/dev/null 2>&1; then
    if usermod --append --groups "$group" "$SENIOR_USER" >/dev/null 2>&1; then
      log_info "Added '$SENIOR_USER' to the $group group for hardware access."
    else
      log_warn "Could not add '$SENIOR_USER' to $group; some hardware controls may not work."
    fi
  fi
done

# -----------------------------------------------------------------------------
# 2. Make sure the home and SimpleOS config directories belong to 'senior'.
# -----------------------------------------------------------------------------
if [[ -d "$SENIOR_HOME" ]]; then
  if mkdir -p "$SENIOR_HOME/.config/simpleos"; then
    log_info "Prepared config directory at $SENIOR_HOME/.config/simpleos."
  else
    log_warn "Could not create $SENIOR_HOME/.config/simpleos."
  fi
  if chown -R "$SENIOR_USER:$SENIOR_USER" "$SENIOR_HOME"; then
    log_info "Set ownership of $SENIOR_HOME to '$SENIOR_USER'."
  else
    log_warn "Could not set ownership of $SENIOR_HOME."
  fi
  chmod 0700 "$SENIOR_HOME/.config" "$SENIOR_HOME/.config/simpleos" 2>/dev/null || true
else
  log_warn "Home directory $SENIOR_HOME is missing; skipping ownership setup."
fi

# A short, bounded retry keeps intermittent Wi-Fi from leaving the desktop
# without its apps. It never loops forever: the unit has TimeoutStartSec=900.
retry_flatpak() {
  local description="$1"
  shift
  local attempt=1
  while [[ "$attempt" -le 3 ]]; do
    if "$@"; then
      return 0
    fi
    log_warn "$description failed (attempt $attempt of 3). Retrying in 5 seconds."
    sleep 5
    attempt=$((attempt + 1))
  done
  return 1
}

# -----------------------------------------------------------------------------
# 3. Add Flathub (optional — log clearly and continue on failure).
# -----------------------------------------------------------------------------
if ! retry_flatpak "Adding Flathub" flatpak remote-add --if-not-exists --system flathub \
      https://dl.flathub.org/repo/flathub.flatpakrepo; then
  log_warn "Could not add the Flathub remote (network problem?). Continuing; applications may be missing."
else
  log_info "Flathub remote is available."
fi

# -----------------------------------------------------------------------------
# 4. Install the core applications (optional — never fail the boot).
# -----------------------------------------------------------------------------
APPS=(org.mozilla.firefox org.gnome.Loupe com.rustdesk.RustDesk)
if ! retry_flatpak "Installing core applications" flatpak install --system --assumeyes flathub "${APPS[@]}"; then
  log_warn "One or more core applications could not be installed (network problem?)."
  log_warn "You can retry later with: flatpak install --system --assumeyes flathub ${APPS[*]}"
else
  log_info "Installed core applications: ${APPS[*]}"
fi

log_info "First boot setup finished."
exit 0
