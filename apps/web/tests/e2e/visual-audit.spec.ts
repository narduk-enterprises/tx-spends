import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import * as Playwright from '@playwright/test'
import type { BrowserContext, Locator, Page } from '@playwright/test'
import { expect, test, waitForBaseUrlReady, warmUpApp } from './fixtures'
import { createConsoleTracker, gotoAndHydrate } from './helpers'

const SCREENSHOT_ROOT = path.resolve(process.cwd(), 'output/playwright/visual-audit')

type AuditCapture = {
  route: string
  pageScreenshot: string
  elementScreenshots: Array<{
    name: string
    path: string
  }>
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/(^-|-$)/g, '')
}

function routeDir(route: string) {
  return route === '/' ? 'home' : slugify(route.replaceAll('/', ' '))
}

async function captureLocatorScreenshot(page: Page, locator: Locator, screenshotPath: string) {
  await locator.scrollIntoViewIfNeeded()
  await page.waitForTimeout(150)
  await locator.screenshot({ path: screenshotPath })
}

async function captureNamedLocator(
  page: Page,
  locator: Locator,
  name: string,
  directory: string,
  captures: AuditCapture['elementScreenshots'],
) {
  await expect(locator).toBeVisible()
  const screenshotPath = path.join(directory, `${slugify(name)}.png`)
  await captureLocatorScreenshot(page, locator, screenshotPath)
  captures.push({ name, path: screenshotPath })
}

async function openSelectAndCapture(
  page: Page,
  label: string,
  directory: string,
  captures: AuditCapture['elementScreenshots'],
) {
  const combobox = page.getByRole('combobox', { name: label })
  await expect(combobox).toBeVisible()
  await combobox.scrollIntoViewIfNeeded()
  await combobox.click({ force: true })

  const listbox = page.getByRole('listbox').last()
  await expect(listbox).toBeVisible()
  const screenshotPath = path.join(directory, `${slugify(`${label}-overlay`)}.png`)
  await listbox.screenshot({ path: screenshotPath })
  captures.push({ name: `${label} overlay`, path: screenshotPath })

  await page.keyboard.press('Escape')
  await expect(listbox).toBeHidden()
}

async function capturePageAudit(
  page: Page,
  route: string,
  detailName: string,
  captureElements: (
    directory: string,
    captures: AuditCapture['elementScreenshots'],
  ) => Promise<void>,
) {
  await gotoAndHydrate(page, route)
  const directory = path.join(SCREENSHOT_ROOT, detailName)
  mkdirSync(directory, { recursive: true })

  const pageScreenshot = path.join(directory, 'page-full.png')
  await page.screenshot({
    path: pageScreenshot,
    fullPage: true,
  })

  const elementScreenshots: AuditCapture['elementScreenshots'] = []
  await captureElements(directory, elementScreenshots)

  return {
    route,
    pageScreenshot,
    elementScreenshots,
  } satisfies AuditCapture
}

test.describe('visual audit', () => {
  test.describe.configure({ mode: 'serial' })
  test.setTimeout(180_000)

  test.beforeAll(async ({ browser, baseURL }) => {
    if (!baseURL) {
      throw new Error('visual audit requires Playwright baseURL to be configured.')
    }

    await waitForBaseUrlReady(baseURL)
    await warmUpApp(browser, baseURL)
    mkdirSync(SCREENSHOT_ROOT, { recursive: true })
  })

  test('captures full-page and element-level screenshots for key explorer surfaces', async ({
    page,
  }) => {
    const consoleTracker = createConsoleTracker(page)
    const manifest: AuditCapture[] = []

    manifest.push(
      await capturePageAudit(page, '/', 'home', async (directory, captures) => {
        await captureNamedLocator(
          page,
          page.locator('main section').first(),
          'hero',
          directory,
          captures,
        )
        await captureNamedLocator(
          page,
          page.getByText('Filters').locator('xpath=ancestor::section[1]'),
          'filter-bar',
          directory,
          captures,
        )
        await captureNamedLocator(
          page,
          page
            .getByText('Top categories')
            .locator('xpath=ancestor::*[contains(@class,"card-base")][1]'),
          'top-categories-card',
          directory,
          captures,
        )
        await captureNamedLocator(
          page,
          page
            .getByText('Recent transactions', { exact: true })
            .locator('xpath=ancestor::*[contains(@class,"card-base")][1]'),
          'recent-transactions-card',
          directory,
          captures,
        )
        await openSelectAndCapture(page, 'Fiscal year', directory, captures)
      }),
    )

    manifest.push(
      await capturePageAudit(page, '/agencies', 'agencies', async (directory, captures) => {
        await captureNamedLocator(
          page,
          page
            .getByRole('heading', { name: 'Agency Explorer' })
            .locator('xpath=ancestor::section[1]'),
          'page-header',
          directory,
          captures,
        )
        if (await page.getByRole('table').count()) {
          await captureNamedLocator(
            page,
            page.getByRole('table').locator('xpath=ancestor::*[contains(@class,"card-base")][1]'),
            'agency-table',
            directory,
            captures,
          )
        } else {
          await captureNamedLocator(
            page,
            page.getByText('Agency rankings are temporarily syncing.').first(),
            'agency-backfill-alert',
            directory,
            captures,
          )
        }
      }),
    )

    manifest.push(
      await capturePageAudit(page, '/payees', 'payees', async (directory, captures) => {
        await captureNamedLocator(
          page,
          page
            .getByRole('heading', { name: 'Payee Explorer' })
            .locator('xpath=ancestor::section[1]'),
          'page-header',
          directory,
          captures,
        )
        if (await page.getByRole('table').count()) {
          await captureNamedLocator(
            page,
            page.getByRole('table').locator('xpath=ancestor::*[contains(@class,"card-base")][1]'),
            'payee-table',
            directory,
            captures,
          )
        } else {
          await captureNamedLocator(
            page,
            page.getByText('Payee rankings are temporarily syncing.').first(),
            'payee-backfill-alert',
            directory,
            captures,
          )
        }
      }),
    )

    manifest.push(
      await capturePageAudit(page, '/categories', 'categories', async (directory, captures) => {
        await captureNamedLocator(
          page,
          page
            .getByRole('heading', { name: 'Category Explorer' })
            .locator('xpath=ancestor::section[1]'),
          'page-header',
          directory,
          captures,
        )
        if (await page.getByRole('table').count()) {
          await captureNamedLocator(
            page,
            page.getByRole('table').locator('xpath=ancestor::*[contains(@class,"card-base")][1]'),
            'category-table',
            directory,
            captures,
          )
        } else {
          await captureNamedLocator(
            page,
            page.getByText('Category rankings are temporarily syncing.').first(),
            'category-backfill-alert',
            directory,
            captures,
          )
        }
      }),
    )

    manifest.push(
      await capturePageAudit(page, '/objects', 'objects', async (directory, captures) => {
        await captureNamedLocator(
          page,
          page
            .getByRole('heading', { name: 'Comptroller Object Explorer' })
            .locator('xpath=ancestor::section[1]'),
          'page-header',
          directory,
          captures,
        )
        await captureNamedLocator(
          page,
          page.getByRole('table').locator('xpath=ancestor::*[contains(@class,"card-base")][1]'),
          'object-table',
          directory,
          captures,
        )
      }),
    )

    manifest.push(
      await capturePageAudit(page, '/counties', 'counties', async (directory, captures) => {
        await captureNamedLocator(
          page,
          page
            .getByRole('heading', { name: 'County Spending Map' })
            .locator('xpath=ancestor::section[1]'),
          'page-header',
          directory,
          captures,
        )
        await captureNamedLocator(
          page,
          page
            .getByText('County ranking')
            .locator('xpath=ancestor::*[contains(@class,"card-base")][1]'),
          'county-ranking-card',
          directory,
          captures,
        )
        await captureNamedLocator(
          page,
          page
            .getByText('County spending landscape')
            .locator('xpath=ancestor::*[contains(@class,"card-base")][1]'),
          'county-map-card',
          directory,
          captures,
        )
        await openSelectAndCapture(page, 'Fiscal year', directory, captures)
      }),
    )

    manifest.push(
      await capturePageAudit(page, '/transactions', 'transactions', async (directory, captures) => {
        await captureNamedLocator(
          page,
          page
            .getByRole('heading', { name: 'Transaction Explorer' })
            .locator('xpath=ancestor::section[1]'),
          'page-header',
          directory,
          captures,
        )
        await captureNamedLocator(
          page,
          page.getByText('Filters').locator('xpath=ancestor::section[1]'),
          'filter-bar',
          directory,
          captures,
        )
        if (await page.getByRole('table').count()) {
          await captureNamedLocator(
            page,
            page.getByRole('table').locator('xpath=ancestor::*[contains(@class,"card-base")][1]'),
            'transactions-table',
            directory,
            captures,
          )
        } else {
          await captureNamedLocator(
            page,
            page.getByText('Transaction rows are temporarily syncing.').first(),
            'transactions-backfill-alert',
            directory,
            captures,
          )
        }
      }),
    )

    manifest.push(
      await capturePageAudit(page, '/about', 'about', async (directory, captures) => {
        await captureNamedLocator(
          page,
          page
            .getByRole('heading', { name: 'About Texas State Spending Explorer' })
            .locator('xpath=ancestor::section[1]'),
          'page-header',
          directory,
          captures,
        )
        await captureNamedLocator(
          page,
          page.getByText('What this app is', { exact: true }).locator(
            'xpath=ancestor::*[contains(@class,"card-base")][1]',
          ),
          'what-this-app-is-card',
          directory,
          captures,
        )
      }),
    )

    manifest.push(
      await capturePageAudit(page, '/methodology', 'methodology', async (directory, captures) => {
        await captureNamedLocator(
          page,
          page
            .getByRole('heading', { name: 'Methodology' })
            .locator('xpath=ancestor::section[1]'),
          'page-header',
          directory,
          captures,
        )
        await captureNamedLocator(
          page,
          page.getByText('Data model', { exact: true }).locator(
            'xpath=ancestor::*[contains(@class,"card-base")][1]',
          ),
          'data-model-card',
          directory,
          captures,
        )
      }),
    )

    manifest.push(
      await capturePageAudit(page, '/data-sources', 'data-sources', async (directory, captures) => {
        await captureNamedLocator(
          page,
          page
            .getByRole('heading', { name: 'Data Sources' })
            .locator('xpath=ancestor::section[1]'),
          'page-header',
          directory,
          captures,
        )
        await captureNamedLocator(
          page,
          page.getByText('Primary explorer sources', { exact: true }).locator(
            'xpath=ancestor::section[1]',
          ),
          'primary-sources-section',
          directory,
          captures,
        )
      }),
    )

    manifest.push(
      await capturePageAudit(page, '/disclaimers', 'disclaimers', async (directory, captures) => {
        await captureNamedLocator(
          page,
          page
            .getByRole('heading', { name: 'Disclaimers' })
            .locator('xpath=ancestor::section[1]'),
          'page-header',
          directory,
          captures,
        )
        await captureNamedLocator(
          page,
          page.getByText('Scope disclaimer', { exact: true }).locator(
            'xpath=ancestor::*[contains(@class,"card-base")][1]',
          ),
          'scope-disclaimer-card',
          directory,
          captures,
        )
      }),
    )

    await gotoAndHydrate(page, '/agencies')
    if (await page.getByRole('table').count()) {
      await page.getByRole('table').getByRole('link').first().click()
      manifest.push(
        await capturePageAudit(
          page,
          page.url().replace(new URL(page.url()).origin, ''),
          'agency-detail',
          async (directory, captures) => {
            await captureNamedLocator(
              page,
              page.getByRole('heading', { level: 1 }).locator('xpath=ancestor::section[1]'),
              'detail-header',
              directory,
              captures,
            )
            await captureNamedLocator(page, page.getByRole('tablist'), 'tabs', directory, captures)
            await captureNamedLocator(
              page,
              page
                .getByText('Top payees')
                .locator('xpath=ancestor::*[contains(@class,"card-base")][1]'),
              'top-payees-card',
              directory,
              captures,
            )
          },
        ),
      )
    } else {
      manifest.push(
        await capturePageAudit(page, '/agencies', 'agency-detail-pending', async (directory, captures) => {
          await captureNamedLocator(
            page,
            page.getByText('Agency rankings are temporarily syncing.').first(),
            'detail-backfill-alert',
            directory,
            captures,
          )
        }),
      )
    }

    await gotoAndHydrate(page, '/payees')
    if (await page.getByRole('table').count()) {
      await page.getByRole('table').getByRole('link').first().click()
      manifest.push(
        await capturePageAudit(
          page,
          page.url().replace(new URL(page.url()).origin, ''),
          'payee-detail',
          async (directory, captures) => {
            await captureNamedLocator(
              page,
              page.getByRole('heading', { level: 1 }).locator('xpath=ancestor::section[1]'),
              'detail-header',
              directory,
              captures,
            )
            await captureNamedLocator(
              page,
              page
                .getByText('Vendor match')
                .locator('xpath=ancestor::*[contains(@class,"card-base")][1]'),
              'vendor-match-card',
              directory,
              captures,
            )
          },
        ),
      )
    } else {
      manifest.push(
        await capturePageAudit(page, '/payees', 'payee-detail-pending', async (directory, captures) => {
          await captureNamedLocator(
            page,
            page.getByText('Payee rankings are temporarily syncing.').first(),
            'detail-backfill-alert',
            directory,
            captures,
          )
        }),
      )
    }

    await gotoAndHydrate(page, '/counties')
    await page.getByRole('table').getByRole('link').first().click()
    manifest.push(
      await capturePageAudit(
        page,
        page.url().replace(new URL(page.url()).origin, ''),
        'county-detail',
        async (directory, captures) => {
          await captureNamedLocator(
            page,
            page.getByRole('heading', { level: 1 }).locator('xpath=ancestor::section[1]'),
            'detail-header',
            directory,
            captures,
          )
          await captureNamedLocator(
            page,
            page.getByText('County views are an annual geography layer.').first(),
            'county-disclaimer-card',
            directory,
            captures,
          )
          const countyDetailCardCandidates = [
            {
              name: 'top-agencies-card',
              locator: page
                .getByText('Top agencies')
                .locator('xpath=ancestor::*[contains(@class,"card-base")][1]'),
            },
            {
              name: 'agency-breakdown-card',
              locator: page
                .getByText('Agency breakdown')
                .locator('xpath=ancestor::*[contains(@class,"card-base")][1]'),
            },
            {
              name: 'expenditure-types-card',
              locator: page
                .getByText('Expenditure types')
                .locator('xpath=ancestor::*[contains(@class,"card-base")][1]'),
            },
            {
              name: 'county-trend-card',
              locator: page
                .getByText('County trend')
                .locator('xpath=ancestor::*[contains(@class,"card-base")][1]'),
            },
          ]

          for (const candidate of countyDetailCardCandidates) {
            if (await candidate.locator.isVisible().catch(() => false)) {
              await captureNamedLocator(page, candidate.locator, candidate.name, directory, captures)
              break
            }
          }
        },
      ),
    )

    writeFileSync(
      path.join(SCREENSHOT_ROOT, 'manifest.json'),
      JSON.stringify(manifest, null, 2),
      'utf8',
    )

    await consoleTracker.expectClean()
  })

  test('captures mobile homepage and transaction explorer layouts', async ({ browser }) => {
    const context: BrowserContext = await browser.newContext(Playwright.devices['iPhone 13'])
    const page = await context.newPage()
    const consoleTracker = createConsoleTracker(page)
    const mobileRoot = path.join(SCREENSHOT_ROOT, 'mobile')

    mkdirSync(mobileRoot, { recursive: true })

    await gotoAndHydrate(page, '/')
    await page.screenshot({
      path: path.join(mobileRoot, 'home-full.png'),
      fullPage: true,
    })

    await gotoAndHydrate(page, '/transactions')
    await page.screenshot({
      path: path.join(mobileRoot, 'transactions-full.png'),
      fullPage: true,
    })

    const tableOverflow = await page.evaluate(() => {
      const container = document.querySelector('.overflow-x-auto')
      if (!container) {
        return { canScroll: false, clientWidth: 0, scrollWidth: 0 }
      }

      return {
        canScroll: container.scrollWidth > container.clientWidth,
        clientWidth: container.clientWidth,
        scrollWidth: container.scrollWidth,
      }
    })

    if (await page.getByText('Transaction rows are temporarily syncing.').isVisible().catch(() => false)) {
      expect(tableOverflow.canScroll).toBe(false)
    } else {
      expect(tableOverflow.canScroll).toBe(true)
    }

    writeFileSync(
      path.join(mobileRoot, 'metrics.json'),
      JSON.stringify(tableOverflow, null, 2),
      'utf8',
    )

    await consoleTracker.expectClean()
    await context.close()
  })
})
