import { expect, test, waitForBaseUrlReady, warmUpApp } from './fixtures'
import { capturePage, createConsoleTracker, expectQueryParam, gotoAndHydrate } from './helpers'

test.describe('app shell', () => {
  test.setTimeout(120_000)

  test.beforeAll(async ({ browser, baseURL }) => {
    if (!baseURL) {
      throw new Error('app shell tests require Playwright baseURL to be configured.')
    }

    await waitForBaseUrlReady(baseURL)
    await warmUpApp(browser, baseURL)
  })

  test('homepage renders live overview sections without sparse-data fallbacks', async ({
    page,
  }, testInfo) => {
    const consoleTracker = createConsoleTracker(page)
    await gotoAndHydrate(page, '/')

    await expect(page.getByRole('heading', { name: 'Texas State Spending Overview' })).toBeVisible()
    await expect(page.getByText('Top categories')).toBeVisible()
    await expect(page.getByText('Recent transactions', { exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Agencies', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Counties', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Transactions', exact: true })).toBeVisible()

    const backfillBadge = page.getByText('Transaction-level payments are actively backfilling.')
    if (await backfillBadge.isVisible().catch(() => false)) {
      await expect(backfillBadge).toBeVisible()
      await expect(page.getByText('Syncing')).toBeVisible()
      await expect(
        page.getByText('Transaction-level payment facts are not loaded yet'),
      ).toBeVisible()
      await expect(page.getByText('Texas payment exports are ready')).toBeVisible()
      await expect(page.getByText('Transaction feed pending')).toBeVisible()
    } else {
      await expect(page.getByText('Live public finance explorer')).toBeVisible()
      await expect(page.getByText('Transaction feed pending')).toHaveCount(0)
      await expect(
        page.getByText('Transaction-level payment facts are not loaded yet'),
      ).toHaveCount(0)
    }

    await capturePage(page, testInfo, 'homepage-overview')
    await consoleTracker.expectClean()
  })

  test('hero search submits to the search page', async ({ page }, testInfo) => {
    const consoleTracker = createConsoleTracker(page)
    await gotoAndHydrate(page, '/')

    await page
      .getByRole('textbox', { name: 'Search agencies, payees, counties, and objects' })
      .fill('texas')
    await page
      .getByRole('textbox', { name: 'Search agencies, payees, counties, and objects' })
      .press('Enter')

    await expect(page).toHaveURL(/\/search(\?|$)/)
    await expectQueryParam(page, 'q', 'texas')
    await expect(page.getByRole('heading', { name: 'Search the explorer' })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByRole('main').getByText('Agencies', { exact: true })).toBeVisible()

    await capturePage(page, testInfo, 'search-results-texas')
    await consoleTracker.expectClean()
  })

  test('header search modal opens and returns object results', async ({ page }, testInfo) => {
    const consoleTracker = createConsoleTracker(page)
    await gotoAndHydrate(page, '/')

    await page.getByRole('button', { name: 'Open global search' }).click()
    await expect(page.getByRole('textbox', { name: /Start typing a Texas agency/i })).toBeVisible()

    await page.getByRole('textbox', { name: /Start typing a Texas agency/i }).fill('701')
    await expect(page.getByRole('dialog').getByText('Objects', { exact: true })).toBeVisible()
    await expect(page.getByText('7011 EMPLOYER CONTRIBUTION FICA')).toBeVisible()
    await page.getByText('7011 EMPLOYER CONTRIBUTION FICA').click()

    await expect(page).toHaveURL(/\/objects\/7011$/)
    await expect(page.getByRole('heading', { name: /Employer Contribution Fica/i })).toBeVisible({
      timeout: 15_000,
    })

    await capturePage(page, testInfo, 'object-detail-from-global-search')
    await consoleTracker.expectClean()
  })
})
