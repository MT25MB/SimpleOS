#!/usr/bin/env bash
# Roll back exactly one system deployment. Invoked only through the narrow
# polkit rule for simpleos-rollback.service; it never touches user files.
set -uo pipefail

log() { logger -t simpleos-rollback -p user.notice -- "$*"; }

log "Rollback requested"

if command -v rpm-ostree >/dev/null 2>&1; then
  if rpm-ostree rollback; then
    log "Rollback prepared with rpm-ostree; a restart is required"
    exit 0
  fi
  log "rpm-ostree rollback failed; trying bootc"
fi

if command -v bootc >/dev/null 2>&1; then
  if bootc rollback; then
    log "Rollback prepared with bootc; a restart is required"
    exit 0
  fi
fi

logger -t simpleos-rollback -p user.err -- "Rollback failed"
exit 1
