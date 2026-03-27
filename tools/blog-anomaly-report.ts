import postgres from 'postgres'
import { formatUsdBig } from '#server/utils/blog/pure'
import { formatAgencyDisplayName, toDisplayName } from '#server/utils/explorer'

type RiskSeverity = 'medium' | 'high'
type NumericLike = number | string | null

interface CliOptions {
  fiscalYear?: number
  evidenceLimit: number
  databaseUrl?: string
  json: boolean
}

interface EvidenceItem {
  label: string
  value: string
  context?: string
}

interface RiskFlag {
  id: string
  title: string
  severity: RiskSeverity
  heuristic: string
  summary: string
  evidence: EvidenceItem[]
  caveats: string[]
}

interface AnomalyReport {
  generatedAt: string
  fiscalYear: number
  previousFiscalYear: number | null
  methodology: string[]
  flags: RiskFlag[]
}

interface SinglePaymentOutlierRow {
  paymentDate: string
  agencyName: string
  payeeNameRaw: string | null
  amount: NumericLike
  objectCode: string | null
  objectTitle: string | null
  objectCategoryRaw: string | null
  sourceRowHash: string
}

interface RepeatedPaymentClusterRow {
  agencyName: string
  payeeNameRaw: string | null
  amount: NumericLike
  paymentCount: number
  totalAmount: NumericLike
  firstPaymentDate: string
  lastPaymentDate: string
  spanDays: number
  objectCode: string | null
  objectTitle: string | null
  objectCategoryRaw: string | null
}

interface ConcentrationRow {
  payeeNameRaw: string
  payeeAmount: NumericLike
  agencyCountPublic: number
  statewideTotal: NumericLike
  statewideShare: NumericLike
}

interface YoYSurgeRow {
  payeeNameRaw: string
  currentAmount: NumericLike
  previousAmount: NumericLike
  amountDelta: NumericLike
  growthMultiple: NumericLike
  currentAgencyCount: number
  previousAgencyCount: number
}

interface ConfidentialShareRow {
  agencyName: string
  totalSpendAll: NumericLike
  totalSpendPublic: NumericLike
  currentConfidentialAmount: NumericLike
  currentConfidentialShare: NumericLike
  previousConfidentialAmount: NumericLike
  previousConfidentialShare: NumericLike
  shareDelta: NumericLike
}

function printUsage(): never {
  console.log(`Usage:
  pnpm run blog:anomaly-report -- [options]

Options:
  --fiscal-year <fy>     Fiscal year to analyze (default: latest available)
  --evidence-limit <n>   Rows to keep per heuristic (default: 5)
  --database-url <url>   Override DATABASE_URL / BLOG_ANALYSIS_DATABASE_URL
  --json                 Print the report as JSON
  --help                 Show this help

Examples:
  BLOG_ANALYSIS_DATABASE_URL=postgres://narduk@127.0.0.1:5432/tx_spends pnpm run blog:anomaly-report -- --evidence-limit 3
  doppler run --config prd -- pnpm run blog:anomaly-report -- --evidence-limit 3
`)
  process.exit(0)
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    evidenceLimit: 5,
    json: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--help' || arg === '-h') {
      printUsage()
    }

    if (arg === '--json') {
      options.json = true
      continue
    }

    const next = argv[index + 1]

    if (arg === '--fiscal-year') {
      if (!next) throw new Error('Missing value for --fiscal-year.')
      options.fiscalYear = Number.parseInt(next, 10)
      if (!Number.isInteger(options.fiscalYear)) {
        throw new Error(`Invalid fiscal year: ${next}`)
      }
      index += 1
      continue
    }

    if (arg === '--evidence-limit') {
      if (!next) throw new Error('Missing value for --evidence-limit.')
      options.evidenceLimit = Number.parseInt(next, 10)
      if (!Number.isInteger(options.evidenceLimit) || options.evidenceLimit < 1) {
        throw new Error(`Invalid evidence limit: ${next}`)
      }
      index += 1
      continue
    }

    if (arg === '--database-url') {
      if (!next) throw new Error('Missing value for --database-url.')
      options.databaseUrl = next
      index += 1
      continue
    }

    throw new Error(`Unknown argument: ${arg}`)
  }

  return options
}

function envRequired(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function numericValue(value: NumericLike): number {
  if (value === null) return 0
  if (typeof value === 'number') return value
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function ratioToPct(value: NumericLike): string {
  return `${(numericValue(value) * 100).toFixed(1)}%`
}

function wholePercent(value: number): string {
  return `${value.toFixed(1)}%`
}

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Unknown date'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

function payeeDisplayName(value: string | null | undefined): string {
  if (!value) return 'Unknown payee'
  if (value.toUpperCase() === 'CONFIDENTIAL') return 'CONFIDENTIAL'
  return toDisplayName(value, value)
}

function paymentDescriptor(
  objectCode: string | null | undefined,
  objectTitle: string | null | undefined,
  objectCategoryRaw: string | null | undefined,
): string {
  if (objectCode && objectTitle) {
    return `${objectCode} · ${objectTitle}`
  }
  if (objectTitle) return objectTitle
  if (objectCategoryRaw) return objectCategoryRaw
  if (objectCode) return objectCode
  return 'Unspecified object'
}

function formatMultiple(value: NumericLike): string {
  const multiple = numericValue(value)
  if (multiple <= 0) return 'new entrant'
  return `${multiple.toFixed(1)}x`
}

function resolveDatabaseUrl(options: CliOptions): string {
  return (
    options.databaseUrl ||
    process.env.BLOG_ANALYSIS_DATABASE_URL?.trim() ||
    envRequired('DATABASE_URL')
  )
}

async function resolveFiscalYears(
  sql: postgres.Sql,
  requestedFiscalYear?: number,
): Promise<{ fiscalYear: number; previousFiscalYear: number | null }> {
  if (requestedFiscalYear !== undefined) {
    const previousRows = await sql<{ fiscalYear: number }[]>`
      select scope_fiscal_year as "fiscalYear"
      from payment_overview_rollups
      where scope_fiscal_year <> 0
        and scope_fiscal_year < ${requestedFiscalYear}
      order by scope_fiscal_year desc
      limit 1
    `

    return {
      fiscalYear: requestedFiscalYear,
      previousFiscalYear: previousRows[0]?.fiscalYear ?? null,
    }
  }

  const rows = await sql<{ fiscalYear: number }[]>`
    select scope_fiscal_year as "fiscalYear"
    from payment_overview_rollups
    where scope_fiscal_year <> 0
    order by scope_fiscal_year desc
    limit 2
  `

  const fiscalYear = rows[0]?.fiscalYear
  if (!fiscalYear) {
    throw new Error('Could not resolve a fiscal year from payment_overview_rollups.')
  }

  return {
    fiscalYear,
    previousFiscalYear: rows[1]?.fiscalYear ?? null,
  }
}

async function detectSinglePaymentOutliers(
  sql: postgres.Sql,
  fiscalYear: number,
  evidenceLimit: number,
): Promise<RiskFlag | null> {
  const [statsRows, rows] = await Promise.all([
    sql<{ p999: NumericLike; p9999: NumericLike; maxAmount: NumericLike }[]>`
      select
        percentile_cont(0.999) within group (order by amount) as "p999",
        percentile_cont(0.9999) within group (order by amount) as "p9999",
        max(amount) as "maxAmount"
      from state_payment_facts
      where fiscal_year = ${fiscalYear}
        and is_confidential = false
    `,
    sql<SinglePaymentOutlierRow[]>`
      select
        spf.payment_date as "paymentDate",
        a.agency_name as "agencyName",
        p.payee_name_raw as "payeeNameRaw",
        spf.amount,
        spf.comptroller_object_code as "objectCode",
        co.title as "objectTitle",
        spf.object_category_raw as "objectCategoryRaw",
        spf.source_row_hash as "sourceRowHash"
      from state_payment_facts spf
      join agencies a on a.id = spf.agency_id
      left join payees p on p.id = spf.payee_id
      left join comptroller_objects co on co.code = spf.comptroller_object_code
      where spf.fiscal_year = ${fiscalYear}
        and spf.is_confidential = false
      order by spf.amount desc
      limit ${evidenceLimit}
    `,
  ])

  if (rows.length === 0) return null

  const p999 = numericValue(statsRows[0]?.p999)
  const topAmount = numericValue(rows[0]?.amount)
  const p999Multiple = p999 > 0 ? topAmount / p999 : 0
  const severity: RiskSeverity = p999Multiple >= 5 || topAmount >= 100_000_000 ? 'high' : 'medium'
  const topRow = rows[0]!

  return {
    id: 'single-payment-outliers',
    title: 'Single-Payment Outliers',
    severity,
    heuristic:
      'Ranks the largest public payments and compares the top payment with the FY 99.9th percentile.',
    summary: `${formatDate(topRow.paymentDate)} recorded a ${formatUsdBig(topAmount)} public payment from ${formatAgencyDisplayName(topRow.agencyName)} to ${payeeDisplayName(topRow.payeeNameRaw)}. That is ${p999Multiple > 0 ? `${p999Multiple.toFixed(1)}x the FY ${fiscalYear} 99.9th-percentile payment size` : 'well above the normal payment distribution tail'}.`,
    evidence: rows.map((row) => ({
      label: `${formatDate(row.paymentDate)} · ${formatAgencyDisplayName(row.agencyName)}`,
      value: `${formatUsdBig(numericValue(row.amount))} to ${payeeDisplayName(row.payeeNameRaw)}`,
      context: `${paymentDescriptor(row.objectCode, row.objectTitle, row.objectCategoryRaw)} · txn ${row.sourceRowHash.slice(0, 12)}`,
    })),
    caveats: [
      'Large payments can be legitimate transfers, reimbursements, debt service, or scheduled disbursements.',
      'This flag marks statistical size outliers, not misconduct.',
    ],
  }
}

async function detectRepeatedPaymentClusters(
  sql: postgres.Sql,
  fiscalYear: number,
  evidenceLimit: number,
): Promise<RiskFlag | null> {
  const rows = await sql<RepeatedPaymentClusterRow[]>`
    select
      a.agency_name as "agencyName",
      p.payee_name_raw as "payeeNameRaw",
      spf.amount,
      count(*)::int as "paymentCount",
      sum(spf.amount)::numeric as "totalAmount",
      min(spf.payment_date) as "firstPaymentDate",
      max(spf.payment_date) as "lastPaymentDate",
      (max(spf.payment_date) - min(spf.payment_date))::int as "spanDays",
      spf.comptroller_object_code as "objectCode",
      co.title as "objectTitle",
      spf.object_category_raw as "objectCategoryRaw"
    from state_payment_facts spf
    join agencies a on a.id = spf.agency_id
    left join payees p on p.id = spf.payee_id
    left join comptroller_objects co on co.code = spf.comptroller_object_code
    where spf.fiscal_year = ${fiscalYear}
      and spf.is_confidential = false
      and spf.payee_id is not null
    group by
      a.agency_name,
      p.payee_name_raw,
      spf.amount,
      spf.comptroller_object_code,
      co.title,
      spf.object_category_raw
    having count(*) >= 5
      and sum(spf.amount) >= 1000000
    order by count(*) desc, sum(spf.amount) desc
    limit ${evidenceLimit}
  `

  if (rows.length === 0) return null

  const topRow = rows[0]!
  const severity: RiskSeverity =
    topRow.paymentCount >= 12 && topRow.spanDays <= 30 ? 'high' : 'medium'

  return {
    id: 'repeated-payment-clusters',
    title: 'Repeated Same-Amount Clusters',
    severity,
    heuristic:
      'Groups identical public payment amounts by agency and payee to surface unusually repetitive patterns.',
    summary: `${formatAgencyDisplayName(topRow.agencyName)} paid ${payeeDisplayName(topRow.payeeNameRaw)} exactly ${formatUsdBig(numericValue(topRow.amount))} ${topRow.paymentCount} times in FY ${fiscalYear}, totaling ${formatUsdBig(numericValue(topRow.totalAmount))} across ${Math.max(topRow.spanDays, 0)} days.`,
    evidence: rows.map((row) => ({
      label: `${formatAgencyDisplayName(row.agencyName)} · ${payeeDisplayName(row.payeeNameRaw)}`,
      value: `${row.paymentCount} payments at ${formatUsdBig(numericValue(row.amount))}`,
      context: `${formatUsdBig(numericValue(row.totalAmount))} total · ${formatDate(row.firstPaymentDate)} to ${formatDate(row.lastPaymentDate)} · ${paymentDescriptor(row.objectCode, row.objectTitle, row.objectCategoryRaw)}`,
    })),
    caveats: [
      'Repeated same-amount payments can reflect legitimate monthly invoices, lease schedules, or grant installments.',
      'This heuristic is best used to prioritize manual review, not to draw conclusions on its own.',
    ],
  }
}

async function detectAgencyPayeeConcentration(
  sql: postgres.Sql,
  fiscalYear: number,
  evidenceLimit: number,
): Promise<RiskFlag | null> {
  const rows = await sql<ConcentrationRow[]>`
    select
      p.payee_name_raw as "payeeNameRaw",
      ppr.total_amount_public as "payeeAmount",
      ppr.agency_count_public as "agencyCountPublic",
      por.total_spend_public as "statewideTotal",
      (ppr.total_amount_public / nullif(por.total_spend_public, 0))::numeric as "statewideShare"
    from payment_payee_rollups ppr
    join payees p on p.id = ppr.payee_id
    join payment_overview_rollups por on por.scope_fiscal_year = ppr.scope_fiscal_year
    where ppr.scope_fiscal_year = ${fiscalYear}
      and ppr.total_amount_public >= 10000000
      and ppr.agency_count_public <= 2
    order by ppr.total_amount_public desc, ppr.agency_count_public asc
    limit ${evidenceLimit}
  `

  if (rows.length === 0) return null

  const topRow = rows[0]!
  const topShare = numericValue(topRow.statewideShare)
  const topAmount = numericValue(topRow.payeeAmount)
  const severity: RiskSeverity =
    (topAmount >= 50000000 && topRow.agencyCountPublic <= 1) || topShare >= 0.02 ? 'high' : 'medium'

  return {
    id: 'agency-payee-concentration',
    title: 'Large Payees With Narrow Agency Footprints',
    severity,
    heuristic:
      'Looks for payees that received large statewide totals while showing up in only one or two agencies.',
    summary: `${payeeDisplayName(topRow.payeeNameRaw)} received ${formatUsdBig(topAmount)} in FY ${fiscalYear} while appearing in only ${topRow.agencyCountPublic} public agency${topRow.agencyCountPublic === 1 ? '' : 'ies'}, equal to ${ratioToPct(topRow.statewideShare)} of statewide public spending.`,
    evidence: rows.map((row) => ({
      label: payeeDisplayName(row.payeeNameRaw),
      value: `${formatUsdBig(numericValue(row.payeeAmount))} across ${row.agencyCountPublic} public agency${row.agencyCountPublic === 1 ? '' : 'ies'}`,
      context: `${ratioToPct(row.statewideShare)} of statewide public spend · FY ${fiscalYear} public total ${formatUsdBig(numericValue(row.statewideTotal))}`,
    })),
    caveats: [
      'A narrow agency footprint can still be legitimate for a specialized contractor or program-specific vendor.',
      'This flag is strongest when followed by manual review of contract scope, procurement path, and agency mission.',
    ],
  }
}

async function detectYoYPayeeSurges(
  sql: postgres.Sql,
  fiscalYear: number,
  previousFiscalYear: number | null,
  evidenceLimit: number,
): Promise<RiskFlag | null> {
  if (previousFiscalYear === null) return null

  const rows = await sql<YoYSurgeRow[]>`
    select
      p.payee_name_raw as "payeeNameRaw",
      cur.total_amount_public as "currentAmount",
      coalesce(prev.total_amount_public, 0)::numeric as "previousAmount",
      (cur.total_amount_public - coalesce(prev.total_amount_public, 0))::numeric as "amountDelta",
      case
        when coalesce(prev.total_amount_public, 0) = 0 then null
        else (cur.total_amount_public / nullif(prev.total_amount_public, 0))::numeric
      end as "growthMultiple",
      cur.agency_count_public as "currentAgencyCount",
      coalesce(prev.agency_count_public, 0)::int as "previousAgencyCount"
    from payment_payee_rollups cur
    join payees p on p.id = cur.payee_id
    left join payment_payee_rollups prev
      on prev.scope_fiscal_year = ${previousFiscalYear}
      and prev.payee_id = cur.payee_id
    where cur.scope_fiscal_year = ${fiscalYear}
      and cur.total_amount_public >= 5000000
      and (
        coalesce(prev.total_amount_public, 0) = 0
        or (
          (cur.total_amount_public - coalesce(prev.total_amount_public, 0)) >= 5000000
          and cur.total_amount_public >= coalesce(prev.total_amount_public, 0) * 4
        )
      )
    order by "amountDelta" desc, cur.total_amount_public desc
    limit ${evidenceLimit}
  `

  if (rows.length === 0) return null

  const topRow = rows[0]!
  const severity: RiskSeverity =
    (numericValue(topRow.previousAmount) === 0 && numericValue(topRow.currentAmount) >= 25000000) ||
    (numericValue(topRow.growthMultiple) >= 10 && numericValue(topRow.amountDelta) >= 10000000)
      ? 'high'
      : 'medium'

  return {
    id: 'yoy-payee-surges',
    title: 'Year-over-Year Payee Surges',
    severity,
    heuristic:
      'Compares payee rollups across the latest two fiscal years to find new or sharply expanded statewide relationships.',
    summary: `${payeeDisplayName(topRow.payeeNameRaw)} received ${formatUsdBig(numericValue(topRow.currentAmount))} in FY ${fiscalYear}, versus ${formatUsdBig(numericValue(topRow.previousAmount))} in FY ${previousFiscalYear}.`,
    evidence: rows.map((row) => ({
      label: payeeDisplayName(row.payeeNameRaw),
      value: `${formatUsdBig(numericValue(row.currentAmount))} current vs ${formatUsdBig(numericValue(row.previousAmount))} prior`,
      context: `${formatUsdBig(numericValue(row.amountDelta))} delta · ${formatMultiple(row.growthMultiple)} · ${row.currentAgencyCount} public agencies now vs ${row.previousAgencyCount} prior`,
    })),
    caveats: [
      'A surge can reflect a new program, rebid contract, disaster response, or accounting change.',
      'This flag identifies sharp changes in payee presence and dollars, not wrongdoing on its own.',
    ],
  }
}

async function detectConfidentialShareShifts(
  sql: postgres.Sql,
  fiscalYear: number,
  previousFiscalYear: number | null,
  evidenceLimit: number,
): Promise<RiskFlag | null> {
  if (previousFiscalYear === null) return null

  const rows = await sql<ConfidentialShareRow[]>`
    select
      a.agency_name as "agencyName",
      cur.total_spend_all as "totalSpendAll",
      cur.total_spend_public as "totalSpendPublic",
      (cur.total_spend_all - cur.total_spend_public)::numeric as "currentConfidentialAmount",
      ((cur.total_spend_all - cur.total_spend_public) / nullif(cur.total_spend_all, 0))::numeric as "currentConfidentialShare",
      coalesce((prev.total_spend_all - prev.total_spend_public), 0)::numeric as "previousConfidentialAmount",
      coalesce(((prev.total_spend_all - prev.total_spend_public) / nullif(prev.total_spend_all, 0)), 0)::numeric as "previousConfidentialShare",
      (
        ((cur.total_spend_all - cur.total_spend_public) / nullif(cur.total_spend_all, 0))
        - coalesce(((prev.total_spend_all - prev.total_spend_public) / nullif(prev.total_spend_all, 0)), 0)
      )::numeric as "shareDelta"
    from payment_agency_rollups cur
    join agencies a on a.id = cur.agency_id
    left join payment_agency_rollups prev
      on prev.scope_fiscal_year = ${previousFiscalYear}
      and prev.agency_id = cur.agency_id
    where cur.scope_fiscal_year = ${fiscalYear}
      and (cur.total_spend_all - cur.total_spend_public) >= 1000000
      and (
        ((cur.total_spend_all - cur.total_spend_public) / nullif(cur.total_spend_all, 0)) >= 0.20
        or (
          (
            ((cur.total_spend_all - cur.total_spend_public) / nullif(cur.total_spend_all, 0))
            - coalesce(((prev.total_spend_all - prev.total_spend_public) / nullif(prev.total_spend_all, 0)), 0)
          ) >= 0.10
        )
      )
    order by "shareDelta" desc, "currentConfidentialAmount" desc
    limit ${evidenceLimit}
  `

  if (rows.length === 0) return null

  const topRow = rows[0]!
  const severity: RiskSeverity =
    numericValue(topRow.currentConfidentialShare) >= 0.5 || numericValue(topRow.shareDelta) >= 0.25
      ? 'high'
      : 'medium'

  return {
    id: 'confidential-share-shifts',
    title: 'Confidential-Payment Share Shifts',
    severity,
    heuristic:
      'Compares the confidential share of agency spending across the latest two fiscal years.',
    summary: `${formatAgencyDisplayName(topRow.agencyName)} recorded ${formatUsdBig(numericValue(topRow.currentConfidentialAmount))} in confidential spending in FY ${fiscalYear}, equal to ${ratioToPct(topRow.currentConfidentialShare)} of all spending and a ${numericValue(topRow.shareDelta) >= 0 ? '+' : ''}${wholePercent(numericValue(topRow.shareDelta) * 100)} change from FY ${previousFiscalYear}.`,
    evidence: rows.map((row) => ({
      label: formatAgencyDisplayName(row.agencyName),
      value: `${formatUsdBig(numericValue(row.currentConfidentialAmount))} confidential (${ratioToPct(row.currentConfidentialShare)})`,
      context: `Prior year ${formatUsdBig(numericValue(row.previousConfidentialAmount))} (${ratioToPct(row.previousConfidentialShare)}) · FY ${fiscalYear} total ${formatUsdBig(numericValue(row.totalSpendAll))}`,
    })),
    caveats: [
      'Confidential designations can be driven by statute, privacy rules, or source-system treatment rather than agency discretion.',
      'This flag is useful for review, but not as evidence of concealment by itself.',
    ],
  }
}

function renderReport(report: AnomalyReport) {
  console.log(`Anomaly Review · FY ${report.fiscalYear}`)
  console.log(
    `Generated: ${new Date(report.generatedAt).toLocaleString('en-US', { timeZone: 'UTC', timeZoneName: 'short' })}`,
  )
  console.log(`Prior FY: ${report.previousFiscalYear ?? 'not available'}`)
  console.log('')
  console.log('Methodology')
  console.log('-----------')
  for (const note of report.methodology) {
    console.log(`- ${note}`)
  }
  console.log('')

  if (report.flags.length === 0) {
    console.log('No anomaly flags met the current thresholds.')
    return
  }

  for (const flag of report.flags) {
    console.log(`[${flag.severity.toUpperCase()}] ${flag.title}`)
    console.log(`Heuristic: ${flag.heuristic}`)
    console.log(flag.summary)
    console.log('Evidence:')
    for (const item of flag.evidence) {
      console.log(`- ${item.label}: ${item.value}${item.context ? ` (${item.context})` : ''}`)
    }
    console.log('Caveats:')
    for (const caveat of flag.caveats) {
      console.log(`- ${caveat}`)
    }
    console.log('')
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2).filter((arg) => arg !== '--'))
  const databaseUrl = resolveDatabaseUrl(options)
  const sql = postgres(databaseUrl, { prepare: false, max: 1 })

  try {
    const { fiscalYear, previousFiscalYear } = await resolveFiscalYears(sql, options.fiscalYear)
    const flags = (
      await Promise.all([
        detectSinglePaymentOutliers(sql, fiscalYear, options.evidenceLimit),
        detectRepeatedPaymentClusters(sql, fiscalYear, options.evidenceLimit),
        detectAgencyPayeeConcentration(sql, fiscalYear, options.evidenceLimit),
        detectYoYPayeeSurges(sql, fiscalYear, previousFiscalYear, options.evidenceLimit),
        detectConfidentialShareShifts(sql, fiscalYear, previousFiscalYear, options.evidenceLimit),
      ])
    ).filter((flag): flag is RiskFlag => Boolean(flag))

    const report: AnomalyReport = {
      generatedAt: new Date().toISOString(),
      fiscalYear,
      previousFiscalYear,
      methodology: [
        'This is a heuristic anomaly scan over Texas Comptroller spending data, not a fraud detector.',
        'Most sections use public, non-confidential payments only; the confidential-share section compares public vs all spending.',
        'Flags prioritize outlier size, concentration, repetition, and year-over-year change so they can feed deeper reporting.',
      ],
      flags,
    }

    if (options.json) {
      console.log(JSON.stringify(report, null, 2))
      return
    }

    renderReport(report)
  } finally {
    await sql.end()
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`blog-anomaly-report failed: ${message}`)
  process.exit(1)
})
