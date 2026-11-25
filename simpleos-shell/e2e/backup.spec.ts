import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { openApp } from './harness'

const contacts = {
  contacts: [
    {
      id: 'anna123',
      name: 'Anna',
      relationship: 'Daughter',
      avatarFile: null,
      roomUrl: 'https://meet.jit.si/anna',
    },
  ],
}

const reminders = {
  date: '2026-11-25',
  items: [{ id: 'r1', text: 'Take medicine', time: '09:00', done: false, createdAt: 1 }],
}

async function openCaregiver(page: import('@playwright/test').Page): Promise<void> {
  await openApp(page, {
    setupComplete: true,
    seniorName: 'Mom',
    pin: '1234',
    contacts,
    reminders,
  })
  await page.getByRole('button', { name: /Caregiver Settings/ }).click()
  await page.getByLabel('PIN').fill('1234')
  await page.getByRole('button', { name: /Unlock/ }).click()
  await expect(page.getByRole('button', { name: 'Save backup file' })).toBeVisible()
}

function upload(page: import('@playwright/test').Page, contents: string | Buffer, name = 'simpleos-backup.json') {
  return page.locator('#backup-file').setInputFiles({
    name,
    mimeType: 'application/json',
    buffer: typeof contents === 'string' ? Buffer.from(contents) : contents,
  })
}

test.describe('Caregiver configuration backup', () => {
  test('exports a clean file and restores it into Senior Mode', async ({ page }) => {
    await openCaregiver(page)

    const downloadReady = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Save backup file' }).click()
    const download = await downloadReady
    expect(download.suggestedFilename()).toBe('simpleos-backup.json')
    const path = await download.path()
    expect(path).not.toBeNull()
    const exported = await readFile(path!, 'utf8')
    const parsed = JSON.parse(exported)
    expect(parsed.version).toBe(1)
    expect(parsed.seniorName).toBe('Mom')
    expect(parsed.contacts.contacts[0].name).toBe('Anna')
    expect(exported).not.toMatch(/"pin"|"hash"|"salt"|"caregiverPin"/i)

    // Change a few values, then restore the edited file.
    const edited = JSON.stringify({
      ...parsed,
      seniorName: 'Grandma',
      frameDelay: 5,
      fontScale: 26 / 18,
    })
    await upload(page, edited)
    const preview = page.getByRole('region', { name: 'Backup preview' })
    await expect(preview).toBeVisible()
    await expect(preview.getByText('Name: Grandma')).toBeVisible()
    await expect(preview.getByText('Photo frame: 5 minutes')).toBeVisible()

    await page.getByRole('button', { name: 'Apply backup' }).click()
    await expect(
      page.getByText(/Good (morning|afternoon|evening), Grandma/),
    ).toBeVisible()
    await expect(page.getByRole('status').filter({ hasText: 'Backup restored' }).first()).toBeVisible()
  })

  test('rejects credential fields and oversized files with plain English', async ({ page }) => {
    await openCaregiver(page)

    await upload(page, '{"pin":"1234"}')
    await expect(page.getByRole('alert')).toContainText(/PIN or password/i)
    await expect(page.getByRole('button', { name: 'Apply backup' })).toHaveCount(0)

    await upload(page, Buffer.alloc(1024 * 1024 + 1, 0x20))
    await expect(page.getByRole('alert')).toContainText(/too big/i)
    await expect(page.getByRole('button', { name: 'Apply backup' })).toHaveCount(0)
  })
})
