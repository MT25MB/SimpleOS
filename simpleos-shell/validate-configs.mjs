/*
 * Validate every JSON and YAML config in the repository.
 * Run with `npm run validate:configs` from simpleos-shell/.
 * Uses js-yaml from this package's devDependencies. No network access.
 */
import fs from 'node:fs'
import path from 'node:path'
import yaml from 'js-yaml'

const repo = path.resolve('..')
let failures = 0

function check(file, parse) {
  const target = path.isAbsolute(file) ? file : path.join(repo, file)
  if (!fs.existsSync(target)) {
    console.error(`MISSING: ${file}`)
    failures += 1
    return
  }
  try {
    parse(fs.readFileSync(target, 'utf8'))
    console.log(`OK: ${file}`)
  } catch (error) {
    console.error(`INVALID: ${file} - ${error.message}`)
    failures += 1
  }
}

const jsonFiles = [
  'simpleos-shell/package.json',
  'simpleos-shell/package-lock.json',
  'simpleos-shell/tsconfig.json',
  'simpleos-shell/electron/tsconfig.json',
  'system-configs/firefox/policies.json',
]

const yamlFiles = [
  '.github/dependabot.yml',
  '.github/workflows/build-image.yml',
  '.github/workflows/deploy-pages.yml',
  '.github/workflows/test.yml',
  '.github/workflows/release.yml',
  'simpleos-shell/electron-builder.yml',
]

for (const file of jsonFiles) check(file, JSON.parse)
for (const file of yamlFiles) check(file, yaml.load)

// Extra sanity checks on the browser policy file.
const policies = JSON.parse(
  fs.readFileSync(path.join(repo, 'system-configs/firefox/policies.json'), 'utf8'),
).policies
const requiredPolicies = ['HttpsOnlyMode', 'DisableTelemetry', 'Permissions', 'ExtensionSettings']
for (const key of requiredPolicies) {
  if (!(key in policies)) {
    console.error(`MISSING POLICY: ${key}`)
    failures += 1
  }
}

if (failures > 0) {
  console.error(`\n${failures} config check(s) failed.`)
  process.exit(1)
}
console.log('\nAll JSON and YAML configs are valid.')
