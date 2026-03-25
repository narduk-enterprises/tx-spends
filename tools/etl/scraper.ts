import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { chromium, type Page } from '@playwright/test'
import * as XLSX from 'xlsx'

const PAYMENTS_DOCUMENT_URL =
  'https://bivisual.cpa.texas.gov/CPA/opendocnotoolbar.htm?document=documents%5CTR_Master_UI.qvw'
const PAYMENTS_SHEET_COORDINATES = { x: 70, y: 196 }
const PAYMENTS_GRID_SELECTOR = '[id="167"] .QvGrid'
const FISCAL_YEAR_LIST_ID = '139'
const MONTH_LIST_ID = '131'
const MONTH_SCROLLBAR_DOWN_ARROW_INDEX = 2
const DOWNLOAD_TIMEOUT_MS = 300_000
const MAX_EXPORT_ATTEMPTS = 3
const RETRY_DELAY_MS = 4_000
const DOPPLER_CONFIG = process.env.DOPPLER_CONFIG || 'dev'
const DATA_ROOT = resolve(process.cwd(), '.data/payments')
const XLSX_DIR = join(DATA_ROOT, 'xlsx')
const CSV_DIR = join(DATA_ROOT, 'csv')
const STAGING_COLUMNS = [
  'agency_name',
  'payee_name',
  'payment_date',
  'amount',
  'object_category',
  'comptroller_object',
  'appropriation_number',
  'appropriation_year',
  'fund',
  'is_confidential',
  'fiscal_year',
  'source_file_name',
  'source_url',
  'source_loaded_at',
  'source_snapshot_date',
  'row_number',
]

type CliOptions = {
  fresh: boolean
  skipTransform: boolean
  fromCache: boolean
  fiscalYears: number[]
  months: string[]
  maxBatches?: number
  headless: boolean
}

type ParsedPaymentRow = {
  agency_name: string
  payee_name: string
  payment_date: string
  amount: string
  object_category: string
  comptroller_object: string
  appropriation_number: string
  appropriation_year: string
  fund: string
  is_confidential: string
  fiscal_year: string
  source_file_name: string
  source_url: string
  source_loaded_at: string
  source_snapshot_date: string
  row_number: string
}

type BatchExport = {
  fiscalYear: number
  monthLabel: string
  workbookPath: string
  csvPath: string
  rowCount: number
  snapshotDate: string
}

type CachedPaymentsManifest = {
  generatedAt?: string
  batches?: Array<{
    file?: string
    fiscalYear?: number
    batch?: string
    rowCount?: number
  }>
}

function parseCliArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    fresh: argv.includes('--fresh'),
    skipTransform: argv.includes('--skip-transform'),
    fromCache: argv.includes('--from-cache'),
    fiscalYears: [],
    months: [],
    headless: argv.includes('--headed') === false,
  }

  for (const arg of argv) {
    if (arg.startsWith('--years=')) {
      options.fiscalYears = arg
        .slice('--years='.length)
        .split(',')
        .map((value) => Number.parseInt(value.trim(), 10))
        .filter(Number.isFinite)
      continue
    }

    if (arg.startsWith('--months=')) {
      options.months = arg
        .slice('--months='.length)
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
      continue
    }

    if (arg.startsWith('--max-batches=')) {
      const parsed = Number.parseInt(arg.slice('--max-batches='.length), 10)
      if (Number.isFinite(parsed) && parsed > 0) {
        options.maxBatches = parsed
      }
    }
  }

  return options
}

function ensureDirectories() {
  for (const directory of [DATA_ROOT, XLSX_DIR, CSV_DIR]) {
    mkdirSync(directory, { recursive: true })
  }
}

function dedupe<T>(values: T[]): T[] {
  return [...new Set(values)]
}

function titleCase(value: string) {
  return value.replaceAll(/\b\w/g, (letter) => letter.toUpperCase())
}

function monthSlug(monthLabel: string): string {
  return monthLabel
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/(^-|-$)/g, '')
}

function parseSourceDate(value: string | undefined): string {
  if (!value) {
    return new Date().toISOString().slice(0, 10)
  }

  const match = value.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (!match) {
    return new Date().toISOString().slice(0, 10)
  }

  const [, month, day, year] = match
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

function readPaymentsManifest() {
  const manifestPath = join(DATA_ROOT, 'manifest.json')
  if (!existsSync(manifestPath)) {
    return new Map<string, { rowCount: number; snapshotDate: string }>()
  }

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as CachedPaymentsManifest
  const defaultSnapshotDate = parseSourceDate(manifest.generatedAt)

  return new Map(
    (manifest.batches || [])
      .filter((batch): batch is NonNullable<CachedPaymentsManifest['batches']>[number] & { file: string } =>
        Boolean(batch?.file),
      )
      .map((batch) => [
        batch.file,
        {
          rowCount: Number(batch.rowCount || 0),
          snapshotDate: defaultSnapshotDate,
        },
      ]),
  )
}

function formatCachedMonthLabel(batchSlug: string) {
  const [index, ...nameParts] = batchSlug.split('-')
  const monthName = titleCase(nameParts.join(' '))
  return /^\d+$/.test(index) ? `${index} ${monthName}`.trim() : titleCase(batchSlug.replaceAll('-', ' '))
}

function getCachedBatches(options: CliOptions): BatchExport[] {
  const manifestByFile = readPaymentsManifest()
  const monthFilters =
    options.months.length > 0 ? new Set(options.months.map((value) => monthSlug(value))) : null

  return readdirSync(CSV_DIR)
    .filter((fileName) => fileName.endsWith('.csv'))
    .map((fileName) => {
      const match = fileName.match(/^payments-fy(\d{4})-(.+)\.csv$/)
      if (!match) {
        return null
      }

      const fiscalYear = Number.parseInt(match[1], 10)
      const batchSlug = match[2]
      const normalizedMonth = batchSlug.toLowerCase()
      const normalizedMonthName = normalizedMonth.replace(/^\d+-/, '')

      if (options.fiscalYears.length > 0 && !options.fiscalYears.includes(fiscalYear)) {
        return null
      }

      if (
        monthFilters &&
        !monthFilters.has(normalizedMonth) &&
        !monthFilters.has(normalizedMonthName)
      ) {
        return null
      }

      const manifestEntry = manifestByFile.get(fileName)
      const workbookPath = join(XLSX_DIR, fileName.replace(/\.csv$/, '.xlsx'))

      return {
        fiscalYear,
        monthLabel: formatCachedMonthLabel(batchSlug),
        workbookPath,
        csvPath: join(CSV_DIR, fileName),
        rowCount: manifestEntry?.rowCount || 0,
        snapshotDate: manifestEntry?.snapshotDate || new Date().toISOString().slice(0, 10),
      } satisfies BatchExport
    })
    .filter((batch): batch is BatchExport => Boolean(batch))
    .sort((left, right) => left.csvPath.localeCompare(right.csvPath))
}

function parseCurrency(value: string | undefined): string {
  if (!value) return '0'
  const trimmed = value.trim()
  const negative = trimmed.startsWith('(') && trimmed.endsWith(')')
  const numeric = trimmed.replaceAll(/[$,()]/g, '')
  return negative ? `-${numeric}` : numeric
}

function parseDate(value: string | undefined): string {
  if (!value) return ''
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!match) return value
  const [, month, day, year] = match
  return `${year}-${month}-${day}`
}

function csvEscape(value: string): string {
  if (value.includes('"') || value.includes(',') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replaceAll('"', '""')}"`
  }

  return value
}

function toCsv(rows: ParsedPaymentRow[]): string {
  const header = STAGING_COLUMNS.join(',')
  const body = rows
    .map((row) =>
      STAGING_COLUMNS.map((column) => csvEscape(row[column as keyof ParsedPaymentRow])).join(','),
    )
    .join('\n')
  return body ? `${header}\n${body}\n` : `${header}\n`
}

function runDopplerPsql(command: string, input?: string | Buffer) {
  execFileSync('doppler', ['run', '--config', DOPPLER_CONFIG, '--', 'bash', '-lc', command], {
    cwd: process.cwd(),
    input,
    stdio: ['pipe', 'inherit', 'inherit'],
  })
}

function truncatePaymentsStaging() {
  runDopplerPsql('psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "TRUNCATE stg_payments_to_payee_raw"')
}

function copyCsvIntoStaging(csvPath: string) {
  const copySql = `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "\\copy stg_payments_to_payee_raw(${STAGING_COLUMNS.join(',')}) FROM STDIN WITH (FORMAT csv, HEADER true)"`
  runDopplerPsql(copySql, readFileSync(csvPath))
}

function runFactTransform() {
  const sqlPath = resolve(process.cwd(), 'tools/etl/payments-ingest.sql')
  runDopplerPsql(`psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "${sqlPath}"`)
}

function analyzePaymentsTables() {
  runDopplerPsql(
    'psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "ANALYZE agencies; ANALYZE payees; ANALYZE comptroller_objects; ANALYZE state_payment_facts;"',
  )
}

function ingestBatchIntoFacts(batch: BatchExport, skipTransform: boolean) {
  if (batch.rowCount <= 0) {
    return
  }

  if (!skipTransform) {
    truncatePaymentsStaging()
  }

  copyCsvIntoStaging(batch.csvPath)

  if (!skipTransform) {
    console.log(`  Transforming FY${batch.fiscalYear} ${batch.monthLabel} into facts...`)
    runFactTransform()
  }
}

async function openPaymentsSheet(page: Page) {
  await page.goto(PAYMENTS_DOCUMENT_URL, {
    waitUntil: 'networkidle',
    timeout: 120_000,
  })
  await page.waitForTimeout(5_000)
  await page.mouse.click(PAYMENTS_SHEET_COORDINATES.x, PAYMENTS_SHEET_COORDINATES.y)
  await page.waitForSelector(PAYMENTS_GRID_SELECTOR, { timeout: 30_000 })
  await page.waitForTimeout(2_000)
}

async function extractSnapshotDate(page: Page): Promise<string> {
  const pageText = (await page.locator('#PageContainer').textContent()) || ''
  const match = pageText.match(/Last data load date:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i)
  return parseSourceDate(match?.[1])
}

async function getFiscalYears(page: Page): Promise<number[]> {
  const titles = await page
    .locator(`[id="${FISCAL_YEAR_LIST_ID}"] [title]`)
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('title') || ''))

  return dedupe(
    titles
      .filter((title) => /^\d{4}$/.test(title))
      .map((title) => Number.parseInt(title, 10))
      .filter(Number.isFinite),
  ).sort((left, right) => right - left)
}

async function expandMonthList(page: Page) {
  const downArrow = page
    .locator(`[id="${MONTH_LIST_ID}"] .TouchScrollbar`)
    .nth(MONTH_SCROLLBAR_DOWN_ARROW_INDEX)

  for (let index = 0; index < 6; index += 1) {
    await downArrow.click()
    await page.waitForTimeout(150)
  }
}

async function getMonthTitles(page: Page): Promise<string[]> {
  const titles = await page
    .locator(`[id="${MONTH_LIST_ID}"] [title]`)
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('title') || ''))

  return dedupe(titles.filter((title) => /^\d{2}\s/.test(title)))
}

async function getMonths(page: Page): Promise<string[]> {
  await expandMonthList(page)
  return getMonthTitles(page)
}

async function ensureMonthVisible(page: Page, monthLabel: string) {
  let titles = await getMonthTitles(page)
  if (titles.includes(monthLabel)) {
    return
  }

  const downArrow = page
    .locator(`[id="${MONTH_LIST_ID}"] .TouchScrollbar`)
    .nth(MONTH_SCROLLBAR_DOWN_ARROW_INDEX)

  for (let index = 0; index < 6; index += 1) {
    await downArrow.click()
    await page.waitForTimeout(150)
    titles = await getMonthTitles(page)
    if (titles.includes(monthLabel)) {
      return
    }
  }

  throw new Error(`Month "${monthLabel}" was not visible in the Qlik listbox.`)
}

async function selectListItem(page: Page, _listId: string, title: string) {
  const locator = page.getByTitle(title, { exact: true }).first()
  await locator.click()
}

async function exportWorkbook(page: Page, workbookPath: string) {
  const downloadPromise = page.waitForEvent('download', { timeout: DOWNLOAD_TIMEOUT_MS })
  await page.click(PAYMENTS_GRID_SELECTOR, {
    button: 'right',
    position: { x: 400, y: 120 },
  })
  await page.waitForTimeout(500)
  await page.locator('li.ctx-menu-action-XL').click()
  const download = await downloadPromise
  await download.saveAs(workbookPath)
}

function parseWorkbookToRows(
  workbookPath: string,
  metadata: {
    fiscalYear: number
    snapshotDate: string
    sourceLoadedAt: string
  },
): ParsedPaymentRow[] {
  const rawFile = readFileSync(workbookPath)
  const rawPrefix = rawFile.toString('utf8', 0, Math.min(rawFile.length, 256)).trim()

  if (rawPrefix.startsWith('<result><message text="Empty response"')) {
    return []
  }

  const workbook = XLSX.readFile(workbookPath)
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<(string | undefined)[]>(firstSheet, {
    header: 1,
    raw: false,
  })

  const parsedRows: ParsedPaymentRow[] = []

  for (const [index, row] of rows.entries()) {
    if (index < 2) continue

    const fiscalYear = row[0]?.trim()
    const payee = row[1]?.trim()
    const agency = row[2]?.trim()
    const objectCategory = row[3]?.trim()
    const fund = row[4]?.trim()
    const comptrollerObject = row[5]?.trim()
    const paymentDate = row[7]?.trim()
    const amount = row[8]?.trim()

    if (!fiscalYear || !agency || !payee || !paymentDate || !amount) {
      continue
    }

    parsedRows.push({
      agency_name: agency,
      payee_name: payee,
      payment_date: parseDate(paymentDate),
      amount: parseCurrency(amount),
      object_category: objectCategory || '',
      comptroller_object: comptrollerObject || '',
      appropriation_number: '',
      appropriation_year: '',
      fund: fund || '',
      is_confidential: payee.toUpperCase() === 'CONFIDENTIAL' ? '1' : '0',
      fiscal_year: fiscalYear || String(metadata.fiscalYear),
      source_file_name: basename(workbookPath),
      source_url: PAYMENTS_DOCUMENT_URL,
      source_loaded_at: metadata.sourceLoadedAt,
      source_snapshot_date: metadata.snapshotDate,
      row_number: String(index + 1),
    })
  }

  return parsedRows
}

async function exportMonth(
  page: Page,
  fiscalYear: number,
  monthLabel: string,
): Promise<BatchExport> {
  const sourceLoadedAt = new Date().toISOString()
  const snapshotDate = await extractSnapshotDate(page)

  await selectListItem(page, FISCAL_YEAR_LIST_ID, String(fiscalYear))
  await page.waitForTimeout(2_500)
  await ensureMonthVisible(page, monthLabel)
  await selectListItem(page, MONTH_LIST_ID, monthLabel)
  await page.waitForTimeout(3_500)

  const fileStem = `payments-fy${fiscalYear}-${monthSlug(monthLabel)}`
  const workbookPath = join(XLSX_DIR, `${fileStem}.xlsx`)
  const csvPath = join(CSV_DIR, `${fileStem}.csv`)

  await exportWorkbook(page, workbookPath)

  const parsedRows = parseWorkbookToRows(workbookPath, {
    fiscalYear,
    snapshotDate,
    sourceLoadedAt,
  })

  writeFileSync(csvPath, toCsv(parsedRows), 'utf8')

  return {
    fiscalYear,
    monthLabel,
    workbookPath,
    csvPath,
    rowCount: parsedRows.length,
    snapshotDate,
  }
}

async function exportMonthWithRetry(
  browser: Awaited<ReturnType<typeof chromium.launch>>,
  fiscalYear: number,
  monthLabel: string,
) {
  let lastError: unknown

  for (let attempt = 1; attempt <= MAX_EXPORT_ATTEMPTS; attempt += 1) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })

    try {
      if (attempt > 1) {
        console.log(
          `  Retrying FY${fiscalYear} ${monthLabel} (attempt ${attempt}/${MAX_EXPORT_ATTEMPTS})...`,
        )
      }

      await openPaymentsSheet(page)
      return await exportMonth(page, fiscalYear, monthLabel)
    } catch (error) {
      lastError = error

      if (attempt < MAX_EXPORT_ATTEMPTS) {
        const message = error instanceof Error ? error.message : String(error)
        console.warn(
          `  Attempt ${attempt}/${MAX_EXPORT_ATTEMPTS} failed for FY${fiscalYear} ${monthLabel}: ${message}`,
        )
        await page.waitForTimeout(RETRY_DELAY_MS)
      }
    } finally {
      await page.close()
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

async function run() {
  ensureDirectories()
  const options = parseCliArgs(process.argv.slice(2))

  if (options.fresh) {
    console.log('Truncating payments staging table...')
    truncatePaymentsStaging()
  }

  const exports: BatchExport[] = []
  const failures: Array<{ fiscalYear: number; monthLabel: string; error: string }> = []

  if (options.fromCache) {
    const cachedBatches = getCachedBatches(options)
    const limitedBatches =
      typeof options.maxBatches === 'number'
        ? cachedBatches.slice(0, options.maxBatches)
        : cachedBatches

    if (limitedBatches.length === 0) {
      throw new Error(`No cached payment CSV files matched the requested filters in ${CSV_DIR}.`)
    }

    console.log(`Preparing to ingest ${limitedBatches.length} cached payments batch(es).`)
    console.log(`CSV cache: ${CSV_DIR}`)

    for (const [index, batch] of limitedBatches.entries()) {
      console.log(
        `[${index + 1}/${limitedBatches.length}] Ingesting cached FY${batch.fiscalYear} ${batch.monthLabel}...`,
      )

      try {
        ingestBatchIntoFacts(batch, options.skipTransform)
        exports.push(batch)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        failures.push({
          fiscalYear: batch.fiscalYear,
          monthLabel: batch.monthLabel,
          error: message,
        })
        console.error(`  Failed FY${batch.fiscalYear} ${batch.monthLabel}: ${message}`)
      }
    }
  } else {
    const browser = await chromium.launch({ headless: options.headless })
    const bootstrapPage = await browser.newPage({ viewport: { width: 1280, height: 800 } })

    try {
      await openPaymentsSheet(bootstrapPage)

      const fiscalYears =
        options.fiscalYears.length > 0 ? options.fiscalYears : await getFiscalYears(bootstrapPage)
      const availableMonths =
        options.months.length > 0 ? options.months : await getMonths(bootstrapPage)
      const batchTargets = fiscalYears.flatMap((fiscalYear) =>
        availableMonths.map((monthLabel) => ({ fiscalYear, monthLabel })),
      )

      const limitedTargets =
        typeof options.maxBatches === 'number'
          ? batchTargets.slice(0, options.maxBatches)
          : batchTargets

      console.log(`Preparing to export ${limitedTargets.length} payments batch(es).`)
      console.log(`Fiscal years: ${fiscalYears.join(', ')}`)
      console.log(`Months: ${availableMonths.join(', ')}`)

      for (const [index, target] of limitedTargets.entries()) {
        console.log(
          `[${index + 1}/${limitedTargets.length}] Exporting FY${target.fiscalYear} ${target.monthLabel}...`,
        )

        try {
          const batch = await exportMonthWithRetry(browser, target.fiscalYear, target.monthLabel)
          console.log(
            `  Saved ${batch.rowCount.toLocaleString()} rows to ${batch.csvPath} (snapshot ${batch.snapshotDate}).`,
          )

          ingestBatchIntoFacts(batch, options.skipTransform)
          exports.push(batch)
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          failures.push({
            fiscalYear: target.fiscalYear,
            monthLabel: target.monthLabel,
            error: message,
          })
          console.error(`  Failed FY${target.fiscalYear} ${target.monthLabel}: ${message}`)
        }
      }
    } finally {
      await bootstrapPage.close()
      await browser.close()
    }
  }

  if (!options.skipTransform) {
    truncatePaymentsStaging()
    console.log('Refreshing planner statistics for payment-backed tables...')
    analyzePaymentsTables()
  }

  const totalRows = exports.reduce((sum, batch) => sum + batch.rowCount, 0)
  console.log(
    `Completed ${exports.length} batch(es); staged ${totalRows.toLocaleString()} payment rows.`,
  )

  if (failures.length > 0) {
    console.error(`Failed ${failures.length} batch(es):`)
    for (const failure of failures) {
      console.error(`  FY${failure.fiscalYear} ${failure.monthLabel}: ${failure.error}`)
    }
    process.exitCode = 1
  }
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
