import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(__dirname, '../..')
const testVm = readFileSync(resolve(root, 'scripts/test-vm.sh'), 'utf8')
const buildIso = readFileSync(resolve(root, 'scripts/build-iso.sh'), 'utf8')

describe('scripts/test-vm.sh contract', () => {
  it('builds the image locally with podman from the Containerfile', () => {
    expect(testVm).toContain('CONTAINER_ENGINE="${CONTAINER_ENGINE:-podman}"')
    expect(testVm).toContain('os-image/Containerfile')
    expect(testVm).toContain('"$CONTAINER_ENGINE" build')
  })

  it('supports qcow2 (default), iso and --reset modes', () => {
    expect(testVm).toContain('MODE="qcow2"')
    expect(testVm).toContain('--qcow2)')
    expect(testVm).toContain('--iso)')
    expect(testVm).toContain('--reset)')
    expect(testVm).toMatch(/\n    qcow2\)/)
    expect(testVm).toMatch(/\n    iso\)/)
    expect(testVm).toContain('build-vm/simpleos-test.qcow2')
    expect(testVm).toContain('rm -f "$DISK"')
  })

  it('boots with KVM acceleration and virtio graphics', () => {
    expect(testVm).toContain('-accel kvm')
    expect(testVm).toContain('/dev/kvm')
    expect(testVm).toContain('-vga virtio')
    expect(testVm).toContain('qemu-system-x86_64 "${QEMU_ARGS[@]}"')
  })

  it('uses UEFI firmware and boots from the right artifact per mode', () => {
    expect(testVm).toContain('OVMF_CODE.fd')
    expect(testVm).toContain('-bios "$OVMF"')
    expect(testVm).toContain('-drive "file=$BOOT_DISK,format=qcow2,if=virtio"')
    expect(testVm).toContain('-cdrom "$ISO_PATH"')
  })

  it('provides clear usage output', () => {
    expect(testVm).toContain('usage()')
    expect(testVm).toContain('Usage: $(basename "$0") [OPTIONS]')
    expect(testVm).toContain('-h, --help')
  })
})

describe('scripts/build-iso.sh contract', () => {
  it('builds or pulls an image and generates an ISO with bootc-image-builder', () => {
    expect(buildIso).toContain('bootc-image-builder')
    expect(buildIso).toContain('--type iso')
    expect(buildIso).toContain('ROOTFS_TYPE="${ROOTFS_TYPE:-ext4}"')
    expect(buildIso).toContain('--rootfs "$ROOTFS_TYPE"')
    expect(buildIso).toContain('*.iso')
  })

  it('prints explicit usage with all options', () => {
    expect(buildIso).toContain('usage()')
    expect(buildIso).toContain('Usage: $(basename "$0") [OPTIONS]')
    expect(buildIso).toContain('--flash DEVICE')
    expect(buildIso).toContain('-h, --help')
  })

  it('warns to double-check the target drive before flashing', () => {
    expect(buildIso).toContain('Double-check the device path')
    expect(buildIso).toContain('OVERWRITE the USB drive')
    expect(buildIso).toContain('Type the device path exactly')
  })
})

describe('scripts/test-boot.sh contract', () => {
  const testBoot = readFileSync(resolve(root, 'scripts/test-boot.sh'), 'utf8')

  it('boots headlessly with a hard timeout and captured serial output', () => {
    expect(testBoot).toContain('timeout --signal=TERM --kill-after=10s "$BOOT_TIMEOUT"')
    expect(testBoot).toContain('-display none')
    expect(testBoot).toContain('-serial stdio')
    expect(testBoot).toContain('-no-reboot')
    expect(testBoot).toContain('-d int,cpu_reset')
    expect(testBoot).toContain('qemu-system-x86_64 "${QEMU_ARGS[@]}" > "$BOOT_LOG" 2>&1')
  })

  it('asserts the real desktop milestone and fails on panic or timeout', () => {
    expect(testBoot).toContain("grep -q 'SIMPLEOS_BOOT_SUCCESS'")
    expect(testBoot).toContain("grep -q 'SIMPLEOS_BOOT_FAILED'")
    expect(testBoot).toContain('kernel panic|triple fault')
    expect(testBoot).toContain('"$QEMU_RC" -eq 124')
  })

  it('builds the image and qcow2 from source with the boot-test config', () => {
    expect(testBoot).toContain('CONTAINERFILE="$REPO_ROOT/os-image/Containerfile"')
    expect(testBoot).toContain('TEST_CONFIG="$REPO_ROOT/os-image/boot-test.toml"')
    expect(testBoot).toContain('--rootfs ext4')
    expect(testBoot).toContain('--type qcow2')
    expect(testBoot).toContain('Verifying kiosk session wiring in the built image')
  })
})

describe('ISO installer safeguards', () => {
  const config = readFileSync(resolve(root, 'os-image/config.toml'), 'utf8')
  const kickstart = readFileSync(
    resolve(root, 'os-image/anaconda/interactive-defaults.ks'),
    'utf8',
  )

  it('uses only documented bootc-image-builder blueprint fields', () => {
    expect(config).toContain('name = "simpleos"')
    expect(config).toContain('[customizations.kernel]')
    expect(config).toContain('append = "systemd.unit=graphical.target"')
    expect(config).toContain('[customizations.iso]')
    expect(config).toContain('volume_id = "SIMPLEOS-INSTALL"')
    const active = config
      .split('\n')
      .filter((line) => line.trim() && !line.trim().startsWith('#'))
      .join('\n')
    expect(active).not.toMatch(/unattended|kickstart|password|user/)
  })

  it('sets graphical boot, automatic partitioning and no root prompts', () => {
    expect(kickstart).toContain('keyboard us')
    expect(kickstart).toContain('xconfig --startxonboot')
    expect(kickstart).toContain('clearpart --all --initlabel')
    expect(kickstart).toContain('autopart --type=plain')
    expect(kickstart).toContain('rootpw --lock')
    expect(kickstart).toContain('firstboot --disable')
    expect(kickstart).toContain('services --enabled=greetd.service')
    expect(kickstart).toContain('bootc --source-imgref @IMAGE_REF@')
    expect(kickstart).toContain('--target-imgref @TARGET_IMAGE_REF@')
    expect(kickstart).toContain('reboot')
  })

  it('wires the config and rendered kickstart into the ISO build', () => {
    expect(buildIso).toContain('KICKSTART_TEMPLATE="$REPO_ROOT/os-image/anaconda/interactive-defaults.ks"')
    expect(buildIso).toContain('CONFIG_FILE="$REPO_ROOT/os-image/config.toml"')
    expect(buildIso).toContain('sed "s|@IMAGE_REF@|$IMAGE_TAG|g"')
    expect(buildIso).toContain('TARGET_IMAGE_REF="${TARGET_IMAGE_REF:-$IMAGE_TAG}"')
    expect(buildIso).toContain('sed -i "s|@TARGET_IMAGE_REF@|$TARGET_IMAGE_REF|g"')
    expect(buildIso).toContain('--config /config.toml')
    expect(buildIso).toContain(':/config.toml:ro')
    expect(buildIso).toContain(':/usr/share/anaconda/interactive-defaults.ks:ro')
    expect(buildIso).toContain('Type INSTALL to continue')
  })
})
