import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import yaml from 'js-yaml'

const root = resolve(__dirname, '../..')
const read = (p: string) => readFileSync(resolve(root, p), 'utf8')

describe('docs links and assets', () => {
  const site = read('docs/index.html')
  const readme = read('README.md')

  it('references image assets that exist', () => {
    const refs = [...site.matchAll(/src="(assets\/[^"]+)"/g)].map((m) => m[1])
    expect(refs.length).toBeGreaterThanOrEqual(2)
    for (const ref of refs) {
      expect(existsSync(resolve(root, 'docs', ref)), ref).toBe(true)
    }
  })

  it('resolves every in-page anchor', () => {
    const ids = new Set([...site.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]))
    const links = [...site.matchAll(/href="#([^"]+)"/g)].map((m) => m[1])
    expect(links.length).toBeGreaterThan(0)
    for (const link of links) {
      expect(ids.has(link), link).toBe(true)
    }
  })

  it('resolves relative document links', () => {
    const links = [...site.matchAll(/href="([^"#]+\.md)"/g)].map((m) => m[1])
    expect(links.length).toBeGreaterThan(0)
    for (const link of links) {
      expect(existsSync(resolve(root, 'docs', link)), link).toBe(true)
    }
  })

  it('uses only https external links to the expected repository', () => {
    const links = [...site.matchAll(/href="(https?:\/\/[^"]+)"/g)].map((m) => m[1])
    expect(links.length).toBeGreaterThan(0)
    for (const link of links) {
      expect(link.startsWith('https://')).toBe(true)
      expect(link).toContain('github.com/MT25MB/SimpleOS')
    }
  })

  it('keeps README image references valid', () => {
    const refs = [...readme.matchAll(/src="(docs\/assets\/[^"]+)"/g)].map((m) => m[1])
    expect(refs.length).toBeGreaterThan(0)
    for (const ref of refs) {
      expect(existsSync(resolve(root, ref)), ref).toBe(true)
    }
  })
})

describe('community and governance docs', () => {
  const readme = read('README.md')
  const governance = ['CONTRIBUTING.md', 'CODE_OF_CONDUCT.md', 'SECURITY.md']

  it('ships the governance documents and links them from the README', () => {
    for (const doc of governance) {
      expect(existsSync(resolve(root, doc)), doc).toBe(true)
      expect(readme, doc).toContain(doc)
    }
  })

  it('keeps the contributor guide practical and accessibility-first', () => {
    const guide = read('CONTRIBUTING.md')
    expect(guide).toContain('bash scripts/test-all.sh')
    expect(guide).toContain('bash scripts/test-vm.sh')
    expect(guide).toContain('18px')
    expect(guide).toContain('WCAG AAA')
    expect(guide).toContain('48 × 48px')
    expect(guide).toContain('Plain-English UI rules')
    expect(guide).toContain('messages.ts')
  })

  it('uses the official Contributor Covenant with a private contact method', () => {
    const conduct = read('CODE_OF_CONDUCT.md')
    expect(conduct).toContain('Contributor Covenant')
    expect(conduct).toContain('version 2.1')
    expect(conduct).toContain('security/advisories/new')
  })

  it('keeps security reporting private and focused on escape risks', () => {
    const security = read('SECURITY.md')
    expect(security).toContain('security/advisories/new')
    expect(security).toContain('kiosk escape')
    expect(security).toContain('senior')
  })

  it('parses every issue form and the template config as valid YAML', () => {
    const dir = resolve(root, '.github/ISSUE_TEMPLATE')
    const files = readdirSync(dir).filter((file) => file.endsWith('.yml'))
    expect(files).toEqual(
      expect.arrayContaining([
        'bug_report.yml',
        'accessibility_feedback.yml',
        'caregiver_feature_request.yml',
        'config.yml',
      ]),
    )
    for (const file of files.filter((name) => name !== 'config.yml')) {
      const form = yaml.load(readFileSync(resolve(dir, file), 'utf8')) as Record<string, unknown>
      expect(form.name, file).toBeTruthy()
      expect(form.description, file).toBeTruthy()
      expect(Array.isArray(form.body), file).toBe(true)
    }
    const config = yaml.load(readFileSync(resolve(dir, 'config.yml'), 'utf8')) as Record<
      string,
      unknown
    >
    expect(config.blank_issues_enabled).toBe(true)
    expect(Array.isArray(config.contact_links)).toBe(true)
  })
})

describe('GitHub Actions workflows', () => {
  it('parses as valid YAML with the required triggers and permissions', () => {
    const build = yaml.load(read('.github/workflows/build-image.yml')) as Record<string, unknown>
    const pages = yaml.load(read('.github/workflows/deploy-pages.yml')) as Record<string, unknown>
    const test = yaml.load(read('.github/workflows/test.yml')) as Record<string, unknown>
    const release = yaml.load(read('.github/workflows/release.yml')) as Record<string, unknown>

    const buildOn = (build.on ?? build.true) as Record<string, unknown>
    expect(Object.keys(buildOn)).toEqual(expect.arrayContaining(['push', 'schedule', 'workflow_dispatch']))
    expect((build.permissions as Record<string, unknown>).packages).toBe('write')

    const pagesOn = (pages.on ?? pages.true) as Record<string, unknown>
    expect(Object.keys(pagesOn)).toEqual(expect.arrayContaining(['push', 'workflow_dispatch']))
    const pagePerms = pages.permissions as Record<string, unknown>
    expect(pagePerms.pages).toBe('write')
    expect(pagePerms['id-token']).toBe('write')

    const testOn = (test.on ?? test.true) as Record<string, unknown>
    expect(Object.keys(testOn)).toEqual(
      expect.arrayContaining(['pull_request', 'push', 'workflow_call']),
    )

    const releaseOn = (release.on ?? release.true) as Record<string, unknown>
    expect(releaseOn.push).toBeDefined()
    expect(releaseOn.workflow_dispatch).toBeDefined()
    expect((release.permissions as Record<string, unknown>).contents).toBe('read')
  })

  it('gates the image, Pages and release workflows on the test workflow', () => {
    for (const file of [
      '.github/workflows/build-image.yml',
      '.github/workflows/deploy-pages.yml',
      '.github/workflows/release.yml',
    ]) {
      const workflow = yaml.load(read(file)) as { jobs: Record<string, { needs?: string; uses?: string }> }
      expect(workflow.jobs.test?.uses, file).toBe('./.github/workflows/test.yml')
      const publishingJob = file.includes('build-image')
        ? workflow.jobs['build-image']
        : file.includes('deploy-pages')
          ? workflow.jobs.deploy
          : workflow.jobs.release
      expect(publishingJob?.needs, file).toBe('test')
    }
  })
})

describe('shell script syntax', () => {
  const bashCandidates = [
    '/bin/bash',
    '/usr/bin/bash',
    'C:\\Program Files\\Git\\bin\\bash.exe',
  ]

  function findBash(): string {
    const found = bashCandidates.find((candidate) => existsSync(candidate))
    if (!found) throw new Error('No bash interpreter found for syntax checks')
    return found
  }

  it('passes bash -n for every committed shell script', () => {
    const scripts = [
      'scripts/build-iso.sh',
      'scripts/test-vm.sh',
      'scripts/test-all.sh',
      'scripts/generate-release-notes.sh',
      'scripts/flash-usb.sh',
      'system-configs/labwc/autostart',
      'system-configs/systemd/simpleos-firstboot.sh',
    ]
    const bash = findBash()
    for (const script of scripts) {
      const result = spawnSync(bash, ['-n', resolve(root, script)], { encoding: 'utf8' })
      expect(result.status, `${script}: ${result.stderr}`).toBe(0)
    }
  })

  it('handles --reset by recreating the qcow2 disk', () => {
    const script = read('scripts/test-vm.sh')
    expect(script).toMatch(/--reset\)/)
    expect(script).toContain('rm -f "$DISK"')
    expect(script).toContain('simpleos-test.qcow2')
  })
})
