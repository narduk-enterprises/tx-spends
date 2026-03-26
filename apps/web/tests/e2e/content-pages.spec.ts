import { expect, test, waitForBaseUrlReady, warmUpApp } from './fixtures'
import { capturePage, createConsoleTracker, gotoAndHydrate } from './helpers'

test.describe('content pages and navigation', () => {
  test.setTimeout(120_000)

  test.beforeAll(async ({ browser, baseURL }) => {
    if (!baseURL) {
      throw new Error('content page tests require Playwright baseURL to be configured.')
    }

    await waitForBaseUrlReady(baseURL)
    await warmUpApp(browser, baseURL)
  })

  test('about, methodology, data sources, and disclaimers pages render core copy', async ({
    page,
  }, testInfo) => {
    const consoleTracker = createConsoleTracker(page)

    await gotoAndHydrate(page, '/about')
    await expect(
      page.getByRole('heading', { name: 'About Texas State Spending Explorer' }),
    ).toBeVisible()
    await expect(page.getByText('What this app is', { exact: true })).toBeVisible()
    await capturePage(page, testInfo, 'about-page')

    await gotoAndHydrate(page, '/methodology')
    await expect(page.getByRole('heading', { name: 'Methodology' })).toBeVisible()
    await expect(page.getByText('Data model', { exact: true })).toBeVisible()
    await capturePage(page, testInfo, 'methodology-page')

    await gotoAndHydrate(page, '/data-sources')
    await expect(page.getByRole('heading', { name: 'Data Sources' })).toBeVisible()
    await expect(page.getByText('Primary explorer sources', { exact: true })).toBeVisible()
    await capturePage(page, testInfo, 'data-sources-page')

    await gotoAndHydrate(page, '/disclaimers')
    await expect(page.getByRole('heading', { name: 'Disclaimers' })).toBeVisible()
    await expect(page.getByText('Scope disclaimer', { exact: true })).toBeVisible()
    await capturePage(page, testInfo, 'disclaimers-page')

    await gotoAndHydrate(page, '/data-health')
    await expect(page.getByRole('heading', { name: 'Data Health' })).toBeVisible()
    await capturePage(page, testInfo, 'data-health-page')

    await consoleTracker.expectClean()
  })

  test('desktop shell links navigate between public explorer sections', async ({
    page,
  }, testInfo) => {
    const consoleTracker = createConsoleTracker(page)

    await gotoAndHydrate(page, '/about')
    await page.getByRole('link', { name: 'Texas State Spending Explorer' }).click()
    await expect(page).toHaveURL(/\/$/)

    await page.getByRole('link', { name: 'Counties', exact: true }).click()
    await expect(page).toHaveURL(/\/counties$/)
    await expect(page.getByRole('heading', { name: 'County Spending Map' })).toBeVisible()

    await page.getByRole('link', { name: 'Data Sources', exact: true }).click()
    await expect(page).toHaveURL(/\/data-sources$/)
    await expect(page.getByRole('heading', { name: 'Data Sources' })).toBeVisible()

    await page.getByRole('link', { name: 'Methodology', exact: true }).click()
    await expect(page).toHaveURL(/\/methodology$/)
    await expect(page.getByRole('heading', { name: 'Methodology' })).toBeVisible()

    await capturePage(page, testInfo, 'desktop-shell-navigation')
    await consoleTracker.expectClean()
  })

  test('mobile navigation drawer opens and routes to methodology', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 3,
    })
    const page = await context.newPage()
    const consoleTracker = createConsoleTracker(page)

    await gotoAndHydrate(page, '/counties')
    await page.getByRole('button', { name: 'Open navigation' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Methodology' })).toBeVisible()
    await page.getByRole('link', { name: 'Methodology' }).click()

    await expect(page).toHaveURL(/\/methodology$/)
    await expect(page.getByRole('heading', { name: 'Methodology' })).toBeVisible()

    await consoleTracker.expectClean()
    await context.close()
  })
})
