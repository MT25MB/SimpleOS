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
