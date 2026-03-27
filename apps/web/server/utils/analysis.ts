import { and, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import * as schema from '#server/database/schema'
import {
  countyCategoryCodeSql,
  countyCategoryTitleSql,
  formatAgencyDisplayName,
  formatCategoryDisplayName,
  formatCountyDisplayName,
  paymentCategoryCodeSql,
  paymentCategoryTitleSql,
  toDisplayName,
} from '#server/utils/explorer'
import type {
  AnalysisBreakdown,
  AnalysisDataset,
  AnalysisQuery,
  AnalysisRelationship,
  AnalysisSubject,
} from '#server/utils/analysis-query'
import {
  buildTrendSummary,
  computeCagr,
  computeConcentrationMetrics,
  computePercentChange,
  computeVolatility,
  numberValue,
  type TimeSeriesPoint,
} from '#server/utils/analysis-metrics'

type AppDb = PostgresJsDatabase<typeof schema>
type NumericLike = number | string | null

export interface AnalysisMeta {
  currency: 'USD'
  dataset: AnalysisDataset
  subject: AnalysisSubject
  subject_label: string
  breakdown?: AnalysisBreakdown
  relationship?: AnalysisRelationship
  methodology: string[]
  warnings: string[]
  drill_path: 'transactions' | 'county_annual'
  comparison_years?: {
    current: number
    prior: number
  }
}

export interface TrendSeries {
  id: string
  label: string
  points: TimeSeriesPoint[]
  latest_amount: number
  yoy_delta: number | null
  yoy_pct: number | null
  cagr: number | null
  volatility: number | null
  summary: string
}

export interface TrendAnalysisData {
  summary: string
  series: TrendSeries[]
}

export interface ConcentrationItem {
  id: string
  label: string
  amount: number
  share: number
  cumulative_share: number
}

export interface ConcentrationAnalysisData {
  summary: string
  total_amount: number
  top_5_share: number
  top_10_share: number
  top_25_share: number
  hhi: number
  interpretation: string
  items: ConcentrationItem[]
}

export interface OutlierItem {
  id: string
  label: string
  current_amount: number
  prior_amount: number
  delta_amount: number
  pct_change: number | null
  reason: string
}

export interface OutlierAnalysisData {
  summary: string
  current_fiscal_year: number
  prior_fiscal_year: number
  increases: OutlierItem[]
  decreases: OutlierItem[]
}

export interface RelationshipEdge {
  left_id: string
  left_label: string
  right_id: string
  right_label: string
  amount: number
  share_of_left: number
  share_of_right: number
}

export interface RelationshipAnalysisData {
  summary: string
  edges: RelationshipEdge[]
}

interface AnalysisContext {
  dataset: AnalysisDataset
  subject: AnalysisSubject
  breakdown: AnalysisBreakdown
  relationship: AnalysisRelationship
  includeConfidential: boolean
  fiscalYear?: number
  fiscalYearStart?: number
  fiscalYearEnd?: number
  agencyId?: string
  payeeId?: string
  countyId?: string
  limit: number
  compareLimit: number
  minParentAmount: number
  minChangeAmount: number
  minChangePct: number
}

interface AmountRow {
  id: string | null
  label: string | null
  amount: NumericLike
}

interface SeriesRow {
  id: string | null
  label: string | null
  fiscal_year: number
  amount: NumericLike
}

function toNumber(value: NumericLike) {
  return numberValue(value)
}

function formatCurrency(value: number) {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  })
}

function defaultBreakdown(dataset: AnalysisDataset, subject: AnalysisSubject): AnalysisBreakdown {
  if (dataset === 'counties') {
    if (subject === 'county') return 'agency'
    return 'county'
  }

  if (subject === 'agency') return 'payee'
  if (subject === 'payee') return 'agency'
  return 'agency'
}

function buildWarnings(context: AnalysisContext) {
  const warnings = [
    'This workspace highlights patterns in published public data. It does not prove fraud, waste, or improper intent.',
  ]

  if (context.dataset === 'payments') {
    warnings.push(
      'Payment analysis comes from state payment facts. County geography is intentionally unavailable at the transaction level.',
    )
  }

  if (context.dataset === 'counties') {
    warnings.push(
      'County analysis comes from annual county expenditure facts. It must not be read as geocoded payment rows.',
    )
  }

  if (!context.includeConfidential) {
    warnings.push('Confidential or masked payment rows are excluded unless explicitly requested.')
  }

  return warnings
}

function buildMethodology(context: AnalysisContext) {
  if (context.dataset === 'payments') {
    return [
      'Uses the transactional state payment fact table and payment rollups for statewide comparisons.',
      'Observed relationships reflect payment co-occurrence only. They do not imply contracts, ownership, or hidden linkages.',
      'Vendor enrichment is excluded from these calculations unless a page explicitly says otherwise.',
    ]
  }

  return [
    'Uses the annual county expenditure fact table only.',
    'County outputs stay inside annual county aggregates and never attach county geography to payment rows.',
    'County expenditure analysis reflects landed annual totals, not transaction-level movement.',
  ]
}

function ensureSupported(context: AnalysisContext) {
  if (context.subject === 'agency' && !context.agencyId) {
    throw createError({ statusCode: 400, message: 'agency_id is required when subject=agency.' })
  }

  if (context.subject === 'payee' && !context.payeeId) {
    throw createError({ statusCode: 400, message: 'payee_id is required when subject=payee.' })
  }

  if (context.subject === 'county' && !context.countyId) {
    throw createError({ statusCode: 400, message: 'county_id is required when subject=county.' })
  }

  if (context.dataset === 'counties' && context.subject === 'payee') {
    throw createError({
      statusCode: 400,
      message: 'County analysis does not support payee subjects.',
    })
  }

  if (context.dataset === 'payments' && context.subject === 'county') {
    throw createError({
      statusCode: 400,
      message:
        'Payment analysis cannot use county as a subject because payment rows do not carry county geography.',
    })
  }
}

function resolveContext(
  query: AnalysisQuery,
  mode: 'trends' | 'concentration' | 'outliers' | 'relationships',
): AnalysisContext {
  const context: AnalysisContext = {
    dataset: query.dataset,
    subject: query.subject,
    breakdown: query.breakdown || defaultBreakdown(query.dataset, query.subject),
    relationship: query.relationship,
    includeConfidential: query.include_confidential,
    fiscalYear: query.fiscal_year,
    fiscalYearStart: query.fiscal_year_start,
    fiscalYearEnd: query.fiscal_year_end,
    agencyId: query.agency_id,
    payeeId: query.payee_id,
    countyId: query.county_id,
    limit: query.limit,
    compareLimit: query.compare_limit,
    minParentAmount: query.min_parent_amount,
    minChangeAmount: query.min_change_amount,
    minChangePct: query.min_change_pct,
  }

  ensureSupported(context)

  if (mode === 'relationships' && context.dataset !== 'payments') {
    throw createError({
      statusCode: 400,
      message: 'Relationship analysis is only available on payment facts.',
    })
  }

  if (context.dataset === 'counties' && context.breakdown === 'payee') {
    throw createError({ statusCode: 400, message: 'County analysis cannot break down by payee.' })
  }

  if (context.dataset === 'counties' && context.breakdown === 'object') {
    throw createError({ statusCode: 400, message: 'County analysis cannot break down by object.' })
  }

  return context
}

async function resolvePaymentYears(db: AppDb, context: AnalysisContext) {
  if (context.fiscalYear) {
    return { current: context.fiscalYear, prior: context.fiscalYear - 1 }
  }

  const conditions = [sql`${schema.paymentOverviewRollups.scopeFiscalYear} <> 0`]
  if (context.fiscalYearStart) {
    conditions.push(gte(schema.paymentOverviewRollups.scopeFiscalYear, context.fiscalYearStart))
  }
  if (context.fiscalYearEnd) {
    conditions.push(lte(schema.paymentOverviewRollups.scopeFiscalYear, context.fiscalYearEnd))
  }

  const rows = await db
    .select({ fiscal_year: schema.paymentOverviewRollups.scopeFiscalYear })
    .from(schema.paymentOverviewRollups)
    .where(and(...conditions))
    .orderBy(desc(schema.paymentOverviewRollups.scopeFiscalYear))
    .limit(2)

  return {
    current: rows[0]?.fiscal_year,
    prior: rows[1]?.fiscal_year,
  }
}

async function resolveCountyYears(db: AppDb, context: AnalysisContext) {
  if (context.fiscalYear) {
    return { current: context.fiscalYear, prior: context.fiscalYear - 1 }
  }

  const conditions = []
  if (context.fiscalYearStart) {
    conditions.push(gte(schema.countyExpenditureFacts.fiscalYear, context.fiscalYearStart))
  }
  if (context.fiscalYearEnd) {
    conditions.push(lte(schema.countyExpenditureFacts.fiscalYear, context.fiscalYearEnd))
  }

  const rows = await db
    .selectDistinct({ fiscal_year: schema.countyExpenditureFacts.fiscalYear })
    .from(schema.countyExpenditureFacts)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(schema.countyExpenditureFacts.fiscalYear))
    .limit(2)

  return {
    current: rows[0]?.fiscal_year,
    prior: rows[1]?.fiscal_year,
  }
}

async function resolveSubjectLabel(db: AppDb, context: AnalysisContext) {
  if (context.subject === 'system') {
    return context.dataset === 'payments'
      ? 'Statewide payment system'
      : 'Statewide county expenditure system'
  }

  if (context.subject === 'agency' && context.agencyId) {
    const [row] = await db
      .select({ name: schema.agencies.agencyName })
      .from(schema.agencies)
      .where(eq(schema.agencies.id, context.agencyId))
      .limit(1)
    return formatAgencyDisplayName(row?.name, 'Selected agency')
  }

  if (context.subject === 'payee' && context.payeeId) {
    const [row] = await db
      .select({ name: schema.payees.payeeNameRaw })
      .from(schema.payees)
      .where(eq(schema.payees.id, context.payeeId))
      .limit(1)
    return toDisplayName(row?.name, 'Selected payee')
  }

  if (context.subject === 'county' && context.countyId) {
    const [row] = await db
      .select({ name: schema.geographiesCounties.countyName })
      .from(schema.geographiesCounties)
      .where(eq(schema.geographiesCounties.id, context.countyId))
      .limit(1)
    return formatCountyDisplayName(row?.name, 'Selected county')
  }

  return 'Selected slice'
}

function finalizeSeries(rows: SeriesRow[], compareLimit: number) {
  const grouped = new Map<string, { id: string; label: string; points: TimeSeriesPoint[] }>()

  for (const row of rows) {
    if (!row.id || !row.label) continue
    const key = row.id
    const entry = grouped.get(key) || {
      id: key,
      label: row.label,
      points: [],
    }
    entry.points.push({
      fiscal_year: row.fiscal_year,
      amount: toNumber(row.amount),
    })
    grouped.set(key, entry)
  }

  return [...grouped.values()]
    .map((entry) => {
      const sortedPoints = [...entry.points].sort(
        (left, right) => left.fiscal_year - right.fiscal_year,
      )
      const latest = sortedPoints.at(-1)
      const prior = sortedPoints.at(-2)
      const latestAmount = latest?.amount || 0
      const priorAmount = prior?.amount || 0

      return {
        id: entry.id,
        label: entry.label,
        points: sortedPoints,
        latest_amount: latestAmount,
        yoy_delta: prior ? latestAmount - priorAmount : null,
        yoy_pct: prior ? computePercentChange(latestAmount, priorAmount) : null,
        cagr: computeCagr(sortedPoints),
        volatility: computeVolatility(sortedPoints),
        summary: buildTrendSummary(entry.label, sortedPoints),
      } satisfies TrendSeries
    })
    .sort((left, right) => right.latest_amount - left.latest_amount)
    .slice(0, compareLimit)
}

async function getPaymentSystemTrendRows(
  db: AppDb,
  context: AnalysisContext,
): Promise<SeriesRow[]> {
  const { current } = await resolvePaymentYears(db, context)
  if (!current) return []

  const rangeConditions = [sql`${schema.paymentOverviewRollups.scopeFiscalYear} <> 0`]

  if (context.fiscalYearStart) {
    rangeConditions.push(
      gte(schema.paymentOverviewRollups.scopeFiscalYear, context.fiscalYearStart),
    )
  }
  if (context.fiscalYearEnd) {
    rangeConditions.push(lte(schema.paymentOverviewRollups.scopeFiscalYear, context.fiscalYearEnd))
  }

  const amountColumn = context.includeConfidential
    ? {
        agency: schema.paymentAgencyRollups.totalSpendAll,
        payee: schema.paymentPayeeRollups.totalAmountAll,
        category: schema.paymentCategoryRollups.totalAmountAll,
        object: schema.paymentObjectRollups.totalAmountAll,
      }
    : {
        agency: schema.paymentAgencyRollups.totalSpendPublic,
        payee: schema.paymentPayeeRollups.totalAmountPublic,
        category: schema.paymentCategoryRollups.totalAmountPublic,
        object: schema.paymentObjectRollups.totalAmountPublic,
      }

  if (context.breakdown === 'payee') {
    const top = await db
      .select({
        id: schema.paymentPayeeRollups.payeeId,
        label: schema.payees.payeeNameRaw,
      })
      .from(schema.paymentPayeeRollups)
      .innerJoin(schema.payees, eq(schema.paymentPayeeRollups.payeeId, schema.payees.id))
      .where(eq(schema.paymentPayeeRollups.scopeFiscalYear, current))
      .orderBy(desc(amountColumn.payee))
      .limit(context.compareLimit)

    const ids = top.map((row) => row.id)
    if (ids.length === 0) return []

    return db
      .select({
        id: schema.paymentPayeeRollups.payeeId,
        label: schema.payees.payeeNameRaw,
        fiscal_year: schema.paymentPayeeRollups.scopeFiscalYear,
        amount: amountColumn.payee,
      })
      .from(schema.paymentPayeeRollups)
      .innerJoin(schema.payees, eq(schema.paymentPayeeRollups.payeeId, schema.payees.id))
      .where(and(inArray(schema.paymentPayeeRollups.payeeId, ids), ...rangeConditions))
      .orderBy(schema.paymentPayeeRollups.payeeId, schema.paymentPayeeRollups.scopeFiscalYear)
  }

  if (context.breakdown === 'category') {
    const top = await db
      .select({
        id: schema.paymentCategoryRollups.categoryCode,
        label: schema.paymentCategoryRollups.categoryTitle,
      })
      .from(schema.paymentCategoryRollups)
      .where(eq(schema.paymentCategoryRollups.scopeFiscalYear, current))
      .orderBy(desc(amountColumn.category))
      .limit(context.compareLimit)

    const ids = top.map((row) => row.id)
    if (ids.length === 0) return []

    return db
      .select({
        id: schema.paymentCategoryRollups.categoryCode,
        label: schema.paymentCategoryRollups.categoryTitle,
        fiscal_year: schema.paymentCategoryRollups.scopeFiscalYear,
        amount: amountColumn.category,
      })
      .from(schema.paymentCategoryRollups)
      .where(and(inArray(schema.paymentCategoryRollups.categoryCode, ids), ...rangeConditions))
      .orderBy(
        schema.paymentCategoryRollups.categoryCode,
        schema.paymentCategoryRollups.scopeFiscalYear,
      )
  }

  if (context.breakdown === 'object') {
    const top = await db
      .select({
        id: schema.paymentObjectRollups.objectCode,
        label: schema.paymentObjectRollups.objectTitle,
      })
      .from(schema.paymentObjectRollups)
      .where(eq(schema.paymentObjectRollups.scopeFiscalYear, current))
      .orderBy(desc(amountColumn.object))
      .limit(context.compareLimit)

    const ids = top.map((row) => row.id)
    if (ids.length === 0) return []

    return db
      .select({
        id: schema.paymentObjectRollups.objectCode,
        label: schema.paymentObjectRollups.objectTitle,
        fiscal_year: schema.paymentObjectRollups.scopeFiscalYear,
        amount: amountColumn.object,
      })
      .from(schema.paymentObjectRollups)
      .where(and(inArray(schema.paymentObjectRollups.objectCode, ids), ...rangeConditions))
      .orderBy(schema.paymentObjectRollups.objectCode, schema.paymentObjectRollups.scopeFiscalYear)
  }

  const top = await db
    .select({
      id: schema.paymentAgencyRollups.agencyId,
      label: schema.agencies.agencyName,
    })
    .from(schema.paymentAgencyRollups)
    .innerJoin(schema.agencies, eq(schema.paymentAgencyRollups.agencyId, schema.agencies.id))
    .where(eq(schema.paymentAgencyRollups.scopeFiscalYear, current))
    .orderBy(desc(amountColumn.agency))
    .limit(context.compareLimit)

  const ids = top.map((row) => row.id)
  if (ids.length === 0) return []

  return db
    .select({
      id: schema.paymentAgencyRollups.agencyId,
      label: schema.agencies.agencyName,
      fiscal_year: schema.paymentAgencyRollups.scopeFiscalYear,
      amount: amountColumn.agency,
    })
    .from(schema.paymentAgencyRollups)
    .innerJoin(schema.agencies, eq(schema.paymentAgencyRollups.agencyId, schema.agencies.id))
    .where(and(inArray(schema.paymentAgencyRollups.agencyId, ids), ...rangeConditions))
    .orderBy(schema.paymentAgencyRollups.agencyId, schema.paymentAgencyRollups.scopeFiscalYear)
}

async function getCountySystemTrendRows(db: AppDb, context: AnalysisContext): Promise<SeriesRow[]> {
  const { current } = await resolveCountyYears(db, context)
  if (!current) return []

  const fiscalConditions = []
  if (context.fiscalYearStart) {
    fiscalConditions.push(gte(schema.countyExpenditureFacts.fiscalYear, context.fiscalYearStart))
  }
  if (context.fiscalYearEnd) {
    fiscalConditions.push(lte(schema.countyExpenditureFacts.fiscalYear, context.fiscalYearEnd))
  }

  if (context.breakdown === 'agency') {
    const agencyKey = sql<string>`coalesce(${schema.countyExpenditureFacts.agencyId}::text, ${schema.countyExpenditureFacts.agencyNameRaw})`
    const agencyLabel = sql<string>`coalesce(${schema.agencies.agencyName}, ${schema.countyExpenditureFacts.agencyNameRaw})`
    const top = await db
      .select({
        id: agencyKey,
        label: agencyLabel,
        amount: sql<string>`sum(${schema.countyExpenditureFacts.amount})`,
      })
      .from(schema.countyExpenditureFacts)
      .leftJoin(schema.agencies, eq(schema.countyExpenditureFacts.agencyId, schema.agencies.id))
      .where(eq(schema.countyExpenditureFacts.fiscalYear, current))
      .groupBy(agencyKey, agencyLabel)
      .orderBy(desc(sql`sum(${schema.countyExpenditureFacts.amount})`))
      .limit(context.compareLimit)

    const ids = top.map((row) => row.id).filter((value): value is string => Boolean(value))
    if (ids.length === 0) return []

    return db
      .select({
        id: agencyKey,
        label: agencyLabel,
        fiscal_year: schema.countyExpenditureFacts.fiscalYear,
        amount: sql<string>`sum(${schema.countyExpenditureFacts.amount})`,
      })
      .from(schema.countyExpenditureFacts)
      .leftJoin(schema.agencies, eq(schema.countyExpenditureFacts.agencyId, schema.agencies.id))
      .where(
        and(
          inArray(agencyKey, ids),
          ...(fiscalConditions.length ? [and(...fiscalConditions)] : []),
        ),
      )
      .groupBy(agencyKey, agencyLabel, schema.countyExpenditureFacts.fiscalYear)
      .orderBy(agencyKey, schema.countyExpenditureFacts.fiscalYear)
  }

  const countyLabel = sql<string>`coalesce(${schema.geographiesCounties.countyName}, 'Unknown')`
  const top = await db
    .select({
      id: schema.countyExpenditureFacts.countyId,
      label: countyLabel,
      amount: sql<string>`sum(${schema.countyExpenditureFacts.amount})`,
    })
    .from(schema.countyExpenditureFacts)
    .leftJoin(
      schema.geographiesCounties,
      eq(schema.countyExpenditureFacts.countyId, schema.geographiesCounties.id),
    )
    .where(eq(schema.countyExpenditureFacts.fiscalYear, current))
    .groupBy(schema.countyExpenditureFacts.countyId, countyLabel)
    .orderBy(desc(sql`sum(${schema.countyExpenditureFacts.amount})`))
    .limit(context.compareLimit)

  const ids = top.map((row) => row.id)
  if (ids.length === 0) return []

  return db
    .select({
      id: schema.countyExpenditureFacts.countyId,
      label: countyLabel,
      fiscal_year: schema.countyExpenditureFacts.fiscalYear,
      amount: sql<string>`sum(${schema.countyExpenditureFacts.amount})`,
    })
    .from(schema.countyExpenditureFacts)
    .leftJoin(
      schema.geographiesCounties,
      eq(schema.countyExpenditureFacts.countyId, schema.geographiesCounties.id),
    )
    .where(
      and(
        inArray(schema.countyExpenditureFacts.countyId, ids),
        ...(fiscalConditions.length ? [and(...fiscalConditions)] : []),
      ),
    )
    .groupBy(
      schema.countyExpenditureFacts.countyId,
      countyLabel,
      schema.countyExpenditureFacts.fiscalYear,
    )
    .orderBy(schema.countyExpenditureFacts.countyId, schema.countyExpenditureFacts.fiscalYear)
}

async function getFocusedTrendRows(db: AppDb, context: AnalysisContext): Promise<SeriesRow[]> {
  if (context.dataset === 'payments' && context.subject === 'agency' && context.agencyId) {
    const amountColumn = context.includeConfidential
      ? schema.paymentAgencyRollups.totalSpendAll
      : schema.paymentAgencyRollups.totalSpendPublic
    const conditions = [
      eq(schema.paymentAgencyRollups.agencyId, context.agencyId),
      sql`${schema.paymentAgencyRollups.scopeFiscalYear} <> 0`,
    ]
    if (context.fiscalYearStart)
      conditions.push(gte(schema.paymentAgencyRollups.scopeFiscalYear, context.fiscalYearStart))
    if (context.fiscalYearEnd)
      conditions.push(lte(schema.paymentAgencyRollups.scopeFiscalYear, context.fiscalYearEnd))
    if (context.fiscalYear)
      conditions.push(eq(schema.paymentAgencyRollups.scopeFiscalYear, context.fiscalYear))

    return db
      .select({
        id: schema.paymentAgencyRollups.agencyId,
        label: schema.agencies.agencyName,
        fiscal_year: schema.paymentAgencyRollups.scopeFiscalYear,
        amount: amountColumn,
      })
      .from(schema.paymentAgencyRollups)
      .innerJoin(schema.agencies, eq(schema.paymentAgencyRollups.agencyId, schema.agencies.id))
      .where(and(...conditions))
      .orderBy(schema.paymentAgencyRollups.scopeFiscalYear)
  }

  if (context.dataset === 'payments' && context.subject === 'payee' && context.payeeId) {
    const amountColumn = context.includeConfidential
      ? schema.paymentPayeeRollups.totalAmountAll
      : schema.paymentPayeeRollups.totalAmountPublic
    const conditions = [
      eq(schema.paymentPayeeRollups.payeeId, context.payeeId),
      sql`${schema.paymentPayeeRollups.scopeFiscalYear} <> 0`,
    ]
    if (context.fiscalYearStart)
      conditions.push(gte(schema.paymentPayeeRollups.scopeFiscalYear, context.fiscalYearStart))
    if (context.fiscalYearEnd)
      conditions.push(lte(schema.paymentPayeeRollups.scopeFiscalYear, context.fiscalYearEnd))
    if (context.fiscalYear)
      conditions.push(eq(schema.paymentPayeeRollups.scopeFiscalYear, context.fiscalYear))

    return db
      .select({
        id: schema.paymentPayeeRollups.payeeId,
        label: schema.payees.payeeNameRaw,
        fiscal_year: schema.paymentPayeeRollups.scopeFiscalYear,
        amount: amountColumn,
      })
      .from(schema.paymentPayeeRollups)
      .innerJoin(schema.payees, eq(schema.paymentPayeeRollups.payeeId, schema.payees.id))
      .where(and(...conditions))
      .orderBy(schema.paymentPayeeRollups.scopeFiscalYear)
  }

  if (context.dataset === 'counties' && context.subject === 'county' && context.countyId) {
    const conditions = [eq(schema.countyExpenditureFacts.countyId, context.countyId)]
    if (context.fiscalYearStart)
      conditions.push(gte(schema.countyExpenditureFacts.fiscalYear, context.fiscalYearStart))
    if (context.fiscalYearEnd)
      conditions.push(lte(schema.countyExpenditureFacts.fiscalYear, context.fiscalYearEnd))
    if (context.fiscalYear)
      conditions.push(eq(schema.countyExpenditureFacts.fiscalYear, context.fiscalYear))

    const countyLabel = sql<string>`coalesce(${schema.geographiesCounties.countyName}, 'Unknown')`
    return db
      .select({
        id: schema.countyExpenditureFacts.countyId,
        label: countyLabel,
        fiscal_year: schema.countyExpenditureFacts.fiscalYear,
        amount: sql<string>`sum(${schema.countyExpenditureFacts.amount})`,
      })
      .from(schema.countyExpenditureFacts)
      .leftJoin(
        schema.geographiesCounties,
        eq(schema.countyExpenditureFacts.countyId, schema.geographiesCounties.id),
      )
      .where(and(...conditions))
      .groupBy(
        schema.countyExpenditureFacts.countyId,
        countyLabel,
        schema.countyExpenditureFacts.fiscalYear,
      )
      .orderBy(schema.countyExpenditureFacts.fiscalYear)
  }

  return []
}

function finalizeConcentration(rows: AmountRow[]) {
  const normalized = rows
    .map((row) => ({
      id: row.id || 'unknown',
      label: row.label || 'Unknown',
      amount: toNumber(row.amount),
    }))
    .filter((row) => row.amount > 0)
    .sort((left, right) => right.amount - left.amount)

  const totalAmount = normalized.reduce((sum, row) => sum + row.amount, 0)
  let running = 0
  const items = normalized.map((row) => {
    const share = totalAmount > 0 ? row.amount / totalAmount : 0
    running += share
    return {
      ...row,
      share,
      cumulative_share: running,
    } satisfies ConcentrationItem
  })
  const metrics = computeConcentrationMetrics(items)

  return {
    items,
    metrics,
  }
}

async function getConcentrationRows(db: AppDb, context: AnalysisContext): Promise<AmountRow[]> {
  if (context.dataset === 'payments' && context.subject === 'agency' && context.agencyId) {
    const conditions = [eq(schema.statePaymentFacts.agencyId, context.agencyId)]
    if (context.fiscalYear)
      conditions.push(eq(schema.statePaymentFacts.fiscalYear, context.fiscalYear))
    if (!context.includeConfidential)
      conditions.push(eq(schema.statePaymentFacts.isConfidential, false))

    if (context.breakdown === 'category') {
      const categoryCode = paymentCategoryCodeSql(schema.statePaymentFacts.objectCategoryRaw)
      const categoryTitle = paymentCategoryTitleSql(schema.statePaymentFacts.objectCategoryRaw)
      return db
        .select({
          id: categoryCode,
          label: categoryTitle,
          amount: sql<string>`sum(${schema.statePaymentFacts.amount})`,
        })
        .from(schema.statePaymentFacts)
        .where(and(...conditions))
        .groupBy(categoryCode, categoryTitle)
        .orderBy(desc(sql`sum(${schema.statePaymentFacts.amount})`))
        .limit(context.limit)
    }

    if (context.breakdown === 'object') {
      return db
        .select({
          id: schema.statePaymentFacts.comptrollerObjectCode,
          label: schema.comptrollerObjects.title,
          amount: sql<string>`sum(${schema.statePaymentFacts.amount})`,
        })
        .from(schema.statePaymentFacts)
        .leftJoin(
          schema.comptrollerObjects,
          eq(schema.statePaymentFacts.comptrollerObjectCode, schema.comptrollerObjects.code),
        )
        .where(and(...conditions))
        .groupBy(schema.statePaymentFacts.comptrollerObjectCode, schema.comptrollerObjects.title)
        .orderBy(desc(sql`sum(${schema.statePaymentFacts.amount})`))
        .limit(context.limit)
    }

    return db
      .select({
        id: schema.statePaymentFacts.payeeId,
        label: schema.payees.payeeNameRaw,
        amount: sql<string>`sum(${schema.statePaymentFacts.amount})`,
      })
      .from(schema.statePaymentFacts)
      .leftJoin(schema.payees, eq(schema.statePaymentFacts.payeeId, schema.payees.id))
      .where(and(...conditions))
      .groupBy(schema.statePaymentFacts.payeeId, schema.payees.payeeNameRaw)
      .orderBy(desc(sql`sum(${schema.statePaymentFacts.amount})`))
      .limit(context.limit)
  }

  if (context.dataset === 'payments' && context.subject === 'payee' && context.payeeId) {
    const conditions = [eq(schema.statePaymentFacts.payeeId, context.payeeId)]
    if (context.fiscalYear)
      conditions.push(eq(schema.statePaymentFacts.fiscalYear, context.fiscalYear))
    if (!context.includeConfidential)
      conditions.push(eq(schema.statePaymentFacts.isConfidential, false))

    if (context.breakdown === 'category') {
      const categoryCode = paymentCategoryCodeSql(schema.statePaymentFacts.objectCategoryRaw)
      const categoryTitle = paymentCategoryTitleSql(schema.statePaymentFacts.objectCategoryRaw)
      return db
        .select({
          id: categoryCode,
          label: categoryTitle,
          amount: sql<string>`sum(${schema.statePaymentFacts.amount})`,
        })
        .from(schema.statePaymentFacts)
        .where(and(...conditions))
        .groupBy(categoryCode, categoryTitle)
        .orderBy(desc(sql`sum(${schema.statePaymentFacts.amount})`))
        .limit(context.limit)
    }

    return db
      .select({
        id: schema.statePaymentFacts.agencyId,
        label: schema.agencies.agencyName,
        amount: sql<string>`sum(${schema.statePaymentFacts.amount})`,
      })
      .from(schema.statePaymentFacts)
      .leftJoin(schema.agencies, eq(schema.statePaymentFacts.agencyId, schema.agencies.id))
      .where(and(...conditions))
      .groupBy(schema.statePaymentFacts.agencyId, schema.agencies.agencyName)
      .orderBy(desc(sql`sum(${schema.statePaymentFacts.amount})`))
      .limit(context.limit)
  }

  if (context.dataset === 'counties' && context.subject === 'county' && context.countyId) {
    const conditions = [eq(schema.countyExpenditureFacts.countyId, context.countyId)]
    if (context.fiscalYear)
      conditions.push(eq(schema.countyExpenditureFacts.fiscalYear, context.fiscalYear))

    if (context.breakdown === 'expenditure_type') {
      const categoryCode = countyCategoryCodeSql(schema.countyExpenditureFacts.expenditureTypeRaw)
      const categoryTitle = countyCategoryTitleSql(schema.countyExpenditureFacts.expenditureTypeRaw)
      return db
        .select({
          id: categoryCode,
          label: categoryTitle,
          amount: sql<string>`sum(${schema.countyExpenditureFacts.amount})`,
        })
        .from(schema.countyExpenditureFacts)
        .where(and(...conditions))
        .groupBy(categoryCode, categoryTitle)
        .orderBy(desc(sql`sum(${schema.countyExpenditureFacts.amount})`))
        .limit(context.limit)
    }

    return db
      .select({
        id: sql<string>`coalesce(${schema.countyExpenditureFacts.agencyId}::text, ${schema.countyExpenditureFacts.agencyNameRaw})`,
        label: sql<string>`coalesce(${schema.agencies.agencyName}, ${schema.countyExpenditureFacts.agencyNameRaw})`,
        amount: sql<string>`sum(${schema.countyExpenditureFacts.amount})`,
      })
      .from(schema.countyExpenditureFacts)
      .leftJoin(schema.agencies, eq(schema.countyExpenditureFacts.agencyId, schema.agencies.id))
      .where(and(...conditions))
      .groupBy(
        sql`coalesce(${schema.countyExpenditureFacts.agencyId}::text, ${schema.countyExpenditureFacts.agencyNameRaw})`,
        sql`coalesce(${schema.agencies.agencyName}, ${schema.countyExpenditureFacts.agencyNameRaw})`,
      )
      .orderBy(desc(sql`sum(${schema.countyExpenditureFacts.amount})`))
      .limit(context.limit)
  }

  if (context.dataset === 'counties') {
    const { current } = await resolveCountyYears(db, context)
    if (!current) return []
    if (context.breakdown === 'agency') {
      return db
        .select({
          id: sql<string>`coalesce(${schema.countyExpenditureFacts.agencyId}::text, ${schema.countyExpenditureFacts.agencyNameRaw})`,
          label: sql<string>`coalesce(${schema.agencies.agencyName}, ${schema.countyExpenditureFacts.agencyNameRaw})`,
          amount: sql<string>`sum(${schema.countyExpenditureFacts.amount})`,
        })
        .from(schema.countyExpenditureFacts)
        .leftJoin(schema.agencies, eq(schema.countyExpenditureFacts.agencyId, schema.agencies.id))
        .where(eq(schema.countyExpenditureFacts.fiscalYear, current))
        .groupBy(
          sql`coalesce(${schema.countyExpenditureFacts.agencyId}::text, ${schema.countyExpenditureFacts.agencyNameRaw})`,
          sql`coalesce(${schema.agencies.agencyName}, ${schema.countyExpenditureFacts.agencyNameRaw})`,
        )
        .orderBy(desc(sql`sum(${schema.countyExpenditureFacts.amount})`))
        .limit(context.limit)
    }

    return db
      .select({
        id: schema.countyExpenditureFacts.countyId,
        label: schema.geographiesCounties.countyName,
        amount: sql<string>`sum(${schema.countyExpenditureFacts.amount})`,
      })
      .from(schema.countyExpenditureFacts)
      .leftJoin(
        schema.geographiesCounties,
        eq(schema.countyExpenditureFacts.countyId, schema.geographiesCounties.id),
      )
      .where(eq(schema.countyExpenditureFacts.fiscalYear, current))
      .groupBy(schema.countyExpenditureFacts.countyId, schema.geographiesCounties.countyName)
      .orderBy(desc(sql`sum(${schema.countyExpenditureFacts.amount})`))
      .limit(context.limit)
  }

  const { current } = await resolvePaymentYears(db, context)
  if (!current) return []
  const amountColumn = context.includeConfidential
    ? {
        agency: schema.paymentAgencyRollups.totalSpendAll,
        payee: schema.paymentPayeeRollups.totalAmountAll,
        category: schema.paymentCategoryRollups.totalAmountAll,
        object: schema.paymentObjectRollups.totalAmountAll,
      }
    : {
        agency: schema.paymentAgencyRollups.totalSpendPublic,
        payee: schema.paymentPayeeRollups.totalAmountPublic,
        category: schema.paymentCategoryRollups.totalAmountPublic,
        object: schema.paymentObjectRollups.totalAmountPublic,
      }

  if (context.breakdown === 'payee') {
    return db
      .select({
        id: schema.paymentPayeeRollups.payeeId,
        label: schema.payees.payeeNameRaw,
        amount: amountColumn.payee,
      })
      .from(schema.paymentPayeeRollups)
      .innerJoin(schema.payees, eq(schema.paymentPayeeRollups.payeeId, schema.payees.id))
      .where(eq(schema.paymentPayeeRollups.scopeFiscalYear, current))
      .orderBy(desc(amountColumn.payee))
      .limit(context.limit)
  }

  if (context.breakdown === 'category') {
    return db
      .select({
        id: schema.paymentCategoryRollups.categoryCode,
        label: schema.paymentCategoryRollups.categoryTitle,
        amount: amountColumn.category,
      })
      .from(schema.paymentCategoryRollups)
      .where(eq(schema.paymentCategoryRollups.scopeFiscalYear, current))
      .orderBy(desc(amountColumn.category))
      .limit(context.limit)
  }

  if (context.breakdown === 'object') {
    return db
      .select({
        id: schema.paymentObjectRollups.objectCode,
        label: schema.paymentObjectRollups.objectTitle,
        amount: amountColumn.object,
      })
      .from(schema.paymentObjectRollups)
      .where(eq(schema.paymentObjectRollups.scopeFiscalYear, current))
      .orderBy(desc(amountColumn.object))
      .limit(context.limit)
  }

  return db
    .select({
      id: schema.paymentAgencyRollups.agencyId,
      label: schema.agencies.agencyName,
      amount: amountColumn.agency,
    })
    .from(schema.paymentAgencyRollups)
    .innerJoin(schema.agencies, eq(schema.paymentAgencyRollups.agencyId, schema.agencies.id))
    .where(eq(schema.paymentAgencyRollups.scopeFiscalYear, current))
    .orderBy(desc(amountColumn.agency))
    .limit(context.limit)
}

function finalizeOutliers(
  rows: AmountRow[],
  priorRows: AmountRow[],
  context: AnalysisContext,
  currentFiscalYear: number,
  priorFiscalYear: number,
) {
  const priorMap = new Map(
    priorRows
      .filter((row): row is Required<Pick<AmountRow, 'id' | 'label' | 'amount'>> & AmountRow =>
        Boolean(row.id),
      )
      .map((row) => [row.id!, { label: row.label || 'Unknown', amount: toNumber(row.amount) }]),
  )

  const normalized = rows
    .filter((row): row is Required<Pick<AmountRow, 'id' | 'label' | 'amount'>> & AmountRow =>
      Boolean(row.id),
    )
    .map((row) => {
      const currentAmount = toNumber(row.amount)
      const prior = priorMap.get(row.id!)
      const priorAmount = prior?.amount || 0
      const deltaAmount = currentAmount - priorAmount
      const pctChange = computePercentChange(currentAmount, priorAmount)

      return {
        id: row.id!,
        label: row.label || prior?.label || 'Unknown',
        current_amount: currentAmount,
        prior_amount: priorAmount,
        delta_amount: deltaAmount,
        pct_change: pctChange,
        reason:
          pctChange === null
            ? `${row.label || 'This slice'} moved from a low or zero prior base to ${formatCurrency(currentAmount)} in FY ${currentFiscalYear}.`
            : `${row.label || 'This slice'} changed by ${formatCurrency(deltaAmount)} (${pctChange.toFixed(1)}%) from FY ${priorFiscalYear} to FY ${currentFiscalYear}.`,
      } satisfies OutlierItem
    })
    .filter((row) => {
      const pctMagnitude = Math.abs(row.pct_change || 0)
      return (
        Math.abs(row.delta_amount) >= context.minChangeAmount &&
        (row.prior_amount === 0 || pctMagnitude >= context.minChangePct)
      )
    })

  const increases = normalized
    .filter((row) => row.delta_amount > 0)
    .sort((left, right) => right.delta_amount - left.delta_amount)
    .slice(0, context.limit)

  const decreases = normalized
    .filter((row) => row.delta_amount < 0)
    .sort((left, right) => left.delta_amount - right.delta_amount)
    .slice(0, context.limit)

  return {
    increases,
    decreases,
  }
}

async function getSystemOutlierRows(
  db: AppDb,
  context: AnalysisContext,
  fiscalYear: number,
  priorFiscalYear: number,
) {
  if (context.dataset === 'counties') {
    if (context.breakdown === 'agency') {
      const key = sql<string>`coalesce(${schema.countyExpenditureFacts.agencyId}::text, ${schema.countyExpenditureFacts.agencyNameRaw})`
      const label = sql<string>`coalesce(${schema.agencies.agencyName}, ${schema.countyExpenditureFacts.agencyNameRaw})`
      const build = (fy: number) =>
        db
          .select({
            id: key,
            label,
            amount: sql<string>`sum(${schema.countyExpenditureFacts.amount})`,
          })
          .from(schema.countyExpenditureFacts)
          .leftJoin(schema.agencies, eq(schema.countyExpenditureFacts.agencyId, schema.agencies.id))
          .where(eq(schema.countyExpenditureFacts.fiscalYear, fy))
          .groupBy(key, label)

      return Promise.all([build(fiscalYear), build(priorFiscalYear)])
    }

    const build = (fy: number) =>
      db
        .select({
          id: schema.countyExpenditureFacts.countyId,
          label: schema.geographiesCounties.countyName,
          amount: sql<string>`sum(${schema.countyExpenditureFacts.amount})`,
        })
        .from(schema.countyExpenditureFacts)
        .leftJoin(
          schema.geographiesCounties,
          eq(schema.countyExpenditureFacts.countyId, schema.geographiesCounties.id),
        )
        .where(eq(schema.countyExpenditureFacts.fiscalYear, fy))
        .groupBy(schema.countyExpenditureFacts.countyId, schema.geographiesCounties.countyName)

    return Promise.all([build(fiscalYear), build(priorFiscalYear)])
  }

  const amountColumn = context.includeConfidential
    ? {
        agency: schema.paymentAgencyRollups.totalSpendAll,
        payee: schema.paymentPayeeRollups.totalAmountAll,
        category: schema.paymentCategoryRollups.totalAmountAll,
        object: schema.paymentObjectRollups.totalAmountAll,
      }
    : {
        agency: schema.paymentAgencyRollups.totalSpendPublic,
        payee: schema.paymentPayeeRollups.totalAmountPublic,
        category: schema.paymentCategoryRollups.totalAmountPublic,
        object: schema.paymentObjectRollups.totalAmountPublic,
      }

  if (context.breakdown === 'payee') {
    const build = (fy: number) =>
      db
        .select({
          id: schema.paymentPayeeRollups.payeeId,
          label: schema.payees.payeeNameRaw,
          amount: amountColumn.payee,
        })
        .from(schema.paymentPayeeRollups)
        .innerJoin(schema.payees, eq(schema.paymentPayeeRollups.payeeId, schema.payees.id))
        .where(eq(schema.paymentPayeeRollups.scopeFiscalYear, fy))

    return Promise.all([build(fiscalYear), build(priorFiscalYear)])
  }

  if (context.breakdown === 'category') {
    const build = (fy: number) =>
      db
        .select({
          id: schema.paymentCategoryRollups.categoryCode,
          label: schema.paymentCategoryRollups.categoryTitle,
          amount: amountColumn.category,
        })
        .from(schema.paymentCategoryRollups)
        .where(eq(schema.paymentCategoryRollups.scopeFiscalYear, fy))

    return Promise.all([build(fiscalYear), build(priorFiscalYear)])
  }

  if (context.breakdown === 'object') {
    const build = (fy: number) =>
      db
        .select({
          id: schema.paymentObjectRollups.objectCode,
          label: schema.paymentObjectRollups.objectTitle,
          amount: amountColumn.object,
        })
        .from(schema.paymentObjectRollups)
        .where(eq(schema.paymentObjectRollups.scopeFiscalYear, fy))

    return Promise.all([build(fiscalYear), build(priorFiscalYear)])
  }

  const build = (fy: number) =>
    db
      .select({
        id: schema.paymentAgencyRollups.agencyId,
        label: schema.agencies.agencyName,
        amount: amountColumn.agency,
      })
      .from(schema.paymentAgencyRollups)
      .innerJoin(schema.agencies, eq(schema.paymentAgencyRollups.agencyId, schema.agencies.id))
      .where(eq(schema.paymentAgencyRollups.scopeFiscalYear, fy))

  return Promise.all([build(fiscalYear), build(priorFiscalYear)])
}

async function getFocusedOutlierRows(
  db: AppDb,
  context: AnalysisContext,
  fiscalYear: number,
  priorFiscalYear: number,
) {
  if (context.dataset === 'payments' && context.subject === 'agency' && context.agencyId) {
    const conditionsCurrent = [
      eq(schema.statePaymentFacts.agencyId, context.agencyId),
      eq(schema.statePaymentFacts.fiscalYear, fiscalYear),
    ]
    const conditionsPrior = [
      eq(schema.statePaymentFacts.agencyId, context.agencyId),
      eq(schema.statePaymentFacts.fiscalYear, priorFiscalYear),
    ]
    if (!context.includeConfidential) {
      conditionsCurrent.push(eq(schema.statePaymentFacts.isConfidential, false))
      conditionsPrior.push(eq(schema.statePaymentFacts.isConfidential, false))
    }

    if (context.breakdown === 'category') {
      const code = paymentCategoryCodeSql(schema.statePaymentFacts.objectCategoryRaw)
      const title = paymentCategoryTitleSql(schema.statePaymentFacts.objectCategoryRaw)
      const build = (conditions: typeof conditionsCurrent) =>
        db
          .select({
            id: code,
            label: title,
            amount: sql<string>`sum(${schema.statePaymentFacts.amount})`,
          })
          .from(schema.statePaymentFacts)
          .where(and(...conditions))
          .groupBy(code, title)

      return Promise.all([build(conditionsCurrent), build(conditionsPrior)])
    }

    const build = (conditions: typeof conditionsCurrent) =>
      db
        .select({
          id: schema.statePaymentFacts.payeeId,
          label: schema.payees.payeeNameRaw,
          amount: sql<string>`sum(${schema.statePaymentFacts.amount})`,
        })
        .from(schema.statePaymentFacts)
        .leftJoin(schema.payees, eq(schema.statePaymentFacts.payeeId, schema.payees.id))
        .where(and(...conditions))
        .groupBy(schema.statePaymentFacts.payeeId, schema.payees.payeeNameRaw)

    return Promise.all([build(conditionsCurrent), build(conditionsPrior)])
  }

  if (context.dataset === 'payments' && context.subject === 'payee' && context.payeeId) {
    const conditionsCurrent = [
      eq(schema.statePaymentFacts.payeeId, context.payeeId),
      eq(schema.statePaymentFacts.fiscalYear, fiscalYear),
    ]
    const conditionsPrior = [
      eq(schema.statePaymentFacts.payeeId, context.payeeId),
      eq(schema.statePaymentFacts.fiscalYear, priorFiscalYear),
    ]
    if (!context.includeConfidential) {
      conditionsCurrent.push(eq(schema.statePaymentFacts.isConfidential, false))
      conditionsPrior.push(eq(schema.statePaymentFacts.isConfidential, false))
    }

    const build = (conditions: typeof conditionsCurrent) =>
      db
        .select({
          id: schema.statePaymentFacts.agencyId,
          label: schema.agencies.agencyName,
          amount: sql<string>`sum(${schema.statePaymentFacts.amount})`,
        })
        .from(schema.statePaymentFacts)
        .leftJoin(schema.agencies, eq(schema.statePaymentFacts.agencyId, schema.agencies.id))
        .where(and(...conditions))
        .groupBy(schema.statePaymentFacts.agencyId, schema.agencies.agencyName)

    return Promise.all([build(conditionsCurrent), build(conditionsPrior)])
  }

  if (context.dataset === 'counties' && context.subject === 'county' && context.countyId) {
    const currentConditions = [
      eq(schema.countyExpenditureFacts.countyId, context.countyId),
      eq(schema.countyExpenditureFacts.fiscalYear, fiscalYear),
    ]
    const priorConditions = [
      eq(schema.countyExpenditureFacts.countyId, context.countyId),
      eq(schema.countyExpenditureFacts.fiscalYear, priorFiscalYear),
    ]

    if (context.breakdown === 'expenditure_type') {
      const code = countyCategoryCodeSql(schema.countyExpenditureFacts.expenditureTypeRaw)
      const title = countyCategoryTitleSql(schema.countyExpenditureFacts.expenditureTypeRaw)
      const build = (conditions: typeof currentConditions) =>
        db
          .select({
            id: code,
            label: title,
            amount: sql<string>`sum(${schema.countyExpenditureFacts.amount})`,
          })
          .from(schema.countyExpenditureFacts)
          .where(and(...conditions))
          .groupBy(code, title)

      return Promise.all([build(currentConditions), build(priorConditions)])
    }

    const key = sql<string>`coalesce(${schema.countyExpenditureFacts.agencyId}::text, ${schema.countyExpenditureFacts.agencyNameRaw})`
    const label = sql<string>`coalesce(${schema.agencies.agencyName}, ${schema.countyExpenditureFacts.agencyNameRaw})`
    const build = (conditions: typeof currentConditions) =>
      db
        .select({
          id: key,
          label,
          amount: sql<string>`sum(${schema.countyExpenditureFacts.amount})`,
        })
        .from(schema.countyExpenditureFacts)
        .leftJoin(schema.agencies, eq(schema.countyExpenditureFacts.agencyId, schema.agencies.id))
        .where(and(...conditions))
        .groupBy(key, label)

    return Promise.all([build(currentConditions), build(priorConditions)])
  }

  return [[], []] satisfies [AmountRow[], AmountRow[]]
}

async function getRelationshipRows(db: AppDb, context: AnalysisContext) {
  const conditions = []
  if (context.fiscalYear)
    conditions.push(eq(schema.statePaymentFacts.fiscalYear, context.fiscalYear))
  if (!context.includeConfidential)
    conditions.push(eq(schema.statePaymentFacts.isConfidential, false))
  if (context.subject === 'agency' && context.agencyId)
    conditions.push(eq(schema.statePaymentFacts.agencyId, context.agencyId))
  if (context.subject === 'payee' && context.payeeId)
    conditions.push(eq(schema.statePaymentFacts.payeeId, context.payeeId))

  const categoryCode = paymentCategoryCodeSql(schema.statePaymentFacts.objectCategoryRaw)
  const categoryTitle = paymentCategoryTitleSql(schema.statePaymentFacts.objectCategoryRaw)

  if (context.relationship === 'agency_category') {
    return db
      .select({
        left_id: schema.statePaymentFacts.agencyId,
        left_label: schema.agencies.agencyName,
        right_id: categoryCode,
        right_label: categoryTitle,
        amount: sql<string>`sum(${schema.statePaymentFacts.amount})`,
      })
      .from(schema.statePaymentFacts)
      .leftJoin(schema.agencies, eq(schema.statePaymentFacts.agencyId, schema.agencies.id))
      .where(and(...conditions))
      .groupBy(
        schema.statePaymentFacts.agencyId,
        schema.agencies.agencyName,
        categoryCode,
        categoryTitle,
      )
      .orderBy(desc(sql`sum(${schema.statePaymentFacts.amount})`))
      .limit(context.limit)
  }

  if (context.relationship === 'payee_category') {
    return db
      .select({
        left_id: schema.statePaymentFacts.payeeId,
        left_label: schema.payees.payeeNameRaw,
        right_id: categoryCode,
        right_label: categoryTitle,
        amount: sql<string>`sum(${schema.statePaymentFacts.amount})`,
      })
      .from(schema.statePaymentFacts)
      .leftJoin(schema.payees, eq(schema.statePaymentFacts.payeeId, schema.payees.id))
      .where(and(...conditions))
      .groupBy(
        schema.statePaymentFacts.payeeId,
        schema.payees.payeeNameRaw,
        categoryCode,
        categoryTitle,
      )
      .orderBy(desc(sql`sum(${schema.statePaymentFacts.amount})`))
      .limit(context.limit)
  }

  if (context.relationship === 'agency_object') {
    return db
      .select({
        left_id: schema.statePaymentFacts.agencyId,
        left_label: schema.agencies.agencyName,
        right_id: schema.statePaymentFacts.comptrollerObjectCode,
        right_label: schema.comptrollerObjects.title,
        amount: sql<string>`sum(${schema.statePaymentFacts.amount})`,
      })
      .from(schema.statePaymentFacts)
      .leftJoin(schema.agencies, eq(schema.statePaymentFacts.agencyId, schema.agencies.id))
      .leftJoin(
        schema.comptrollerObjects,
        eq(schema.statePaymentFacts.comptrollerObjectCode, schema.comptrollerObjects.code),
      )
      .where(and(...conditions))
      .groupBy(
        schema.statePaymentFacts.agencyId,
        schema.agencies.agencyName,
        schema.statePaymentFacts.comptrollerObjectCode,
        schema.comptrollerObjects.title,
      )
      .orderBy(desc(sql`sum(${schema.statePaymentFacts.amount})`))
      .limit(context.limit)
  }

  return db
    .select({
      left_id: schema.statePaymentFacts.agencyId,
      left_label: schema.agencies.agencyName,
      right_id: schema.statePaymentFacts.payeeId,
      right_label: schema.payees.payeeNameRaw,
      amount: sql<string>`sum(${schema.statePaymentFacts.amount})`,
    })
    .from(schema.statePaymentFacts)
    .leftJoin(schema.agencies, eq(schema.statePaymentFacts.agencyId, schema.agencies.id))
    .leftJoin(schema.payees, eq(schema.statePaymentFacts.payeeId, schema.payees.id))
    .where(and(...conditions))
    .groupBy(
      schema.statePaymentFacts.agencyId,
      schema.agencies.agencyName,
      schema.statePaymentFacts.payeeId,
      schema.payees.payeeNameRaw,
    )
    .orderBy(desc(sql`sum(${schema.statePaymentFacts.amount})`))
    .limit(context.limit)
}

export async function getTrendAnalysis(db: AppDb, query: AnalysisQuery) {
  const context = resolveContext(query, 'trends')
  const subjectLabel = await resolveSubjectLabel(db, context)
  const rows =
    context.subject === 'system'
      ? context.dataset === 'payments'
        ? await getPaymentSystemTrendRows(db, context)
        : await getCountySystemTrendRows(db, context)
      : await getFocusedTrendRows(db, context)
  const series = finalizeSeries(rows, context.compareLimit)

  return {
    filters_applied: query,
    data: {
      summary:
        series.length === 0
          ? `No trend series matched the current analysis filters for ${subjectLabel}.`
          : series.length === 1
            ? series[0]!.summary
            : `Comparing ${series.length} ${context.breakdown} series inside ${subjectLabel}.`,
      series,
    } satisfies TrendAnalysisData,
    meta: {
      currency: 'USD',
      dataset: context.dataset,
      subject: context.subject,
      subject_label: subjectLabel,
      breakdown: context.breakdown,
      methodology: buildMethodology(context),
      warnings: buildWarnings(context),
      drill_path: context.dataset === 'payments' ? 'transactions' : 'county_annual',
    } satisfies AnalysisMeta,
  }
}

export async function getConcentrationAnalysis(db: AppDb, query: AnalysisQuery) {
  const context = resolveContext(query, 'concentration')
  const subjectLabel = await resolveSubjectLabel(db, context)
  const rows = await getConcentrationRows(db, context)
  const { items, metrics } = finalizeConcentration(rows)

  return {
    filters_applied: query,
    data: {
      summary:
        items.length === 0
          ? `No concentration breakdown matched the current analysis filters for ${subjectLabel}.`
          : `${items[0]!.label} leads the current ${context.breakdown} breakdown with ${formatCurrency(items[0]!.amount)} and ${(items[0]!.share * 100).toFixed(1)}% of the visible total.`,
      total_amount: metrics.total_amount,
      top_5_share: metrics.top_5_share,
      top_10_share: metrics.top_10_share,
      top_25_share: metrics.top_25_share,
      hhi: metrics.hhi,
      interpretation: metrics.interpretation,
      items,
    } satisfies ConcentrationAnalysisData,
    meta: {
      currency: 'USD',
      dataset: context.dataset,
      subject: context.subject,
      subject_label: subjectLabel,
      breakdown: context.breakdown,
      methodology: buildMethodology(context),
      warnings: buildWarnings(context),
      drill_path: context.dataset === 'payments' ? 'transactions' : 'county_annual',
    } satisfies AnalysisMeta,
  }
}

export async function getOutlierAnalysis(db: AppDb, query: AnalysisQuery) {
  const context = resolveContext(query, 'outliers')
  const subjectLabel = await resolveSubjectLabel(db, context)
  const years =
    context.dataset === 'payments'
      ? await resolvePaymentYears(db, context)
      : await resolveCountyYears(db, context)

  if (!years.current || !years.prior) {
    throw createError({
      statusCode: 400,
      message: 'Outlier analysis requires at least two fiscal years in the selected dataset.',
    })
  }

  const [currentRows, priorRows] =
    context.subject === 'system'
      ? await getSystemOutlierRows(db, context, years.current, years.prior)
      : await getFocusedOutlierRows(db, context, years.current, years.prior)

  const { increases, decreases } = finalizeOutliers(
    currentRows,
    priorRows,
    context,
    years.current,
    years.prior,
  )

  const lead = increases[0] || decreases[0]

  return {
    filters_applied: query,
    data: {
      summary: lead
        ? lead.reason
        : `No mover met the current thresholds for ${subjectLabel} between FY ${years.prior} and FY ${years.current}.`,
      current_fiscal_year: years.current,
      prior_fiscal_year: years.prior,
      increases,
      decreases,
    } satisfies OutlierAnalysisData,
    meta: {
      currency: 'USD',
      dataset: context.dataset,
      subject: context.subject,
      subject_label: subjectLabel,
      breakdown: context.breakdown,
      methodology: [
        ...buildMethodology(context),
        `Outlier thresholds currently require at least ${formatCurrency(context.minChangeAmount)} of absolute change and ${context.minChangePct}% of percentage change unless the prior base was zero.`,
      ],
      warnings: buildWarnings(context),
      drill_path: context.dataset === 'payments' ? 'transactions' : 'county_annual',
      comparison_years: {
        current: years.current,
        prior: years.prior,
      },
    } satisfies AnalysisMeta,
  }
}

export async function getRelationshipAnalysis(db: AppDb, query: AnalysisQuery) {
  const context = resolveContext(query, 'relationships')
  const subjectLabel = await resolveSubjectLabel(db, context)
  const rows = await getRelationshipRows(db, context)
  const leftTotals = new Map<string, number>()
  const rightTotals = new Map<string, number>()

  const normalizedRows = rows.flatMap((row) => {
    if (!row.left_id || !row.right_id) {
      return []
    }

    return [
      {
        left_id: row.left_id,
        left_label: row.left_label || 'Unknown',
        right_id: row.right_id,
        right_label: row.right_label || 'Unknown',
        amount: toNumber(row.amount),
      },
    ]
  })

  for (const row of normalizedRows) {
    leftTotals.set(row.left_id, (leftTotals.get(row.left_id) || 0) + row.amount)
    rightTotals.set(row.right_id, (rightTotals.get(row.right_id) || 0) + row.amount)
  }

  const edges = normalizedRows.map((row) => ({
    ...row,
    share_of_left: row.amount / Math.max(leftTotals.get(row.left_id) || row.amount, 1),
    share_of_right: row.amount / Math.max(rightTotals.get(row.right_id) || row.amount, 1),
  })) satisfies RelationshipEdge[]

  return {
    filters_applied: query,
    data: {
      summary:
        edges.length > 0
          ? `${edges[0]!.left_label} ↔ ${edges[0]!.right_label} is the strongest visible ${context.relationship.replace('_', ' ')} edge in the current slice at ${formatCurrency(edges[0]!.amount)}.`
          : `No observed relationships matched the current payment analysis filters for ${subjectLabel}.`,
      edges,
    } satisfies RelationshipAnalysisData,
    meta: {
      currency: 'USD',
      dataset: context.dataset,
      subject: context.subject,
      subject_label: subjectLabel,
      relationship: context.relationship,
      methodology: buildMethodology(context),
      warnings: [
        ...buildWarnings(context),
        'Relationship edges are payment co-occurrence summaries only. They do not identify contracts, ownership chains, or procurement certainty.',
      ],
      drill_path: 'transactions',
    } satisfies AnalysisMeta,
  }
}
