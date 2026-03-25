import { expect, test, waitForBaseUrlReady, warmUpApp } from './fixtures'
import { capturePage, createConsoleTracker, gotoAndHydrate } from './helpers'

test.describe('detail pages', () => {
  test.setTimeout(120_000)

  test.beforeAll(async ({ browser, baseURL }) => {
    if (!baseURL) {
      throw new Error('detail page tests require Playwright baseURL to be configured.')
    }

    await waitForBaseUrlReady(baseURL)
    await warmUpApp(browser, baseURL)
  })

  test('agency detail page renders tabs and summary cards', async ({ page }, testInfo) => {
    const consoleTracker = createConsoleTracker(page)
    await gotoAndHydrate(page, '/agencies')
    if (
      await page
        .getByText('Agency rankings are temporarily syncing.')
        .isVisible()
        .catch(() => false)
    ) {
      await expect(page.getByText('Agency leaderboard pending')).toBeVisible()
      await expect(page.getByRole('table')).toHaveCount(0)
    } else {
      await page.getByRole('table').getByRole('link').first().click()

      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await expect(page.getByRole('tab', { name: 'Overview' })).toBeVisible()
      await expect(page.getByText('Distinct payees')).toBeVisible()
    }

    await capturePage(page, testInfo, 'agency-detail')
    await consoleTracker.expectClean()
  })

  test('county detail page renders disclaimer and data tabs', async ({ page }, testInfo) => {
    const consoleTracker = createConsoleTracker(page)
    await gotoAndHydrate(page, '/counties')
    await page.getByRole('table').getByRole('link').first().click()

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByText('County views are an annual geography layer.')).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Expenditure types' })).toBeVisible()

    await capturePage(page, testInfo, 'county-detail')
    await consoleTracker.expectClean()
  })

  test('special geography detail pages do not append a county suffix', async ({
    page,
  }, testInfo) => {
    const consoleTracker = createConsoleTracker(page)
    await gotoAndHydrate(page, '/counties/1c221c44-18db-4a75-a9cb-5dad071c7616')

    await expect(page.getByRole('heading', { level: 1, name: 'In Texas' })).toBeVisible()
    await expect(page).toHaveTitle(/Texas State Spending in In Texas\b/)
    await expect(page.getByText('In Texas County', { exact: true })).toHaveCount(0)

    await capturePage(page, testInfo, 'county-special-geography-detail')
    await consoleTracker.expectClean()
  })

  test('category and object detail pages render from collection links', async ({
    page,
  }, testInfo) => {
    const consoleTracker = createConsoleTracker(page)
    await gotoAndHydrate(page, '/categories')
    if (
      await page
        .getByText('Category rankings are temporarily syncing.')
        .isVisible()
        .catch(() => false)
    ) {
      await expect(page.getByText('Payment backfill in progress')).toBeVisible()
    } else {
      await page.getByRole('table').getByRole('link').first().click()
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    }

    await gotoAndHydrate(page, '/objects')
    await page.getByRole('table').getByRole('link').first().click()
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    await capturePage(page, testInfo, 'category-and-object-details')
    await consoleTracker.expectClean()
  })

  test('payee detail page renders vendor match card and category tab', async ({
    page,
  }, testInfo) => {
    const consoleTracker = createConsoleTracker(page)
    await gotoAndHydrate(page, '/payees')
    if (
      await page
        .getByText('Payee rankings are temporarily syncing.')
        .isVisible()
        .catch(() => false)
    ) {
      await expect(page.getByText('Payee leaderboard pending')).toBeVisible()
      await expect(page.getByRole('table')).toHaveCount(0)
    } else {
      await page.getByRole('table').getByRole('link').first().click()

      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await expect(page.getByText('Vendor match')).toBeVisible()
      await expect(page.getByRole('tab', { name: 'Categories' })).toBeVisible()
    }

    await capturePage(page, testInfo, 'payee-detail')
    await consoleTracker.expectClean()
  })
})
