import { expect, test, waitForBaseUrlReady, warmUpApp } from './fixtures'
import {
  capturePage,
  createConsoleTracker,
  expectQueryParam,
  gotoAndHydrate,
  selectOptionByLabel,
} from './helpers'

test.describe('filters and transactions', () => {
  test.setTimeout(120_000)

  test.beforeAll(async ({ browser, baseURL }) => {
    if (!baseURL) {
      throw new Error('filter tests require Playwright baseURL to be configured.')
    }

    await waitForBaseUrlReady(baseURL)
    await warmUpApp(browser, baseURL)
  })

  test('homepage fiscal year and confidential filters update query state', async ({
    page,
  }, testInfo) => {
    const consoleTracker = createConsoleTracker(page)
    await gotoAndHydrate(page, '/')

    await selectOptionByLabel(page, 'Fiscal year', 'FY 2024')
    await expectQueryParam(page, 'fy', '2024')

    await page.getByRole('checkbox', { name: 'Include confidential rows' }).click()
    await expectQueryParam(page, 'includeConfidential', 'true')

    await capturePage(page, testInfo, 'homepage-filters')
    await consoleTracker.expectClean()
  })

  test('transactions page keeps geography out of the UI and accepts filters', async ({
    page,
  }, testInfo) => {
    const consoleTracker = createConsoleTracker(page)
    await gotoAndHydrate(page, '/transactions')

    await expect(page.getByRole('heading', { name: 'Transaction Explorer' })).toBeVisible()
    await expect(
      page.getByText('County geography is intentionally unavailable on this page.'),
    ).toBeVisible()
    await expect(page.getByText('Search counties')).toHaveCount(0)

    await page.getByRole('textbox', { name: 'Object code' }).fill('7011')
    await page.getByRole('textbox', { name: 'Min amount' }).fill('1000')
    await page.getByRole('textbox', { name: 'Max amount' }).fill('100000')
    await page.getByRole('checkbox', { name: 'Include confidential rows' }).click()
    await expect
      .poll(async () =>
        page
          .getByRole('checkbox', { name: 'Include confidential rows' })
          .getAttribute('aria-checked'),
      )
      .toBe('true')

    await expectQueryParam(page, 'object', '7011')
    await expectQueryParam(page, 'minAmount', '1000')
    await expectQueryParam(page, 'maxAmount', '100000')
    await expectQueryParam(page, 'includeConfidential', 'true')

    await capturePage(page, testInfo, 'transactions-filters')
    await consoleTracker.expectClean()
  })

  test('category detail can deep-link into filtered transactions', async ({ page }, testInfo) => {
    const consoleTracker = createConsoleTracker(page)
    await gotoAndHydrate(page, '/categories')
    if (
      await page
        .getByText('Category rankings are temporarily syncing.')
        .isVisible()
        .catch(() => false)
    ) {
      await gotoAndHydrate(page, '/transactions?category_code=uncategorized')
      await expectQueryParam(page, 'category_code', 'uncategorized')
    } else {
      await page.getByRole('table').getByRole('link').first().click()

      const heading = await page.getByRole('heading', { level: 1 }).textContent()
      await page.getByRole('link', { name: 'View transactions' }).click()

      await expect(page).toHaveURL(/\/transactions\?category_code=/)
      if (heading) {
        await expect(page.getByText(heading, { exact: false })).toHaveCount(0)
      }
    }

    await expect(page.getByRole('heading', { name: 'Transaction Explorer' })).toBeVisible()

    await capturePage(page, testInfo, 'category-to-transactions')
    await consoleTracker.expectClean()
  })
})
