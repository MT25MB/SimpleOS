import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(__dirname, '../..')
const html = readFileSync(resolve(root, 'docs/index.html'), 'utf8')
const css = readFileSync(resolve(root, 'docs/styles.css'), 'utf8')
const js = readFileSync(resolve(root, 'docs/script.js'), 'utf8')
const guideHtml = (name: string) =>
  readFileSync(resolve(root, `docs/${name}.html`), 'utf8')

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

  it('caps prose in rem so the reading measure stays near 70 characters', () => {
    expect(css).not.toMatch(/max-width: (48|58|62|66|68)ch/)
    expect(css).toContain('max-width: 27rem')
    expect(css).not.toMatch(/\.tabs[\s\S]{0,200}overflow-x/)
    expect(css).not.toMatch(/\.codeblock pre[\s\S]{0,200}overflow-x/)
  })

  it('keeps the warm editorial palette and the mono command font', () => {
    expect(css).toContain('#faf9f6')
    expect(css).toContain('#0f172a')
    expect(css).toContain('#e2e8f0')
    expect(css).toContain('#0f766e')
    expect(css).toContain('--font-mono: "JetBrains Mono"')
    expect(css).not.toContain('fonts.googleapis.com')
    expect(css).toContain('assets/fonts/atkinson-400.woff2')
    expect(css).toContain('assets/fonts/plus-jakarta-sans.woff2')
    expect(css).toContain('assets/fonts/jetbrains-mono.woff2')
  })

  it('ships complete, self-contained head metadata and icons', () => {
    for (const page of [html, ...['caregiver-guide', 'usb-install', 'hardware-compatibility', 'hardware-support', 'updates-and-recovery'].map((n) => guideHtml(n))]) {
      expect(page).toContain('<link rel="canonical" href="https://mt25mb.github.io/SimpleOS/')
      expect(page).toContain('property="og:title"')
      expect(page).toContain('property="og:description"')
      expect(page).toContain('property="og:image" content="https://mt25mb.github.io/SimpleOS/assets/simpleos-banner.png"')
      expect(page).toContain('property="og:image:width" content="1240"')
      expect(page).toContain('property="og:image:height" content="600"')
      expect(page).toContain('name="twitter:card" content="summary_large_image"')
      expect(page).toContain('rel="icon" type="image/png" sizes="512x512"')
      expect(page).toContain('rel="apple-touch-icon"')
      expect(page).toContain('rel="preload"')
      expect(page).not.toContain('fonts.googleapis.com')
      expect(page).not.toMatch(/<script(?![^>]*\bdefer\b)[^>]*src=/)
    }
  })

  it('keeps the Jekyll layout head and chrome aligned with the deployed pages', () => {
    const layout = readFileSync(resolve(root, 'docs/_layouts/default.html'), 'utf8')
    expect(layout).toContain('property="og:image:width" content="1240"')
    expect(layout).toContain('<header class="site-header">')
    expect(layout).toContain('<footer class="site-footer">')
    expect(layout).toContain('assets/simpleos-logo.png')
    expect(readFileSync(resolve(root, 'docs/_config.yml'), 'utf8')).toContain('baseurl: /SimpleOS')
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

describe('unified guide pages', () => {
  const homeFooter = html.match(/<footer class="site-footer">[\s\S]*?<\/footer>/)?.[0] ?? ''

  it('renders every Markdown guide as a styled HTML page', () => {
    for (const name of [
      'caregiver-guide',
      'usb-install',
      'hardware-compatibility',
      'hardware-support',
      'updates-and-recovery',
    ]) {
      const page = guideHtml(name)
      expect(page, name).toContain('<link rel="stylesheet" href="styles.css" />')
      expect(page, name).toContain('<script src="script.js" defer></script>')
      expect(page, name).toContain('<main id="main" class="guide-main">')
      expect(page, name).toMatch(/<h1[ >]/)
      expect(page, name).toContain(homeFooter)
    }
  })

  it('uses the home page header and shared controls on every guide', () => {
    for (const name of ['caregiver-guide', 'hardware-compatibility', 'updates-and-recovery']) {
      const page = guideHtml(name)
      expect(page, name).toContain('<header class="site-header">')
      expect(page, name).toContain('class="site-nav"')
      expect(page, name).toContain('id="theme-toggle"')
      expect(page, name).toContain('name="text-size"')
      expect(page, name).toContain('aria-label="Breadcrumb"')
      expect(page, name).toContain('href="index.html">← Back to SimpleOS home')
      expect(page, name).toContain('class="guide-toc"')
      expect(page, name).toMatch(/<h2 id="[a-z0-9-]+">/)
      expect(page, name).toContain('id="copy-status"')
      // In-page nav links are scoped to the home page, never dead on a guide.
      const nav = page.match(/<nav class="site-nav"[\s\S]*?<\/nav>/)?.[0] ?? ''
      expect(nav, name).not.toContain('href="#')
    }
  })

  it('keeps copy controls on generated commands and links guides together', () => {
    const page = guideHtml('usb-install')
    expect(page).toContain('data-copy')
    expect(page).toContain('aria-label="Other guides"')
    const hardware = guideHtml('hardware-compatibility')
    expect(hardware).toContain('class="compare"')
    expect(hardware).toContain('href="usb-install.html"')
  })
})
