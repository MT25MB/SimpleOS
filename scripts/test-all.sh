#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# One command to check the whole SimpleOS repository.
#
# Runs, in order:
#   1. the full Vitest suite (app, PIN crypto, allowlists, configs, docs, CI)
#   2. the shell type-check and production build
#   3. bash -n on every committed shell script
#   4. a pre-commit hygiene check for staged build artifacts and disk images
#
# Usage: bash scripts/test-all.sh
# -----------------------------------------------------------------------------

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

die() {
  echo "ERROR: $*" >&2
  exit 1
}

log() {
  echo "==> $*"
}

cd "$REPO_ROOT"

# -------------------------------------------------------------- 1. test suite

log "Running the full test suite"
(
  cd simpleos-shell
  npm test
)

# ------------------------------------------------------------- 2. type + build

log "Type-checking and building the launcher"
(
  cd simpleos-shell
  npm run build
)

# -------------------------------------------------------------- 3. shell syntax

log "Checking shell script syntax"
BASH_BIN="$(command -v bash || true)"
[[ -n "$BASH_BIN" ]] || die "bash is required for syntax checks"

for script in \
  scripts/build-iso.sh \
  scripts/test-boot.sh \
  scripts/test-vm.sh \
  scripts/test-all.sh \
  scripts/generate-release-notes.sh \
  scripts/flash-usb.sh \
  system-configs/labwc/autostart \
  system-configs/systemd/simpleos-firstboot.sh \
  system-configs/systemd/simpleos-boot-marker.sh; do
  [[ -f "$script" ]] || die "Missing expected script: $script"
  "$BASH_BIN" -n "$script" || die "Syntax error in $script"
  echo "    ok: $script"
done

# --------------------------------------------------------- 4. pre-commit gate

log "Checking for staged build artifacts and disk images"
if git rev-parse --git-dir >/dev/null 2>&1; then
  STAGED="$(git diff --cached --name-only)"
  if [[ -n "$STAGED" ]]; then
    echo "$STAGED" | grep -E \
      '(^|/)(node_modules|dist|dist-electron|release|build-vm|output)/|\.(iso|qcow2|img|raw|vdi|vmdk|ova)$' \
      && die "Build artifacts or disk images are staged. Unstage them before committing." || true
  fi
  echo "    staged files are clean"
else
  echo "    not a git repository; skipping staged-file check"
fi

echo
log "All checks passed. Repository is ready."
