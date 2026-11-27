#!/usr/bin/env node
/*
 * Render the Markdown guides in docs/ into static HTML pages that share the
 * exact header, footer and stylesheet of the site home page.
 *
 * The .md files stay the source of truth. Run with: node scripts/render-guides.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const docs = resolve(root, 'docs')
const site = readFileSync(resolve(docs, 'index.html'), 'utf8')

const match = (pattern) => {
  const found = site.match(pattern)
  if (!found) throw new Error(`Could not find ${pattern} in docs/index.html`)
  return found[0]
}

// Lift the real chrome out of the home page so the guides cannot drift.
const skipLink = match(/<a class="skip-link"[\s\S]*?<\/a>/)
const header = match(/<header class="site-header">[\s\S]*?<\/header>/)
const footer = match(/<footer class="site-footer">[\s\S]*?<\/footer>/)

// The header's in-page links point at the home page when shown on a guide.
const guideHeader = header.replace(/href="#/g, 'href="index.html#')

const escapeHtml = (text) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function inline(text) {
  let s = escapeHtml(text)
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>')
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_all, label, url) => {
    const target = url.endsWith('.md') ? url.replace(/\.md$/, '.html') : url
    return `<a href="${target}">${label}</a>`
  })
  return s
}

function codeBlock(code, lang) {
  return [
    '<div class="codeblock">',
    `<div class="codeblock__head"><span class="codeblock__lang">${escapeHtml(lang)}</span>` +
      '<button type="button" data-copy>Copy</button></div>',
    `<pre><code>${escapeHtml(code)}</code></pre>`,
    '</div>',
  ].join('\n')
}

function table(rows) {
  const cells = rows.map((row) =>
    row.replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim()),
  )
  const head = cells[0]
  const body = cells.slice(1).filter((row) => !row.every((cell) => /^:?-{2,}:?$/.test(cell)))
  const out = ['<table class="compare">', '<thead><tr>']
  for (const cell of head) out.push(`<th scope="col">${inline(cell)}</th>`)
  out.push('</tr></thead><tbody>')
  for (const row of body) {
    out.push('<tr>')
    row.forEach((cell, i) => {
      out.push(`<td data-label="${inline(head[i] ?? '')}">${inline(cell)}</td>`)
    })
    out.push('</tr>')
  }
  out.push('</tbody></table>')
  return out.join('\n')
}

function slugify(text, used) {
  const base = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  let id = base || 'section'
  let n = 2
  while (used.has(id)) id = `${base}-${n++}`
  used.add(id)
  return id
}

function markdownToHtml(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const out = []
  const headings = []
  const usedIds = new Set()
  let paragraph = []
  let list = null

  const flushParagraph = () => {
    if (paragraph.length) {
      out.push(`<p>${inline(paragraph.join(' '))}</p>`)
      paragraph = []
    }
  }
  const flushList = () => {
    if (list) {
      out.push(`</${list}>`)
      list = null
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) {
      flushParagraph()
      flushList()
      continue
    }
    if (line.startsWith('```')) {
      flushParagraph()
      flushList()
      const lang = line.slice(3).trim() || 'Text'
      const code = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) {
        code.push(lines[i])
        i++
      }
      out.push(codeBlock(code.join('\n'), lang))
      continue
    }
    const heading = line.match(/^(#{1,3})\s+(.*)$/)
    if (heading) {
      flushParagraph()
      flushList()
      const level = heading[1].length
      const id = slugify(heading[2], usedIds)
      if (level > 1) headings.push({ level, text: heading[2], id })
      out.push(`<h${level} id="${id}">${inline(heading[2])}</h${level}>`)
      continue
    }
    if (line.trim().startsWith('|')) {
      flushParagraph()
      flushList()
      const rows = []
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(lines[i])
        i++
      }
      i--
      out.push(table(rows))
      continue
    }
    const bullet = line.match(/^[-*]\s+(.*)$/)
    const numbered = line.match(/^\d+\.\s+(.*)$/)
    if (bullet || numbered) {
      flushParagraph()
      const wanted = bullet ? 'ul' : 'ol'
      if (list !== wanted) {
        flushList()
        out.push(`<${wanted}>`)
        list = wanted
      }
      out.push(`<li>${inline((bullet ?? numbered)[1])}</li>`)
      continue
    }
    // A wrapped list item continues the previous <li> instead of becoming a
    // new paragraph, so prose keeps its intended grouping.
    if (list && out[out.length - 1]?.startsWith('<li>')) {
      out[out.length - 1] = out[out.length - 1].replace(
        /<\/li>$/,
        ` ${inline(line.trim())}</li>`,
      )
      continue
    }
    flushList()
    paragraph.push(line.trim())
  }
  flushParagraph()
  flushList()
  return { html: out.join('\n'), headings }
}

const guides = [
  ['caregiver-guide.md', 'Caregiver Guide'],
  ['usb-install.md', 'USB Install Walkthrough'],
  ['hardware-compatibility.md', 'Hardware Compatibility'],
  ['hardware-support.md', 'Hardware Support and Power Behaviour'],
  ['updates-and-recovery.md', 'Updates and Recovery'],
]

const links = guides
  .map(([file, title]) => `<a href="${file.replace(/\.md$/, '.html')}">${title}</a>`)
  .join('\n')

for (const [file, title] of guides) {
  const md = readFileSync(resolve(docs, file), 'utf8')
  const description = `${title} — plain-English guidance from the SimpleOS project.`
  const { html: body, headings } = markdownToHtml(md)
  const toc = headings
    .filter((h) => h.level === 2)
    .map((h) => `<li><a href="#${h.id}">${inline(h.text)}</a></li>`)
    .join('\n')
  const page = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light dark" />
    <title>${escapeHtml(title)} — SimpleOS</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="https://mt25mb.github.io/SimpleOS/${file.replace(/\.md$/, '.html')}" />
    <meta name="theme-color" content="#faf9f6" media="(prefers-color-scheme: light)" />
    <meta name="theme-color" content="#0b1120" media="(prefers-color-scheme: dark)" />

    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="SimpleOS" />
    <meta property="og:title" content="${escapeHtml(title)} — SimpleOS" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="https://mt25mb.github.io/SimpleOS/${file.replace(/\.md$/, '.html')}" />
    <meta property="og:image" content="https://mt25mb.github.io/SimpleOS/assets/simpleos-banner.png" />
    <meta property="og:image:width" content="1240" />
    <meta property="og:image:height" content="600" />
    <meta property="og:image:alt" content="SimpleOS: an immutable base, a simplified launcher, and built-in scam protection." />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)} — SimpleOS" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="https://mt25mb.github.io/SimpleOS/assets/simpleos-banner.png" />

    <link rel="icon" type="image/png" sizes="512x512" href="assets/simpleos-logo.png" />
    <link rel="apple-touch-icon" href="assets/simpleos-logo.png" />
    <link rel="preload" href="assets/fonts/plus-jakarta-sans.woff2" as="font" type="font/woff2" crossorigin />
    <link rel="preload" href="assets/fonts/atkinson-400.woff2" as="font" type="font/woff2" crossorigin />
    <link rel="stylesheet" href="styles.css" />
    <script src="script.js" defer></script>
  </head>
  <body>
    ${skipLink}
    ${guideHeader}

    <main id="main" class="guide-main">
      <div class="wrap">
        <nav class="guide-crumbs" aria-label="Breadcrumb">
          <a href="index.html">← Back to SimpleOS home</a>
          <span aria-hidden="true">/</span>
          <span aria-current="page">${escapeHtml(title)}</span>
        </nav>
        <nav class="guide-toc" aria-labelledby="toc-title">
          <p class="guide-toc__title" id="toc-title">On this page</p>
          <ol>${toc}</ol>
        </nav>
        <article class="guide">
          ${body}
        </article>
        <nav class="guide-links" aria-label="Other guides">
          <p class="guide-links__title">More guides</p>
          <div class="guide-links__grid">
            <a href="index.html">← Back to SimpleOS home</a>
            ${links}
          </div>
        </nav>
        <p class="sr-only" id="copy-status" role="status" aria-live="polite"></p>
      </div>
    </main>

    ${footer}
  </body>
</html>
`
  const target = resolve(docs, file.replace(/\.md$/, '.html'))
  writeFileSync(target, page)
  console.log(`wrote ${target}`)
}
