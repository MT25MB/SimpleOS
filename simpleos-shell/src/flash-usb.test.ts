import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const script = readFileSync(resolve(__dirname, '../../scripts/flash-usb.sh'), 'utf8')

describe('flash-usb.sh safety contract', () => {
  it('takes an ISO and a target device and checks the ISO exists', () => {
    expect(script).toContain('<iso-file> <target-device>')
    expect(script).toContain('[[ -f "$ISO_PATH" ]]')
    expect(script).toContain('[[ -b "$DEVICE" ]]')
  })

  it('only accepts a whole disk, never a partition', () => {
    expect(script).toContain('must be a whole disk')
    expect(script).toContain('DEV_TYPE')
    expect(script).toContain('not a partition')
  })

  it('shows model, size and mounts before doing anything', () => {
    expect(script).toContain('Model         :')
    expect(script).toContain('Size          :')
    expect(script).toContain('Mounted filesystems and partitions')
  })

  it('blocks the running system disk and mounted or swap devices', () => {
    expect(script).toContain('findmnt -n -o SOURCE /')
    expect(script).toContain('Refusing to flash')
    expect(script).toContain('active swap area')
    expect(script).toContain('appears to be mounted or in use')
  })

  it('requires an explicit typed FLASH confirmation', () => {
    expect(script).toContain("read -r -p 'Type FLASH to confirm")
    expect(script).toContain('[[ "$ANSWER" == "FLASH" ]]')
    expect(script).toContain('Nothing was written')
  })

  it('flushes writes and prints next steps', () => {
    expect(script).toContain('wipefs --all')
    expect(script).toContain('dd if=')
    expect(script).toContain('conv=fsync')
    expect(script).toContain('sync')
    expect(script).toContain('Next steps:')
  })

  it('supports a non-destructive dry run', () => {
    expect(script).toContain('--dry-run')
    expect(script).toContain('DRY_RUN=1')
    expect(script).toContain('Dry run complete. Nothing was written.')
  })
})
