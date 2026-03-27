import postgres from 'postgres'
import { formatUsdBig } from '#server/utils/blog/pure'
import { formatAgencyDisplayName, toDisplayName } from '#server/utils/explorer'

type NumericLike = number | string | null
type RiskSeverity = 'medium' | 'high'

interface CliOptions {
  fiscalYear?: number
  evidenceLimit: number
  sectionLimit: number
  databaseUrl?: string
  json: boolean
}

interface DossierMetric {
  label: string
  value: string
  context?: string
}

interface DossierEvidence {
  label: string
  value: string
  context?: string
}

interface DossierSection {
  id: string
  title: string
  severity: RiskSeverity
  thesis: string
  whyItStandsOut: string[]
  metrics: DossierMetric[]
  evidence: DossierEvidence[]
  reviewQuestions: string[]
  caveats: string[]
}

interface DossierReport {
  generatedAt: string
  fiscalYear: number
  previousFiscalYear: number | null
  methodology: string[]
  summary: string[]
  sections: DossierSection[]
}

interface StatewideOverviewRow {
  publicTotal: NumericLike
  allTotal: NumericLike
}

interface TopPaymentRow {
  agencyId: string
  payeeId: string | null
  paymentDate: string
  agencyName: string
  payeeNameRaw: string | null
  amount: NumericLike
  objectCode: string | null
  objectTitle: string | null
  objectCategoryRaw: string | null
  sourceRowHash: string
  payeeTotal: NumericLike
  payeeAgencyCount: number | null
  statewideTotal: NumericLike
}

interface PayeeAgencyRow {
  agencyId: string
  agencyName: string
  totalAmount: NumericLike
  paymentCount: number
}

interface PaymentExampleRow {
  paymentDate: string
  agencyName: string
  amount: NumericLike
  objectCode: string | null
  objectTitle: string | null
  objectCategoryRaw: string | null
  sourceRowHash: string
}

interface NarrowPayeeRow {
  payeeId: string
  payeeNameRaw: string | null
  currentAmount: NumericLike
  previousAmount: NumericLike
  agencyCountPublic: number
  statewideTotal: NumericLike
  statewideShare: NumericLike
}

interface SurgePayeeRow {
  payeeId: string
  payeeNameRaw: string | null
  currentAmount: NumericLike
  previousAmount: NumericLike
  deltaAmount: NumericLike
  growthMultiple: NumericLike
  currentAgencyCount: number
  previousAgencyCount: number
}

interface RepeatedClusterRow {
  agencyId: string
  payeeId: string | null
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

interface ClusterPaymentRow {
  paymentDate: string
  sourceRowHash: string
}

interface AgencyPayeeTotalsRow {
  totalAmount: NumericLike
  paymentCount: number
}

interface ConfidentialShiftRow {
  agencyId: string
  agencyName: string
  totalSpendAll: NumericLike
  totalSpendPublic: NumericLike
  currentConfidentialAmount: NumericLike
  currentConfidentialShare: NumericLike
  previousConfidentialAmount: NumericLike
  previousConfidentialShare: NumericLike
  shareDelta: NumericLike
}

interface ConfidentialHistoryRow {
  fiscalYear: number
  confidentialAmount: NumericLike
  confidentialShare: NumericLike
}

function printUsage(): never {
  console.log(`Usage:
  pnpm run blog:deep-dossier -- [options]

Options:
  --fiscal-year <fy>     Fiscal year to analyze (default: latest available)
  --evidence-limit <n>   Evidence rows per section (default: 5)
  --section-limit <n>    Maximum sections in the dossier (default: 5)
  --database-url <url>   Override DATABASE_URL / BLOG_ANALYSIS_DATABASE_URL
  --json                 Print the dossier as JSON
  --help                 Show this help

Examples:
  BLOG_ANALYSIS_DATABASE_URL=postgres://narduk@127.0.0.1:5432/tx_spends pnpm run blog:deep-dossier -- --section-limit 4
  pnpm run blog:deep-dossier:local -- --fiscal-year 2026 --evidence-limit 3
`)
  process.exit(0)
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    evidenceLimit: 5,
    sectionLimit: 5,
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

    if (arg === '--section-limit') {
      if (!next) throw new Error('Missing value for --section-limit.')
      options.sectionLimit = Number.parseInt(next, 10)
      if (!Number.isInteger(options.sectionLimit) || options.sectionLimit < 1) {
        throw new Error(`Invalid section limit: ${next}`)
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

function resolveDatabaseUrl(options: CliOptions): string {
  return (
    options.databaseUrl ||
    process.env.BLOG_ANALYSIS_DATABASE_URL?.trim() ||
    envRequired('DATABASE_URL')
  )
}

function numericValue(value: NumericLike): number {
  if (value === null) return 0
  if (typeof value === 'number') return value
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
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

function pct(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`
}

function ratioToPct(value: NumericLike): string {
  return pct(numericValue(value) * 100)
}

function shareOf(part: number, whole: number): number | null {
  if (!Number.isFinite(part) || !Number.isFinite(whole) || whole <= 0) return null
  return (part / whole) * 100
}

function formatShare(part: number, whole: number, digits = 1): string {
  const value = shareOf(part, whole)
  return value === null ? 'N/A' : pct(value, digits)
}

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  if (plural === `${singular}s` && singular.endsWith('y')) {
    plural = `${singular.slice(0, -1)}ies`
  }
  return count === 1 ? singular : plural
}

function formatMultiple(value: NumericLike): string {
  const multiple = numericValue(value)
  if (multiple <= 0) return 'new entrant'
  return `${multiple.toFixed(1)}x`
}

function summarizeTrend(currentAmount: number, previousAmount: number): string {
  if (previousAmount <= 0) {
    return 'new visible relationship'
  }

  const delta = currentAmount - previousAmount
  const pctDelta = shareOf(delta, previousAmount)
  if (pctDelta === null) {
    return 'no stable prior comparison'
  }

  const direction = delta >= 0 ? 'increase' : 'decrease'
  return `${direction} of ${pct(Math.abs(pctDelta))}`
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

async function getStatewideOverview(
  sql: postgres.Sql,
  fiscalYear: number,
  previousFiscalYear: number | null,
) {
  const [currentRows, previousRows] = await Promise.all([
    sql<StatewideOverviewRow[]>`
      select
        total_spend_public as "publicTotal",
        total_spend_all as "allTotal"
      from payment_overview_rollups
      where scope_fiscal_year = ${fiscalYear}
    `,
    previousFiscalYear === null
      ? Promise.resolve([])
      : sql<StatewideOverviewRow[]>`
          select
            total_spend_public as "publicTotal",
            total_spend_all as "allTotal"
          from payment_overview_rollups
          where scope_fiscal_year = ${previousFiscalYear}
        `,
  ])

  const current = currentRows[0]
  const previous = previousRows[0]

  const currentPublic = numericValue(current?.publicTotal)
  const currentAll = numericValue(current?.allTotal)
  const previousPublic = numericValue(previous?.publicTotal)
  const previousAll = numericValue(previous?.allTotal)

  return {
    currentPublic,
    currentAll,
    currentConfidential: currentAll - currentPublic,
    previousPublic,
    previousAll,
    previousConfidential: previousAll - previousPublic,
  }
}

async function buildMassiveTransferSection(
  sql: postgres.Sql,
  fiscalYear: number,
  evidenceLimit: number,
) {
  const rows = await sql<TopPaymentRow[]>`
    with top_payment as (
      select
        spf.agency_id as "agencyId",
        spf.payee_id as "payeeId",
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
      limit 1
    )
    select
      tp.*,
      ppr.total_amount_public as "payeeTotal",
      ppr.agency_count_public as "payeeAgencyCount",
      por.total_spend_public as "statewideTotal"
    from top_payment tp
    join payment_overview_rollups por on por.scope_fiscal_year = ${fiscalYear}
    left join payment_payee_rollups ppr
      on ppr.scope_fiscal_year = ${fiscalYear}
      and ppr.payee_id = tp."payeeId"
  `

  const topRow = rows[0]
  if (!topRow) return null

  const payeeFilter =
    topRow.payeeId === null
      ? sql`spf.payee_id is null and spf.payee_name_raw = ${topRow.payeeNameRaw}`
      : sql`spf.payee_id = ${topRow.payeeId}`

  const [topPayments, topAgencies] = await Promise.all([
    sql<PaymentExampleRow[]>`
      select
        spf.payment_date as "paymentDate",
        a.agency_name as "agencyName",
        spf.amount,
        spf.comptroller_object_code as "objectCode",
        co.title as "objectTitle",
        spf.object_category_raw as "objectCategoryRaw",
        spf.source_row_hash as "sourceRowHash"
      from state_payment_facts spf
      join agencies a on a.id = spf.agency_id
      left join comptroller_objects co on co.code = spf.comptroller_object_code
      where spf.fiscal_year = ${fiscalYear}
        and spf.is_confidential = false
        and ${payeeFilter}
      order by spf.amount desc
      limit ${evidenceLimit}
    `,
    sql<PayeeAgencyRow[]>`
      select
        a.id as "agencyId",
        a.agency_name as "agencyName",
        sum(spf.amount)::numeric as "totalAmount",
        count(*)::int as "paymentCount"
      from state_payment_facts spf
      join agencies a on a.id = spf.agency_id
      where spf.fiscal_year = ${fiscalYear}
        and spf.is_confidential = false
        and ${payeeFilter}
      group by a.id, a.agency_name
      order by sum(spf.amount) desc
      limit ${evidenceLimit}
    `,
  ])

  const topAmount = numericValue(topRow.amount)
  const payeeTotal = numericValue(topRow.payeeTotal)
  const statewideTotal = numericValue(topRow.statewideTotal)
  const payeeAgencyCount = topRow.payeeAgencyCount ?? topAgencies.length
  const leadAgencyShare = numericValue(topAgencies[0]?.totalAmount)

  const section: DossierSection = {
    id: 'massive-transfer',
    title: 'Largest Single Transfer',
    severity: topAmount >= 500_000_000 ? 'high' : 'medium',
    thesis: `${formatAgencyDisplayName(topRow.agencyName)} sent ${formatUsdBig(topAmount)} to ${payeeDisplayName(topRow.payeeNameRaw)} on ${formatDate(topRow.paymentDate)}. The amount is large enough that it should be treated as a program or fund-flow event first, and then checked for whether the public labels support that interpretation.`,
    whyItStandsOut: [
      `${formatUsdBig(topAmount)} is ${formatShare(topAmount, payeeTotal)} of this payee's visible FY ${fiscalYear} receipts.`,
      `${formatUsdBig(topAmount)} is ${formatShare(topAmount, statewideTotal, 2)} of statewide public spending for the fiscal year.`,
      `${payeeDisplayName(topRow.payeeNameRaw)} appears in ${payeeAgencyCount} public ${pluralize(payeeAgencyCount, 'agency')} in the visible rollups.`,
      `${formatAgencyDisplayName(topAgencies[0]?.agencyName || topRow.agencyName)} accounts for ${formatShare(leadAgencyShare, payeeTotal)} of this payee's visible receipts.`,
    ],
    metrics: [
      {
        label: 'Largest payment',
        value: formatUsdBig(topAmount),
        context: formatDate(topRow.paymentDate),
      },
      { label: 'Payee FY total', value: formatUsdBig(payeeTotal) || '$0.00' },
      { label: 'Public agency count', value: String(payeeAgencyCount) },
      { label: 'Statewide share', value: formatShare(topAmount, statewideTotal, 2) },
    ],
    evidence: [
      ...topPayments.map((row) => ({
        label: `${formatDate(row.paymentDate)} · ${formatAgencyDisplayName(row.agencyName)}`,
        value: formatUsdBig(numericValue(row.amount)),
        context: `${paymentDescriptor(row.objectCode, row.objectTitle, row.objectCategoryRaw)} · txn ${row.sourceRowHash.slice(0, 12)}`,
      })),
      ...topAgencies.map((row) => ({
        label: `${formatAgencyDisplayName(row.agencyName)} relationship`,
        value: `${formatUsdBig(numericValue(row.totalAmount))} across ${row.paymentCount} payments`,
      })),
    ].slice(0, evidenceLimit),
    reviewQuestions: [
      'Is this payment tied to an investment sweep, treasury transfer, or other balance-sheet movement rather than an operating expense?',
      'Does the object code and agency mission support the scale and timing of the transfer?',
      'Are there public board items, annual reports, or appropriation riders that explain the same-day amount?',
    ],
    caveats: [
      'Very large transfers can be legitimate cash management, benefit, or intergovernmental activity.',
      'The payment facts show observed disbursements, not contract terms or ultimate beneficial ownership.',
    ],
  }

  return { section, payeeId: topRow.payeeId }
}

async function buildNarrowFootprintSection(
  sql: postgres.Sql,
  fiscalYear: number,
  previousFiscalYear: number | null,
  evidenceLimit: number,
  excludePayeeIds: Set<string>,
) {
  const rows = await sql<NarrowPayeeRow[]>`
    select
      ppr.payee_id as "payeeId",
      p.payee_name_raw as "payeeNameRaw",
      ppr.total_amount_public as "currentAmount",
      coalesce(prev.total_amount_public, 0)::numeric as "previousAmount",
      ppr.agency_count_public as "agencyCountPublic",
      por.total_spend_public as "statewideTotal",
      (ppr.total_amount_public / nullif(por.total_spend_public, 0))::numeric as "statewideShare"
    from payment_payee_rollups ppr
    join payees p on p.id = ppr.payee_id
    join payment_overview_rollups por on por.scope_fiscal_year = ppr.scope_fiscal_year
    left join payment_payee_rollups prev
      on prev.scope_fiscal_year = ${previousFiscalYear ?? 0}
      and prev.payee_id = ppr.payee_id
    where ppr.scope_fiscal_year = ${fiscalYear}
      and ppr.total_amount_public >= 10000000
      and ppr.agency_count_public <= 2
    order by ppr.total_amount_public desc, ppr.agency_count_public asc
    limit ${Math.max(10, excludePayeeIds.size + 5)}
  `

  const row = rows.find((candidate) => !excludePayeeIds.has(candidate.payeeId))
  if (!row) return null

  const [topAgencies, topPayments] = await Promise.all([
    sql<PayeeAgencyRow[]>`
      select
        a.id as "agencyId",
        a.agency_name as "agencyName",
        sum(spf.amount)::numeric as "totalAmount",
        count(*)::int as "paymentCount"
      from state_payment_facts spf
      join agencies a on a.id = spf.agency_id
      where spf.fiscal_year = ${fiscalYear}
        and spf.is_confidential = false
        and spf.payee_id = ${row.payeeId}
      group by a.id, a.agency_name
      order by sum(spf.amount) desc
      limit ${evidenceLimit}
    `,
    sql<PaymentExampleRow[]>`
      select
        spf.payment_date as "paymentDate",
        a.agency_name as "agencyName",
        spf.amount,
        spf.comptroller_object_code as "objectCode",
        co.title as "objectTitle",
        spf.object_category_raw as "objectCategoryRaw",
        spf.source_row_hash as "sourceRowHash"
      from state_payment_facts spf
      join agencies a on a.id = spf.agency_id
      left join comptroller_objects co on co.code = spf.comptroller_object_code
      where spf.fiscal_year = ${fiscalYear}
        and spf.is_confidential = false
        and spf.payee_id = ${row.payeeId}
      order by spf.amount desc
      limit ${evidenceLimit}
    `,
  ])

  const currentAmount = numericValue(row.currentAmount)
  const previousAmount = numericValue(row.previousAmount)
  const topAgencyAmount = numericValue(topAgencies[0]?.totalAmount)

  const section: DossierSection = {
    id: 'narrow-footprint-payee',
    title: 'Large Payee With Narrow Agency Footprint',
    severity:
      row.agencyCountPublic === 1 || numericValue(row.statewideShare) >= 0.02 ? 'high' : 'medium',
    thesis: `${payeeDisplayName(row.payeeNameRaw)} absorbed ${formatUsdBig(currentAmount)} in FY ${fiscalYear} while showing up in only ${row.agencyCountPublic} visible ${pluralize(row.agencyCountPublic, 'agency')}. That is concentrated enough to merit a program-specific review rather than a generic vendor summary.`,
    whyItStandsOut: [
      `${formatUsdBig(currentAmount)} equals ${ratioToPct(row.statewideShare)} of statewide public spending.`,
      `${formatAgencyDisplayName(topAgencies[0]?.agencyName || 'the lead agency')} contributes ${formatShare(topAgencyAmount, currentAmount)} of this payee's visible receipts.`,
      `Compared with FY ${previousFiscalYear ?? 'prior years'}, this looks like a ${summarizeTrend(currentAmount, previousAmount)}.`,
    ],
    metrics: [
      { label: 'FY total', value: formatUsdBig(currentAmount) },
      { label: 'Prior FY total', value: formatUsdBig(previousAmount) },
      { label: 'Visible agency count', value: String(row.agencyCountPublic) },
      { label: 'Statewide share', value: ratioToPct(row.statewideShare) },
    ],
    evidence: [
      ...topAgencies.map((agency) => ({
        label: formatAgencyDisplayName(agency.agencyName),
        value: `${formatUsdBig(numericValue(agency.totalAmount))} across ${agency.paymentCount} payments`,
      })),
      ...topPayments.map((payment) => ({
        label: `${formatDate(payment.paymentDate)} · ${formatAgencyDisplayName(payment.agencyName)}`,
        value: formatUsdBig(numericValue(payment.amount)),
        context: `${paymentDescriptor(payment.objectCode, payment.objectTitle, payment.objectCategoryRaw)} · txn ${payment.sourceRowHash.slice(0, 12)}`,
      })),
    ].slice(0, evidenceLimit),
    reviewQuestions: [
      'Is the payee tied to a specialized statewide program, financing structure, or managed-care model that naturally concentrates spending?',
      'Does the lead agency have contract, grant, or statutory authority that clearly explains the footprint?',
      'If this is a financial intermediary, what public documentation explains the pass-through role?',
    ],
    caveats: [
      'A narrow agency footprint can be legitimate when the payee serves a specialized statewide function.',
      'The public dataset cannot prove vendor certainty, ownership, or ultimate end recipient beyond the named payee.',
    ],
  }

  return { section, payeeId: row.payeeId }
}

async function buildSurgeSection(
  sql: postgres.Sql,
  fiscalYear: number,
  previousFiscalYear: number | null,
  evidenceLimit: number,
  excludePayeeIds: Set<string>,
) {
  if (previousFiscalYear === null) return null

  const rows = await sql<SurgePayeeRow[]>`
    select
      cur.payee_id as "payeeId",
      p.payee_name_raw as "payeeNameRaw",
      cur.total_amount_public as "currentAmount",
      coalesce(prev.total_amount_public, 0)::numeric as "previousAmount",
      (cur.total_amount_public - coalesce(prev.total_amount_public, 0))::numeric as "deltaAmount",
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
    order by "deltaAmount" desc, cur.total_amount_public desc
    limit ${Math.max(10, excludePayeeIds.size + 5)}
  `

  const row = rows.find((candidate) => !excludePayeeIds.has(candidate.payeeId))
  if (!row) return null

  const [topAgencies, topPayments] = await Promise.all([
    sql<PayeeAgencyRow[]>`
      select
        a.id as "agencyId",
        a.agency_name as "agencyName",
        sum(spf.amount)::numeric as "totalAmount",
        count(*)::int as "paymentCount"
      from state_payment_facts spf
      join agencies a on a.id = spf.agency_id
      where spf.fiscal_year = ${fiscalYear}
        and spf.is_confidential = false
        and spf.payee_id = ${row.payeeId}
      group by a.id, a.agency_name
      order by sum(spf.amount) desc
      limit ${evidenceLimit}
    `,
    sql<PaymentExampleRow[]>`
      select
        spf.payment_date as "paymentDate",
        a.agency_name as "agencyName",
        spf.amount,
        spf.comptroller_object_code as "objectCode",
        co.title as "objectTitle",
        spf.object_category_raw as "objectCategoryRaw",
        spf.source_row_hash as "sourceRowHash"
      from state_payment_facts spf
      join agencies a on a.id = spf.agency_id
      left join comptroller_objects co on co.code = spf.comptroller_object_code
      where spf.fiscal_year = ${fiscalYear}
        and spf.is_confidential = false
        and spf.payee_id = ${row.payeeId}
      order by spf.amount desc
      limit ${evidenceLimit}
    `,
  ])

  const currentAmount = numericValue(row.currentAmount)
  const previousAmount = numericValue(row.previousAmount)
  const deltaAmount = numericValue(row.deltaAmount)
  const leadAgencyAmount = numericValue(topAgencies[0]?.totalAmount)

  const section: DossierSection = {
    id: 'surging-payee',
    title: 'Year-over-Year Payee Surge',
    severity:
      (previousAmount === 0 && currentAmount >= 25000000) ||
      (numericValue(row.growthMultiple) >= 10 && deltaAmount >= 10000000)
        ? 'high'
        : 'medium',
    thesis: `${payeeDisplayName(row.payeeNameRaw)} jumped to ${formatUsdBig(currentAmount)} in FY ${fiscalYear} from ${formatUsdBig(previousAmount)} in FY ${previousFiscalYear}. That kind of change deserves a timeline review before anyone writes a narrative around it.`,
    whyItStandsOut: [
      `${formatUsdBig(deltaAmount)} more visible spending hit this payee than in FY ${previousFiscalYear}.`,
      `The visible relationship looks like ${formatMultiple(row.growthMultiple)} with ${row.currentAgencyCount} agencies now vs ${row.previousAgencyCount} prior.`,
      `${formatAgencyDisplayName(topAgencies[0]?.agencyName || 'The lead agency')} drives ${formatShare(leadAgencyAmount, currentAmount)} of the FY ${fiscalYear} total.`,
    ],
    metrics: [
      { label: `FY ${fiscalYear}`, value: formatUsdBig(currentAmount) },
      { label: `FY ${previousFiscalYear}`, value: formatUsdBig(previousAmount) },
      { label: 'Delta', value: formatUsdBig(deltaAmount) },
      { label: 'Growth multiple', value: formatMultiple(row.growthMultiple) },
    ],
    evidence: [
      ...topAgencies.map((agency) => ({
        label: formatAgencyDisplayName(agency.agencyName),
        value: `${formatUsdBig(numericValue(agency.totalAmount))} across ${agency.paymentCount} payments`,
      })),
      ...topPayments.map((payment) => ({
        label: `${formatDate(payment.paymentDate)} · ${formatAgencyDisplayName(payment.agencyName)}`,
        value: formatUsdBig(numericValue(payment.amount)),
        context: `${paymentDescriptor(payment.objectCode, payment.objectTitle, payment.objectCategoryRaw)} · txn ${payment.sourceRowHash.slice(0, 12)}`,
      })),
    ].slice(0, evidenceLimit),
    reviewQuestions: [
      'Was there a new contract, emergency appropriation, legal settlement, or pass-through program in FY 2026?',
      'Did the payee replace a prior vendor or receive a rebid award that explains the jump?',
      'Do public procurement records show a start date or authorization that lines up with the payment timing?',
    ],
    caveats: [
      'Large year-over-year jumps can be legitimate and policy-driven.',
      'This section is strongest when paired with appropriations, procurement, and board-document review.',
    ],
  }

  return { section, payeeId: row.payeeId }
}

async function buildRepeatedClusterSection(
  sql: postgres.Sql,
  fiscalYear: number,
  evidenceLimit: number,
) {
  const rows = await sql<RepeatedClusterRow[]>`
    select
      spf.agency_id as "agencyId",
      spf.payee_id as "payeeId",
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
      spf.agency_id,
      spf.payee_id,
      a.agency_name,
      p.payee_name_raw,
      spf.amount,
      spf.comptroller_object_code,
      co.title,
      spf.object_category_raw
    having count(*) >= 5
      and sum(spf.amount) >= 1000000
    order by count(*) desc, sum(spf.amount) desc
    limit 1
  `

  const row = rows[0]
  if (!row) return null

  const [clusterPayments, agencyPayeeTotals] = await Promise.all([
    sql<ClusterPaymentRow[]>`
      select
        payment_date as "paymentDate",
        source_row_hash as "sourceRowHash"
      from state_payment_facts
      where fiscal_year = ${fiscalYear}
        and is_confidential = false
        and agency_id = ${row.agencyId}
        and payee_id = ${row.payeeId}
        and amount = ${row.amount}
      order by payment_date asc
      limit ${evidenceLimit}
    `,
    sql<AgencyPayeeTotalsRow[]>`
      select
        sum(amount)::numeric as "totalAmount",
        count(*)::int as "paymentCount"
      from state_payment_facts
      where fiscal_year = ${fiscalYear}
        and is_confidential = false
        and agency_id = ${row.agencyId}
        and payee_id = ${row.payeeId}
    `,
  ])

  const totalAmount = numericValue(row.totalAmount)
  const relationshipTotal = numericValue(agencyPayeeTotals[0]?.totalAmount)

  const section: DossierSection = {
    id: 'repeated-cluster',
    title: 'Repeated Same-Amount Payment Cluster',
    severity: row.paymentCount >= 10 && row.spanDays <= 60 ? 'high' : 'medium',
    thesis: `${formatAgencyDisplayName(row.agencyName)} sent ${payeeDisplayName(row.payeeNameRaw)} the exact amount ${formatUsdBig(numericValue(row.amount))} ${row.paymentCount} times in FY ${fiscalYear}. That may be routine, but it is structured enough to deserve a schedule-level review.`,
    whyItStandsOut: [
      `The repeated amount totals ${formatUsdBig(totalAmount)} across ${Math.max(row.spanDays, 0)} days.`,
      `Those exact-amount payments make up ${formatShare(totalAmount, relationshipTotal)} of the visible ${formatAgencyDisplayName(row.agencyName)} → ${payeeDisplayName(row.payeeNameRaw)} relationship.`,
      `${paymentDescriptor(row.objectCode, row.objectTitle, row.objectCategoryRaw)} is the shared label across the cluster.`,
    ],
    metrics: [
      { label: 'Repeated amount', value: formatUsdBig(numericValue(row.amount)) },
      { label: 'Payment count', value: String(row.paymentCount) },
      { label: 'Cluster total', value: formatUsdBig(totalAmount) },
      { label: 'Observed span', value: `${Math.max(row.spanDays, 0)} days` },
    ],
    evidence: clusterPayments.map((payment) => ({
      label: `${formatDate(payment.paymentDate)} · ${formatAgencyDisplayName(row.agencyName)}`,
      value: `${formatUsdBig(numericValue(row.amount))} to ${payeeDisplayName(row.payeeNameRaw)}`,
      context: `txn ${payment.sourceRowHash.slice(0, 12)}`,
    })),
    reviewQuestions: [
      'Does this look like an installment schedule, lease cadence, or reimbursement batch with a documented payment calendar?',
      'Are there matching contract terms, grant notices, or finance schedules that specify the repeated amount?',
      'If the amount changed nearby, was that tied to an amendment, rate change, or partial cycle?',
    ],
    caveats: [
      'Exact-amount repetition often reflects normal billing schedules.',
      'This pattern is a triage signal, not proof that the payments were split or manipulated.',
    ],
  }

  return section
}

async function buildConfidentialShiftSection(
  sql: postgres.Sql,
  fiscalYear: number,
  previousFiscalYear: number | null,
  evidenceLimit: number,
) {
  if (previousFiscalYear === null) return null

  const rows = await sql<ConfidentialShiftRow[]>`
    select
      a.id as "agencyId",
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
    limit 1
  `

  const row = rows[0]
  if (!row) return null

  const [history, visiblePayees] = await Promise.all([
    sql<ConfidentialHistoryRow[]>`
      select
        scope_fiscal_year as "fiscalYear",
        (total_spend_all - total_spend_public)::numeric as "confidentialAmount",
        ((total_spend_all - total_spend_public) / nullif(total_spend_all, 0))::numeric as "confidentialShare"
      from payment_agency_rollups
      where agency_id = ${row.agencyId}
        and scope_fiscal_year between ${Math.max(previousFiscalYear - 1, 0)} and ${fiscalYear}
      order by scope_fiscal_year desc
      limit ${evidenceLimit}
    `,
    sql<PayeeAgencyRow[]>`
      select
        spf.payee_id as "agencyId",
        p.payee_name_raw as "agencyName",
        sum(spf.amount)::numeric as "totalAmount",
        count(*)::int as "paymentCount"
      from state_payment_facts spf
      left join payees p on p.id = spf.payee_id
      where spf.fiscal_year = ${fiscalYear}
        and spf.is_confidential = false
        and spf.agency_id = ${row.agencyId}
      group by spf.payee_id, p.payee_name_raw
      order by sum(spf.amount) desc
      limit ${evidenceLimit}
    `,
  ])

  const currentConfidentialAmount = numericValue(row.currentConfidentialAmount)
  const currentConfidentialShare = numericValue(row.currentConfidentialShare)
  const previousConfidentialShare = numericValue(row.previousConfidentialShare)
  const publicVisibleAmount = numericValue(row.totalSpendPublic)

  const section: DossierSection = {
    id: 'confidential-share-shift',
    title: 'Confidential Share Shift',
    severity:
      currentConfidentialShare >= 0.5 || numericValue(row.shareDelta) >= 0.25 ? 'high' : 'medium',
    thesis: `${formatAgencyDisplayName(row.agencyName)} shows ${formatUsdBig(currentConfidentialAmount)} of FY ${fiscalYear} spending in confidential rows, equal to ${ratioToPct(row.currentConfidentialShare)} of all spending. That does not prove concealment, but it materially narrows what the visible payment layer can explain.`,
    whyItStandsOut: [
      `The confidential share moved from ${ratioToPct(row.previousConfidentialShare)} in FY ${previousFiscalYear} to ${ratioToPct(row.currentConfidentialShare)} in FY ${fiscalYear}.`,
      `${formatUsdBig(publicVisibleAmount)} remains visible in public rows, which is only ${formatShare(publicVisibleAmount, numericValue(row.totalSpendAll))} of the agency's FY ${fiscalYear} total.`,
      `The visible side can still be profiled, but any conclusions about full agency mix must carry this missing-data warning.`,
    ],
    metrics: [
      { label: 'Confidential amount', value: formatUsdBig(currentConfidentialAmount) },
      { label: 'Confidential share', value: ratioToPct(row.currentConfidentialShare) },
      { label: 'Prior share', value: ratioToPct(row.previousConfidentialShare) },
      { label: 'FY total', value: formatUsdBig(numericValue(row.totalSpendAll)) },
    ],
    evidence: [
      ...history.map((item) => ({
        label: `FY ${item.fiscalYear}`,
        value: `${formatUsdBig(numericValue(item.confidentialAmount))} confidential`,
        context: ratioToPct(item.confidentialShare),
      })),
      ...visiblePayees.map((payee) => ({
        label: payeeDisplayName(payee.agencyName),
        value: `${formatUsdBig(numericValue(payee.totalAmount))} public visible`,
        context: `${payee.paymentCount} payments`,
      })),
    ].slice(0, evidenceLimit),
    reviewQuestions: [
      'Is the confidentiality share driven by statute, protected health data, student information, or source-system masking?',
      'Did the agency change systems or reporting practice between FYs?',
      'What public records outside the payment feed can explain the invisible portion of spending?',
    ],
    caveats: [
      'Confidential treatment can be mandated and legitimate.',
      'This section measures how much of the agency is hidden from the public payment layer, not whether the hidden spending is improper.',
    ],
  }

  return section
}

function buildSummary(
  report: Pick<DossierReport, 'fiscalYear' | 'sections'>,
  currentPublic: number,
) {
  const summary = [
    `FY ${report.fiscalYear} public spending in the current mirror totals ${formatUsdBig(currentPublic)}.`,
  ]

  for (const section of report.sections.slice(0, 3)) {
    summary.push(`${section.title}: ${section.thesis}`)
  }

  return summary
}

function renderReport(report: DossierReport) {
  console.log(`Deep Dossier · FY ${report.fiscalYear}`)
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
  console.log('Executive Summary')
  console.log('-----------------')
  for (const item of report.summary) {
    console.log(`- ${item}`)
  }
  console.log('')

  if (report.sections.length === 0) {
    console.log('No dossier sections met the current thresholds.')
    return
  }

  for (const section of report.sections) {
    console.log(`[${section.severity.toUpperCase()}] ${section.title}`)
    console.log(section.thesis)
    console.log('Why It Stands Out:')
    for (const line of section.whyItStandsOut) {
      console.log(`- ${line}`)
    }
    console.log('Key Metrics:')
    for (const metric of section.metrics) {
      console.log(
        `- ${metric.label}: ${metric.value}${metric.context ? ` (${metric.context})` : ''}`,
      )
    }
    console.log('Evidence:')
    for (const evidence of section.evidence) {
      console.log(
        `- ${evidence.label}: ${evidence.value}${evidence.context ? ` (${evidence.context})` : ''}`,
      )
    }
    console.log('Review Questions:')
    for (const question of section.reviewQuestions) {
      console.log(`- ${question}`)
    }
    console.log('Caveats:')
    for (const caveat of section.caveats) {
      console.log(`- ${caveat}`)
    }
    console.log('')
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2).filter((arg) => arg !== '--'))
  const databaseUrl = resolveDatabaseUrl(options)
  const sql = postgres(databaseUrl, { prepare: false, max: 4 })

  try {
    const { fiscalYear, previousFiscalYear } = await resolveFiscalYears(sql, options.fiscalYear)
    const overview = await getStatewideOverview(sql, fiscalYear, previousFiscalYear)
    const usedPayeeIds = new Set<string>()
    const sections: DossierSection[] = []

    const massiveTransfer = await buildMassiveTransferSection(
      sql,
      fiscalYear,
      options.evidenceLimit,
    )
    if (massiveTransfer) {
      sections.push(massiveTransfer.section)
      if (massiveTransfer.payeeId) usedPayeeIds.add(massiveTransfer.payeeId)
    }

    const narrowFootprint = await buildNarrowFootprintSection(
      sql,
      fiscalYear,
      previousFiscalYear,
      options.evidenceLimit,
      usedPayeeIds,
    )
    if (narrowFootprint) {
      sections.push(narrowFootprint.section)
      usedPayeeIds.add(narrowFootprint.payeeId)
    }

    const surge = await buildSurgeSection(
      sql,
      fiscalYear,
      previousFiscalYear,
      options.evidenceLimit,
      usedPayeeIds,
    )
    if (surge) {
      sections.push(surge.section)
      usedPayeeIds.add(surge.payeeId)
    }

    const repeatedCluster = await buildRepeatedClusterSection(
      sql,
      fiscalYear,
      options.evidenceLimit,
    )
    if (repeatedCluster) {
      sections.push(repeatedCluster)
    }

    const confidentialShift = await buildConfidentialShiftSection(
      sql,
      fiscalYear,
      previousFiscalYear,
      options.evidenceLimit,
    )
    if (confidentialShift) {
      sections.push(confidentialShift)
    }

    const limitedSections = sections.slice(0, options.sectionLimit)
    const report: DossierReport = {
      generatedAt: new Date().toISOString(),
      fiscalYear,
      previousFiscalYear,
      methodology: [
        'This dossier is a local, analyst-oriented heuristic review over Texas Comptroller spending data. It is not a fraud detector.',
        'Payment sections use public, non-confidential payment facts unless the section explicitly discusses confidential-share shifts.',
        'The tool is designed to surface suspicious patterns, concentration, and abrupt changes so they can be checked against procurement, appropriations, and agency documentation.',
      ],
      summary: buildSummary(
        {
          fiscalYear,
          sections: limitedSections,
        },
        overview.currentPublic,
      ),
      sections: limitedSections,
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
  console.error(`blog-deep-dossier failed: ${message}`)
  process.exit(1)
})
