import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const styles = readFileSync(resolve(__dirname, 'styles.css'), 'utf8')

describe('full-screen layout contract', () => {
  it('lets the launcher fill the whole output without a centred width cap', () => {
    const app = styles.match(/\.app\s*\{([^}]*)\}/)?.[1] ?? ''
    expect(app).toContain('min-height: 100vh')
    expect(app).not.toContain('max-width')
    expect(app).not.toContain('margin: 0 auto')
  })

  it('hides the native cursor and draws an always-on-top kiosk pointer', () => {
    expect(styles).toContain('cursor: none !important')
    const pointer = styles.match(/\.kiosk-pointer\s*\{([^}]*)\}/)?.[1] ?? ''
    expect(pointer).toContain('position: fixed')
    expect(pointer).toContain('pointer-events: none')
    expect(pointer).toContain('z-index: 10000')
  })

  it('pins the full-viewport screens to the whole window', () => {
    for (const name of ['pin-screen', 'setup-wizard']) {
      const block = styles.match(new RegExp(`\\.${name}\\s*\\{([^}]*)\\}`))?.[1] ?? ''
      expect(block, name).toContain('position: fixed')
      expect(block, name).toContain('inset: 0')
      expect(block, name).toContain('width: 100vw')
      expect(block, name).toContain('height: 100vh')
    }
  })
})
