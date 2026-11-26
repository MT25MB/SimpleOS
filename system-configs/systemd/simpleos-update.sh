#!/usr/bin/env bash
# Download and stage the next system version. Invoked only through the narrow
# polkit rule for simpleos-update.service; it never touches user files.
set -uo pipefail

log() { logger -t simpleos-update -p user.notice -- "$*"; }

log "System update requested"

if command -v rpm-ostree >/dev/null 2>&1; then
  if rpm-ostree upgrade; then
    log "System update staged; a restart will finish installing it"
    exit 0
  fi
  log "rpm-ostree upgrade failed; trying bootc"
fi

if command -v bootc >/dev/null 2>&1; then
  if bootc upgrade; then
    log "System update staged; a restart will finish installing it"
    exit 0
  fi
fi

logger -t simpleos-update -p user.err -- "System update failed"
exit 1
