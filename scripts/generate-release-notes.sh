#!/usr/bin/env bash
# Generate clean, readable release notes for a SimpleOS version tag.
# Usage: bash scripts/generate-release-notes.sh v0.3.0 [previous-tag] [iso-asset-name]
# The third argument is set by the release workflow once the ISO is attached.
set -euo pipefail

VERSION="${1:-}"
PREVIOUS="${2:-}"
ISO_ASSET="${3:-}"

if [[ -z "$VERSION" ]]; then
  echo "Usage: $0 <version-tag> [previous-tag]" >&2
  exit 1
fi

echo "## SimpleOS $VERSION"
echo
echo "SimpleOS is a free, immutable Linux desktop built for older adults and the"
echo "people who help them. It uses large, clear controls, keeps the system safe"
echo "from accidental damage, and blocks common scam and ad tricks by default."
echo

if [[ -n "$PREVIOUS" ]] && git rev-parse --verify "$PREVIOUS" >/dev/null 2>&1; then
  echo "### Changes since $PREVIOUS"
  echo
  git log --no-merges --pretty=format:'- %s' "$PREVIOUS..HEAD"
  echo
  echo
else
  echo "### Changes"
  echo
  echo "- Immutable bootc/Fedora Atomic image, accessible labwc desktop and greetd autologin."
  echo "- Full-screen React/Electron launcher with daily reminders and PIN-protected caregiver settings."
  echo "- Firefox guardrails, reproducible ISO build, QEMU test script and automated CI."
  echo
fi

echo "### Get SimpleOS"
echo
echo "Pull the container image (replace OWNER with the repository owner if using a fork):"
echo
echo '```sh'
echo "docker pull ghcr.io/OWNER/simpleos:$VERSION"
echo "docker pull ghcr.io/OWNER/simpleos:latest"
echo '```'
echo

if [[ -n "$ISO_ASSET" ]]; then
  REPOSITORY="${GITHUB_REPOSITORY:-MT25MB/SimpleOS}"
  echo "### Download the bootable installer"
  echo
  echo "GitHub limits one download to 2 GB and this installer is bigger, so the ISO"
  echo "is attached as parts plus a checksum. **Easiest:** download"
  echo "\`combine-iso-parts.bat\` (Windows) or \`combine-iso-parts.sh\` (Linux/macOS)"
  echo "along with all the \`.part\` files and the \`.sha256\` file, put them in one"
  echo "folder, and run the script. It joins the parts, checks the hash and tells you"
  echo "when the ISO is ready. Manual steps are below if you prefer them."
  echo
  echo "**Windows:** open Command Prompt in that folder and run:"
  echo
  echo '```bat'
  echo "copy /b ${ISO_ASSET}.part0+${ISO_ASSET}.part1+${ISO_ASSET}.part2 $ISO_ASSET"
  echo "certutil -hashfile $ISO_ASSET SHA256"
  echo '```'
  echo
  echo "The hash printed by certutil must match the value inside the \`.sha256\`"
  echo "file. If you downloaded more than three parts, add them to the copy"
  echo "command in order before the final file name."
  echo
  echo "**Linux or macOS:** open Terminal in that folder and run:"
  echo
  echo '```sh'
  echo "cat ${ISO_ASSET}.part* > $ISO_ASSET"
  echo "sha256sum -c ${ISO_ASSET}.sha256"
  echo '```'
  echo
  echo "On macOS use \`shasum -a 256 -c ${ISO_ASSET}.sha256\` instead."
  echo
  echo "Use the resulting \`$ISO_ASSET\` in a VM, or flash it to a USB stick with"
  echo "the script below. [All release files](https://github.com/$REPOSITORY/releases/tag/$VERSION)."
  echo
fi

echo "Or build a bootable ISO on a Linux host with Podman:"
echo
echo '```sh'
echo 'bash scripts/build-iso.sh'
echo '```'
echo
echo "The generated ISO is written to ./output. To flash it to a USB stick, use"
echo "--flash and read the overwrite warning carefully:"
echo
echo '```sh'
echo 'SIMPLEOS_CONFIRM_FLASH=YES bash scripts/build-iso.sh --flash /dev/sdX'
echo '```'
echo
echo "To try it in a VM first, with KVM enabled:"
echo
echo '```sh'
echo 'bash scripts/test-vm.sh --reset'
echo '```'
echo
echo "### Notes"
echo
echo "- First boot needs network access for Flathub and the core applications."
echo "- The caregiver PIN is set on first use and has no recovery mechanism yet."
if [[ -n "$ISO_ASSET" ]]; then
  echo "- The attached ISO is split into parts; see Download the bootable installer above."
else
  echo "- No prebuilt ISO is attached to this release. Build one with the script above."
fi
