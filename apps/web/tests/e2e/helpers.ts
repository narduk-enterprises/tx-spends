import type { Page, TestInfo } from '@playwright/test'
import { expect, waitForHydration } from './fixtures'

export async function gotoAndHydrate(page: Page, path: string) {
  const response = await page.goto(path, { waitUntil: 'domcontentloaded' })
  expect(response?.ok(), `Expected ${path} to return an OK response`).toBeTruthy()
  await waitForHydration(page)
  await page.waitForLoadState('networkidle').catch(() => {})
  await expect(page.locator('main')).toBeVisible()
}

export async function capturePage(page: Page, testInfo: TestInfo, name: string) {
  await page.screenshot({
    path: testInfo.outputPath(`${name}.png`),
    fullPage: true,
  })
}

export async function selectOptionByLabel(page: Page, label: string, optionText: string) {
  const combobox = page.getByRole('combobox', { name: label })
  await expect(combobox).toBeVisible()
  await combobox.scrollIntoViewIfNeeded()
  await combobox.click({ force: true })

  const option = page.getByRole('option', { name: optionText, exact: true }).first()
  if (!(await option.isVisible().catch(() => false))) {
    await combobox.press('ArrowDown')
  }

  await expect(option).toBeVisible()
  await option.click({ force: true })
}

export async function expectQueryParam(page: Page, key: string, expectedValue: string) {
  await expect.poll(() => new URL(page.url()).searchParams.get(key)).toBe(expectedValue)
}

export function createConsoleTracker(page: Page) {
  const issues: string[] = []

  page.on('console', (message) => {
    const type = message.type()
    if (type === 'error' || type === 'warning') {
      issues.push(`[console:${type}] ${message.text()}`)
    }
  })

  page.on('pageerror', (error) => {
    issues.push(`[pageerror] ${error.message}`)
  })

  return {
    async expectClean() {
      expect(issues, issues.join('\n')).toEqual([])
    },
  }
}
