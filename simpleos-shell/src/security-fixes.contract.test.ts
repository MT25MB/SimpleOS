import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(__dirname, '../..')
const main = readFileSync(resolve(root, 'simpleos-shell/electron/main.ts'), 'utf8')

/** Extract one ipcMain.handle block by channel so assertions stay local. */
function handler(channel: string): string {
  const start = main.indexOf(`'${channel}'`)
  if (start === -1) return ''
  const end = main.indexOf('\nipcMain.handle(', start)
  return main.slice(start, end === -1 ? main.length : end)
}

describe('security and stability fixes', () => {
  it('does not unlock caregiver actions from setup:complete alone', () => {
    const block = handler('simpleos:setup:complete')
    expect(block.length).toBeGreaterThan(0)
    expect(block).not.toContain('pinUnlocked = true')
  })

  it('PIN-gates the legacy printer settings channel', () => {
    const block = handler('simpleos:open-settings')
    expect(block.length).toBeGreaterThan(0)
    expect(block).toContain("target === 'printer'")
    expect(block).toContain('PIN_REQUIRED')
  })

  it('writes state files through an unpredictable exclusive temp file', () => {
    const start = main.indexOf('function writeJsonAtomically')
    const block = main.slice(start, start + 700)
    expect(block).toContain('crypto.randomBytes')
    expect(block).toContain("flag: 'wx'")
  })

  it('bounds avatar reads so a corrupt file cannot exhaust memory', () => {
    const block = handler('simpleos:contacts:avatar:get')
    expect(block.length).toBeGreaterThan(0)
    expect(block).toContain('statSync')
    expect(block).toContain('MAX_AVATAR_BYTES')
  })
})
