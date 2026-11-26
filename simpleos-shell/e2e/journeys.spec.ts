import { expect, test, type Page } from '@playwright/test'
import { events, openApp } from './harness'

const contacts = {
  contacts: [
    {
      id: 'anna',
      name: 'Anna',
      relationship: 'Daughter',
      avatarFile: null,
      roomUrl: 'https://meet.jit.si/anna',
    },
  ],
}

const reminders = {
  date: '',
  items: [
    { id: 'r1', text: 'Take medicine', time: '09:00', done: false, createdAt: 1 },
  ],
}

async function storedPin(page: Page): Promise<string | null> {
  return page.evaluate(() => window.localStorage.getItem('e2e.pin'))
}

test.describe('Full caregiver and senior journeys', () => {
  test('Ask for Help gives immediate feedback when launching remote help', async ({ page }) => {
    await openApp(page)
    await page.getByRole('button', { name: /Ask for Help/ }).click()
    await expect(
      page.getByRole('status').filter({ hasText: 'Screen sharing is starting' }).first(),
    ).toBeVisible()
    await expect
      .poll(async () =>
        (await events(page)).some((event) => event.name === 'launchApp' && event.detail === 'rustdesk'),
      )
      .toBe(true)
  })

  test('downloaded photos appear in the album and open safely', async ({ page }) => {
    await openApp(page, {
      photos: [
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8AAAwAB/AF+gXeJAAAAAElFTkSuQmCC',
      ],
    })
    await page.getByRole('button', { name: /Photo Album/ }).click()
    await expect(page.getByRole('heading', { name: 'Photo Album' })).toBeVisible()
    await page.getByRole('button', { name: 'Open photo 1' }).click()
    await expect
      .poll(async () =>
        (await events(page)).some((event) => event.name === 'openPhoto' && event.detail === 0),
      )
      .toBe(true)
  })

  test('a fresh computer completes the five-step setup and enters Senior Mode', async ({ page }) => {
    await openApp(page, { setupComplete: false, pin: '', transcript: 'open video call' })
    const wizard = page.locator('.setup-wizard')

    await expect(wizard.getByText('Step 1 of 5')).toBeVisible()
    await wizard.getByLabel('First name').fill('Mom')
    await wizard.getByText('Large', { exact: true }).click()
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.style.getPropertyValue('--font-scale')),
      )
      .toBe(String(22 / 18))
    await wizard.getByText('Normal', { exact: true }).click()
    await wizard.getByRole('button', { name: 'Next' }).click()

    await expect(wizard.getByText('Step 2 of 5')).toBeVisible()
    await wizard.getByLabel('New PIN (4 to 6 numbers)').fill('1234')
    await wizard.getByLabel('Enter it again').fill('1234')
    await wizard.getByRole('button', { name: 'Next' }).click()

    await expect(wizard.getByText('Step 3 of 5')).toBeVisible()
    await expect(wizard.getByText('Connected to Home Network.')).toBeVisible()
    await wizard.getByRole('button', { name: 'Play Test Chime' }).click()
    await expect
      .poll(async () => (await events(page)).some((event) => event.name === 'speak'))
      .toBe(true)
    await wizard.getByRole('button', { name: 'Next' }).click()

    await expect(wizard.getByText('Step 4 of 5')).toBeVisible()
    await wizard.getByLabel('Name').fill('Anna')
    await wizard.getByLabel('Video room link').fill('https://meet.jit.si/anna')
    await wizard.getByRole('button', { name: 'Add person' }).click()
    await expect(wizard.getByText('Anna · https://meet.jit.si/anna')).toBeVisible()
    await wizard.getByLabel('Reminder').fill('Take medicine')
    await wizard.getByRole('button', { name: 'Add reminder' }).click()
    await wizard.getByRole('button', { name: 'Next' }).click()

    await expect(wizard.getByText('Step 5 of 5')).toBeVisible()
    await wizard.getByLabel('RustDesk ID (optional)').fill('1234567')
    await wizard.getByRole('button', { name: 'Finish & Switch to Senior Mode' }).click()

    await expect(page.getByText(/Good (morning|afternoon|evening), Mom/)).toBeVisible()
    await expect(page.getByRole('button', { name: /Video Call Family/ })).toBeVisible()
    expect(await storedPin(page)).toBe('1234')
    const log = await events(page)
    expect(log.some((event) => event.name === 'setPin')).toBe(true)
    expect(log.some((event) => event.name === 'saveContacts')).toBe(true)
  })

  test('Senior Mode voice, reminders, family calls, photo frame and PIN gate work', async ({
    page,
  }) => {
    await page.clock.install()
    await openApp(page, {
      setupComplete: true,
      seniorName: 'Mom',
      pin: '1234',
      contacts,
      reminders,
      frameDelay: 2,
      photos: [
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8AAAwAB/AF+gXeJAAAAAElFTkSuQmCC',
      ],
    })

    // Read-Aloud is driven by a local speech fallback in this harness.
    await page.getByRole('button', { name: /Read Aloud/ }).click()
    await page.getByRole('button', { name: /Daily Reminders/ }).click()
    await expect
      .poll(async () => (await events(page)).some((event) => event.name === 'speak'))
      .toBe(true)
    await page.getByRole('button', { name: 'Mark done: Take medicine' }).click()
    await expect(
      page.getByRole('button', { name: 'Mark not done: Take medicine' }),
    ).toHaveAttribute('aria-pressed', 'true')

    // Simulated push-to-talk returns a fixed local transcript, then confirms.
    await page.getByRole('button', { name: '← Back to home' }).click()
    const speak = page.getByRole('button', { name: 'Hold to Speak' })
    await speak.dispatchEvent('pointerdown')
    await speak.dispatchEvent('pointerup')
    await expect(page.getByText(/I heard:/)).toBeVisible()
    await expect(page.getByText(/Open Video Call/)).toBeVisible()
    await page.getByRole('button', { name: 'Confirm' }).click()
    await expect
      .poll(async () =>
        (await events(page)).some(
          (event) => event.name === 'launchApp' && event.detail === 'jitsi',
        ),
      )
      .toBe(true)

    // A family card opens its approved video room.
    await page.getByRole('button', { name: /Video Call Family/ }).click()
    await expect(page.getByText('Anna', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: /Call Now/ }).click()
    await expect
      .poll(async () =>
        (await events(page)).some((event) => event.name === 'callContact'),
      )
      .toBe(true)

    // The idle frame appears after the configured quiet period and dismisses.
    await page.clock.runFor(2 * 60_000 + 2_000)
    await expect(page.getByLabel('Photo frame')).toBeVisible()
    await page.getByRole('button', { name: 'Back to SimpleOS' }).click()
    await expect(page.getByLabel('Photo frame')).toHaveCount(0)

    // Caregiver Settings is still behind the PIN.
    await page.getByRole('button', { name: '← Back to home' }).click()
    await page.getByRole('button', { name: /Caregiver Settings/ }).click()
    await page.getByLabel('PIN').fill('1234')
    await page.getByRole('button', { name: /Unlock/ }).click()
    await expect(page.getByRole('button', { name: /Run Setup Again/ })).toBeVisible()
  })
})
