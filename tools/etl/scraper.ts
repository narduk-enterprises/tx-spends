import { chromium, type Page } from 'playwright-core'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'

/**
 * Playwright scraper to download the "Payments to Payee" dataset.
 * Since the exact dashboard DOM is pending discovery (e.g., PowerBI iframes),
 * this script navigates to the portal, waits for the visualizer, and downloads the underlying data CSV.
 */

const DOWNLOAD_DIR = join(process.cwd(), '.data/downloads')
if (!existsSync(DOWNLOAD_DIR)) {
  mkdirSync(DOWNLOAD_DIR, { recursive: true })
}

async function scrapePayments() {
  console.log('Starting Comptroller Dashboard Scraper...')

  const browser = await chromium.launch({ headless: true })

  // Set up download interception
  const context = await browser.newContext({
    acceptDownloads: true,
  })

  const page = await context.newPage()

  try {
    // Navigate to the main portal
    console.log('Navigating to transparency/revenue...')
    await page.goto('https://comptroller.texas.gov/transparency/revenue/', {
      waitUntil: 'networkidle',
    })

    // Look for the "Where the Money Goes" or "Payments" link
    console.log('Looking for State Revenue and Expenditure Dashboard link...')
    // Pseudo-selectors pending manual inspection:
    // const dashboardLink = page.locator('a:has-text("State Revenue and Expenditure Dashboard")')
    // await dashboardLink.click()

    // Once in the dashboard (bivisual.cpa.texas.gov), handle PowerBI iframes
    await page.goto('https://bivisual.cpa.texas.gov/', { waitUntil: 'networkidle' })

    console.log('Waiting for PowerBI Visualizer to render...')
    // await page.waitForSelector('iframe.powerbi', { timeout: 15000 })

    // Inside the iframe, click the ellipses (More Options) and select "Export Data"
    console.log('Triggering data export...')
    /*
      const frame = page.frameLocator('iframe.powerbi')
      await frame.locator('[aria-label="More options"]').click()
      await frame.locator('button:has-text("Export data")').click()
      await frame.locator('button:has-text("Export")').click()
    */

    // Wait for the download event
    /*
    const download = await page.waitForEvent('download', { timeout: 30000 })
    const path = join(DOWNLOAD_DIR, 'stg_payments_to_payee_raw.csv')
    await download.saveAs(path)
    console.log(`Successfully downloaded Payments data to ${path}`)
    */

    console.log(
      'Scraper stub executed. Requires precise DOM selectors from physical browser inspection to finalize.',
    )
  } catch (error) {
    console.error('Error during scraping:', error)
  } finally {
    await browser.close()
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  scrapePayments()
}
