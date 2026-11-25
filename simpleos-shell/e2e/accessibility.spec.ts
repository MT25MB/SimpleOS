import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { openApp } from './harness'

type Screen =
  | 'setup wizard'
  | 'home grid'
  | 'reminders'
  | 'video calls'
  | 'pin keypad'
  | 'caregiver settings'

const SCALES = [
  { name: 'Normal (18px)', value: 1 },
  { name: 'Large (22px)', value: 22 / 18 },
  { name: 'Extra Large (26px)', value: 26 / 18 },
]

const SCREENS: Screen[] = [
  'setup wizard',
  'home grid',
  'reminders',
  'video calls',
  'pin keypad',
  'caregiver settings',
]

async function gotoScreen(page: Page, screen: Screen, scale: number): Promise<void> {
  await openApp(page, {
    setupComplete: screen !== 'setup wizard',
    seniorName: screen === 'setup wizard' ? null : 'Mom',
    pin: screen === 'setup wizard' ? '' : '1234',
    scale,
    contacts: {
      contacts: [
        {
          id: 'anna',
          name: 'Anna',
          relationship: 'Daughter',
          avatarFile: null,
          roomUrl: 'https://meet.jit.si/anna',
        },
      ],
    },
  })

  if (screen === 'reminders') {
    await page.getByRole('button', { name: /Daily Reminders/ }).click()
  } else if (screen === 'video calls') {
    await page.getByRole('button', { name: /Video Call Family/ }).click()
  } else if (screen === 'pin keypad' || screen === 'caregiver settings') {
    await page.getByRole('button', { name: /Caregiver Settings/ }).click()
    if (screen === 'caregiver settings') {
      await page.getByLabel('PIN').fill('1234')
      await page.getByRole('button', { name: /Unlock/ }).click()
      await expect(page.getByRole('button', { name: /Run Setup Again/ })).toBeVisible()
    }
  }
}

async function assertAaa(page: Page, screen: Screen, scaleName: string): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags([
      'wcag2a',
      'wcag2aa',
      'wcag2aaa',
      'wcag21a',
      'wcag21aa',
      'wcag21aaa',
      'wcag22aa',
      'wcag22aaa',
    ])
    .analyze()
  const blocking = results.violations
    .filter((violation) => violation.impact === 'critical' || violation.impact === 'serious')
    .map(
      (violation) =>
        `${violation.id} (${violation.impact}): ${violation.nodes
          .map(
            (node) =>
              `${node.target.join(' ')} — ${(node.failureSummary ?? '').replace(/\s+/g, ' ')}`,
          )
          .join(' | ')}`,
    )
  expect(blocking, `${screen} / ${scaleName}`).toEqual([])
}

async function assertLargeTargets(page: Page, label: string): Promise<void> {
  const small = await page.locator('button:visible').evaluateAll((elements) =>
    elements
      .map((element) => {
        const box = element.getBoundingClientRect()
        const name = element.getAttribute('aria-label') || element.textContent?.trim() || 'button'
        return { name, width: box.width, height: box.height }
      })
      .filter((item) => item.width < 48 || item.height < 48),
  )
  expect(small, `buttons smaller than 48x48 on ${label}`).toEqual([])
}

async function assertNoOverflow(page: Page, label: string): Promise<void> {
  const problems = await page.evaluate(() => {
    const output: string[] = []
    const documentElement = document.documentElement
    if (documentElement.scrollWidth > documentElement.clientWidth + 1) {
      output.push(
        `document: scrollWidth ${documentElement.scrollWidth} > clientWidth ${documentElement.clientWidth}`,
      )
    }
    const selectors = 'button, h1, h2, h3, p, label'
    document.querySelectorAll(selectors).forEach((element) => {
      if (element.getClientRects().length === 0) return
      if (element.scrollWidth > element.clientWidth + 2) {
        const name = element.getAttribute('aria-label') || element.textContent?.trim() || element.tagName
        output.push(`${element.tagName} "${name.slice(0, 40)}": ${element.scrollWidth}>${element.clientWidth}`)
      }
    })
    return output
  })
  expect(problems, `horizontal overflow or clipped text on ${label}`).toEqual([])
}

for (const scale of SCALES) {
  for (const screen of SCREENS) {
    test(`${screen} at ${scale.name}: AAA, 48px targets and no clipping`, async ({ page }) => {
      await gotoScreen(page, screen, scale.value)
      const label = `${screen} / ${scale.name}`
      await assertAaa(page, screen, scale.name)
      await assertLargeTargets(page, label)
      await assertNoOverflow(page, label)
    })
  }
}
