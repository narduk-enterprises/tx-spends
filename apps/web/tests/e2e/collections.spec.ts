import { expect, test, waitForBaseUrlReady, warmUpApp } from './fixtures'
import {
  capturePage,
  createConsoleTracker,
  expectQueryParam,
  gotoAndHydrate,
  selectOptionByLabel,
} from './helpers'

test.describe('collection pages', () => {
  test.beforeAll(async ({ browser, baseURL }) => {
    if (!baseURL) {
      throw new Error('collection page tests require Playwright baseURL to be configured.')
    }

    await waitForBaseUrlReady(baseURL)
    await warmUpApp(browser, baseURL)
  })

  test('agencies collection renders rows and detail links', async ({ page }, testInfo) => {
    const consoleTracker = createConsoleTracker(page)
    await gotoAndHydrate(page, '/agencies')

    await expect(page.getByRole('heading', { name: 'Agency Explorer' })).toBeVisible()
    const backfillAlert = page.getByText('Agency rankings are temporarily syncing.')
    if (await backfillAlert.isVisible().catch(() => false)) {
      await expect(page.getByText('Payment backfill in progress')).toBeVisible()
      await expect(page.getByRole('table')).toHaveCount(0)
    } else {
      await expect(page.getByRole('table')).toBeVisible()
      await expect(page.getByRole('table').getByRole('link').first()).toBeVisible()
    }

    await capturePage(page, testInfo, 'agencies-collection')
    await consoleTracker.expectClean()
  })

  test('overview and payee collection totals stay aligned with fact-backed entities', async ({
    request,
  }) => {
    const [overviewResponse, payeesResponse] = await Promise.all([
      request.get('/api/v1/overview', { timeout: 30_000 }),
      request.get('/api/v1/payees?limit=5', { timeout: 30_000 }),
    ])

    expect(overviewResponse.ok()).toBeTruthy()
    expect(payeesResponse.ok()).toBeTruthy()

    const overviewPayload = await overviewResponse.json()
    const payeesPayload = await payeesResponse.json()

    if (overviewPayload.meta?.payments_backfill_active || payeesPayload.meta?.payments_backfill_active) {
      expect(overviewPayload.meta?.payments_backfill_active).toBeTruthy()
      expect(payeesPayload.meta?.payments_backfill_active).toBeTruthy()
      expect(overviewPayload.data.payee_count).toBe(0)
      expect(payeesPayload.meta.total).toBe(0)
    } else {
      expect(overviewPayload.data.payee_count).toBe(payeesPayload.meta.total)
      expect(overviewPayload.data.agency_count).toBeGreaterThan(0)
      expect(overviewPayload.data.payee_count).toBeGreaterThan(0)
      expect(payeesPayload.data[0]?.amount || 0).toBeGreaterThan(0)
    }
  })

  test('counties collection renders map and fiscal year filter updates URL', async ({
    page,
  }, testInfo) => {
    const consoleTracker = createConsoleTracker(page)
    await gotoAndHydrate(page, '/counties')

    await expect(page.getByRole('heading', { name: 'County Spending Map' })).toBeVisible()
    await expect(
      page.getByText('Annual county-level distribution of Texas state expenditures.'),
    ).toBeVisible()

    await selectOptionByLabel(page, 'Fiscal year', 'FY 2024')
    await expectQueryParam(page, 'fy', '2024')
    await expect(page.getByRole('table').locator('tbody tr').first()).not.toContainText('$0.00')

    await capturePage(page, testInfo, 'counties-collection-fy-2024')
    await consoleTracker.expectClean()
  })

  test('counties collection keeps special geographies honest', async ({ page }, testInfo) => {
    const consoleTracker = createConsoleTracker(page)
    await gotoAndHydrate(page, '/counties')

    await expect(page.getByText('In Texas', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('In Texas County', { exact: true })).toHaveCount(0)

    await capturePage(page, testInfo, 'counties-collection-special-geography')
    await consoleTracker.expectClean()
  })

  test('counties collection shows an honest empty state for unsupported fiscal years', async ({
    page,
  }, testInfo) => {
    const consoleTracker = createConsoleTracker(page)
    await gotoAndHydrate(page, '/counties?fy=2099')

    await expect(page.getByText('No county spending data')).toBeVisible()
    await expect(page.getByRole('table')).toHaveCount(0)

    await capturePage(page, testInfo, 'counties-collection-empty-future-year')
    await consoleTracker.expectClean()
  })

  test('counties fiscal year select works on mobile layouts', async ({ browser }, testInfo) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 3,
    })
    const page = await context.newPage()
    const consoleTracker = createConsoleTracker(page)

    await gotoAndHydrate(page, '/counties')
    await selectOptionByLabel(page, 'Fiscal year', 'FY 2024')
    await expectQueryParam(page, 'fy', '2024')
    await expect(page.getByText('No county spending data')).toHaveCount(0)

    await capturePage(page, testInfo, 'counties-mobile-fiscal-year-select')
    await consoleTracker.expectClean()
    await context.close()
  })

  test('categories and objects collections render with searchable tables', async ({
    page,
  }, testInfo) => {
    const consoleTracker = createConsoleTracker(page)
    await gotoAndHydrate(page, '/categories')
    await expect(page.getByRole('heading', { name: 'Category Explorer' })).toBeVisible()
    if (await page.getByText('Category rankings are temporarily syncing.').isVisible().catch(() => false)) {
      await expect(page.getByText('Payment backfill in progress')).toBeVisible()
      await expect(page.getByRole('table')).toHaveCount(0)
    } else {
      await expect(page.getByRole('table')).toBeVisible()
      await expect(page.getByRole('table').getByRole('link').first()).toBeVisible()
    }

    await gotoAndHydrate(page, '/objects')
    await expect(page.getByRole('heading', { name: 'Comptroller Object Explorer' })).toBeVisible()
    await expect(page.getByRole('table')).toBeVisible()
    await page.getByRole('textbox', { name: 'Search objects' }).fill('701')
    await expectQueryParam(page, 'q', '701')
    await expect(page.getByRole('table')).toContainText('7011')

    await capturePage(page, testInfo, 'objects-collection-search')
    await consoleTracker.expectClean()
  })

  test('payees collection renders a populated table', async ({ page }, testInfo) => {
    const consoleTracker = createConsoleTracker(page)
    await gotoAndHydrate(page, '/payees')

    await expect(page.getByRole('heading', { name: 'Payee Explorer' })).toBeVisible()
    if (await page.getByText('Payee rankings are temporarily syncing.').isVisible().catch(() => false)) {
      await expect(page.getByText('Payment backfill in progress')).toBeVisible()
      await expect(page.getByRole('table')).toHaveCount(0)
    } else {
      await expect(page.getByRole('table')).toBeVisible()
      await expect(page.getByRole('table').getByRole('link').first()).toBeVisible()
    }

    await capturePage(page, testInfo, 'payees-collection')
    await consoleTracker.expectClean()
  })
})
