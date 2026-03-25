import { expect, test, waitForBaseUrlReady, warmUpApp } from './fixtures'
import { gotoAndHydrate } from './helpers'

async function getBackfillMeta(page: import('@playwright/test').Page, path: string) {
  const response = await page.request.get(path)
  expect(response.ok()).toBeTruthy()
  const payload = await response.json()

  return payload.meta as
    | {
        payments_backfill_active?: boolean
        payments_backfill?: {
          source_row_count: number
          source_file_count: number
          fiscal_years: number[]
          active_runtime_seconds: number | null
        }
      }
    | undefined
}

test.describe('backfill state UX', () => {
  test.setTimeout(120_000)

  test.beforeAll(async ({ browser, baseURL }) => {
    if (!baseURL) {
      throw new Error('backfill UX tests require Playwright baseURL to be configured.')
    }

    await waitForBaseUrlReady(baseURL)
    await warmUpApp(browser, baseURL)
  })

  test('homepage surfaces meaningful backfill status and fallback actions', async ({ page }) => {
    const meta = await getBackfillMeta(page, '/api/v1/overview')
    test.skip(
      !meta?.payments_backfill_active,
      'Payments backfill is not active in this environment.',
    )

    await gotoAndHydrate(page, '/')

    await expect(
      page.getByText('Transaction-level payments are actively backfilling.'),
    ).toBeVisible()
    await expect(page.getByText('Texas payment exports are ready')).toBeVisible()
    await expect(page.getByText('27,602,538')).toHaveCount(3)
    await expect(page.getByText('FY 2017–2026')).toHaveCount(3)
    await expect(page.getByText(/Current ingest/i)).toHaveCount(3)

    await page.getByRole('link', { name: 'Review data sources' }).click()
    await expect(page).toHaveURL(/\/data-sources$/)
    await expect(page.getByRole('heading', { name: 'Data Sources' })).toBeVisible()

    await gotoAndHydrate(page, '/')
    await page.getByRole('link', { name: 'Explore county distribution' }).first().click()
    await expect(page).toHaveURL(/\/counties$/)
    await expect(page.getByRole('heading', { name: 'County Spending Map' })).toBeVisible()
  })

  test('collection pages expose useful backfill fallback actions', async ({ page }) => {
    const meta = await getBackfillMeta(page, '/api/v1/transactions')
    test.skip(
      !meta?.payments_backfill_active,
      'Payments backfill is not active in this environment.',
    )

    await gotoAndHydrate(page, '/agencies')
    await expect(page.getByText('Agency leaderboard pending')).toBeVisible()
    await page.getByRole('link', { name: 'Open county map' }).click()
    await expect(page).toHaveURL(/\/counties$/)

    await gotoAndHydrate(page, '/payees')
    await expect(page.getByText('Payee leaderboard pending')).toBeVisible()
    await page.getByRole('link', { name: 'Inspect source data' }).click()
    await expect(page).toHaveURL(/\/data-sources$/)

    await gotoAndHydrate(page, '/transactions')
    await expect(page.getByText('Raw payments pending')).toBeVisible()
    await page.getByRole('link', { name: 'Why this page is empty' }).click()
    await expect(page).toHaveURL(/\/methodology$/)
    await expect(page.getByRole('heading', { name: 'Methodology' })).toBeVisible()
  })
})
