import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(__dirname, '../..')
const appCss = readFileSync(resolve(root, 'simpleos-shell/src/styles.css'), 'utf8')
const docsCss = readFileSync(resolve(root, 'docs/styles.css'), 'utf8')
const docsHtml = readFileSync(resolve(root, 'docs/index.html'), 'utf8')
const appHtml = readFileSync(resolve(root, 'simpleos-shell/index.html'), 'utf8')

describe('accessibility defaults', () => {
  it('keeps an 18px (1.125rem) minimum root font in app and site', () => {
    expect(appCss).toContain('font-size: max(1.125rem')
    expect(docsCss).toContain('font-size: max(1.125rem')
  })

  it('uses the pinned high-contrast slate palette in both surfaces', () => {
    for (const css of [appCss, docsCss]) {
      expect(css).toContain('#0b1120')
      expect(css).toContain('#f8fafc')
      expect(css).toContain('--focus:')
    }
  })

  it('keeps accent text on dark cards above 7:1 (WCAG AAA)', () => {
    // The base accent is 6.83:1 on --surface, so text there uses a lighter sky.
    const luminance = (hex: string): number => {
      const channels = hex.replace('#', '').match(/../g)!.map((part) => {
        const value = parseInt(part, 16) / 255
        return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4)
      })
      return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
    }
    const contrast = (a: string, b: string): number => {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
      return (hi + 0.05) / (lo + 0.05)
    }
    expect(contrast('#7dd3fc', '#1e293b')).toBeGreaterThanOrEqual(7)
    expect(docsCss).toContain('--accent-text: #7dd3fc')
    expect(docsCss).toMatch(/code\s*\{[\s\S]{0,200}color:\s*var\(--accent-text\)/)
    expect(docsCss).toMatch(/\.button--secondary:hover[\s\S]{0,200}color:\s*var\(--accent-text\)/)
  })

  it('draws a visible focus ring of at least 3px on interactive elements', () => {
    expect(appCss).toMatch(/:focus-visible[\s\S]{0,120}outline:\s*4px solid/)
    expect(docsCss).toMatch(/:focus-visible[\s\S]{0,120}outline:\s*3px solid/)
  })

  it('keeps site links and buttons at least 48px tall', () => {
    expect(docsCss).toMatch(/\.site-nav a[\s\S]{0,200}min-height:\s*48px/)
    expect(docsCss).toMatch(/\.button\s*\{[\s\S]{0,200}min-height:\s*56px/)
    expect(docsCss).toContain('min-height: 48px')
  })

  it('keeps app buttons and font controls at least 48px tall', () => {
    expect(appCss).toMatch(/\.button\s*\{[\s\S]{0,200}min-height:\s*3\.25rem/)
    expect(appCss).toMatch(/\.font-scale__option[\s\S]{0,200}min-height:\s*3rem/)
  })

  it('keeps the new feature section on the same accessible tokens', () => {
    expect(docsHtml).toContain('id="new"')
    expect(docsHtml).toContain('aria-labelledby="new-title"')
    for (const heading of ['Read Aloud', 'Hold to Speak', 'Family Contact Cards']) {
      expect(docsHtml).toContain(`<h3>${heading}</h3>`)
    }
    const newSection = docsHtml.slice(docsHtml.indexOf('id="new"'), docsHtml.indexOf('id="caregiver"'))
    expect(newSection).toContain('class="pillar"')
    expect(newSection).toContain('aria-hidden="true"')
  })

  it('never blocks pinch zoom', () => {
    for (const html of [docsHtml, appHtml]) {
      expect(html).not.toMatch(/maximum-scale\s*=\s*1/)
      expect(html).not.toMatch(/user-scalable\s*=\s*no/)
    }
  })

  it('reserves the banner aspect ratio so it cannot stretch', () => {
    expect(docsCss).toContain('aspect-ratio: 1240 / 600')
    expect(docsHtml).toMatch(/width="1240"[\s\S]{0,120}height="600"/)
  })
})
