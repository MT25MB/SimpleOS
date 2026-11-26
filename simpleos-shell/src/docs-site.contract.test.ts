import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(__dirname, '../..')
const html = readFileSync(resolve(root, 'docs/index.html'), 'utf8')
const css = readFileSync(resolve(root, 'docs/styles.css'), 'utf8')
const js = readFileSync(resolve(root, 'docs/script.js'), 'utf8')

describe('flagship docs site contract', () => {
  it('uses bespoke 1.75px SVG icons and no emoji', () => {
    expect((html.match(/<svg /g) ?? []).length).toBeGreaterThanOrEqual(10)
    expect((css.match(/stroke-width: 1\.75/g) ?? []).length).toBeGreaterThanOrEqual(4)
    expect(html).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u)
  })

  it('avoids the vibecoded visual vocabulary', () => {
    expect(css).not.toMatch(/linear-gradient|radial-gradient|backdrop-filter|box-shadow: 0 0 /)
    expect(html).not.toMatch(/revolutionary|seamless|cutting-edge/i)
  })

  it('keeps the warm editorial palette and the mono command font', () => {
    expect(css).toContain('#faf9f6')
    expect(css).toContain('#0f172a')
    expect(css).toContain('#e2e8f0')
    expect(css).toContain('#0f766e')
    expect(css).toContain('--font-mono: "JetBrains Mono"')
    expect(css).toContain('@import url(\'https://fonts.googleapis.com')
  })

  it('ships a comparison table, a layered architecture, and direct trust links', () => {
    expect(html).toContain('<table class="compare">')
    expect(html).toContain('<th scope="col">')
    expect((html.match(/class="stack__layer"/g) ?? []).length).toBe(3)
    expect(html).toContain('href="hardware-compatibility.md"')
    expect(html).toContain('href="caregiver-guide.md"')
    expect(html).toContain('href="https://github.com/MT25MB/SimpleOS"')
  })

  it('makes the quickstart switcher and copy buttons keyboard accessible', () => {
    expect(html).toContain('role="tablist"')
    expect((html.match(/role="tab"/g) ?? []).length).toBe(3)
    expect((html.match(/data-copy/g) ?? []).length).toBeGreaterThanOrEqual(3)
    expect(js).toContain("event.key === 'ArrowRight'")
    expect(js).toContain('navigator.clipboard.writeText')
    expect(js).toContain('fallbackCopy')
  })

  it('ships a high-contrast dark mode and a live interactive kiosk preview', () => {
    expect(html).toContain('id="theme-toggle"')
    expect(css).toContain(':root[data-theme="dark"]')
    expect(html).toContain('data-pin-gate')
    expect(html).toContain('data-action="read-aloud"')
    expect(js).toContain('showDetail(')
  })
})
