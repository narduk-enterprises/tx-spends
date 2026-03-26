/**
 * Blog spotlight analyzers.
 *
 * Each analyzer queries the existing spending data and returns a structured
 * SpotlightFindings payload that the post generator will turn into prose.
 *
 * Limitations are explicit: these analyzers only report what the data
 * contains. They do not infer causation, vendor identity, or geography
 * beyond what the Comptroller records provide.
 */
import type { H3Event } from 'h3'
import { desc, eq, sql, and, ne, inArray } from 'drizzle-orm'
import { useAppDatabase } from '#server/utils/database'
import {
  formatAgencyDisplayName,
  formatCategoryDisplayName,
  formatCountyDisplayName,
} from '#server/utils/explorer'
import { getRollupScopeFiscalYear, ROLLUP_ALL_YEARS } from '#server/utils/payment-rollups'
import { formatUsdBig, signedPct } from '#server/utils/blog/pure'
import {
  agencies,
  payees,
  paymentAgencyRollups,
  paymentCategoryRollups,
  paymentObjectRollups,
  paymentOverviewRollups,
  paymentPayeeRollups,
  countyExpenditureFacts,
  geographiesCounties,
} from '#server/database/schema'

export interface SpotlightDataPoint {
  label: string
  value: string
  context?: string
}

export interface SpotlightFindings {
  angleId: string
  angleName: string
  fiscalYear: number | null
  dataPoints: SpotlightDataPoint[]
  summary: string
  limitations: string[]
}

function pct(part: number, total: number): string {
  if (total === 0) return '0%'
  return `${((part / total) * 100).toFixed(1)}%`
}

/** Resolve the latest available fiscal year from rollup data. */
async function getLatestFiscalYear(event: H3Event): Promise<number> {
  const db = useAppDatabase(event)
  const rows = await db
    .select({ fy: paymentOverviewRollups.scopeFiscalYear })
    .from(paymentOverviewRollups)
    .where(ne(paymentOverviewRollups.scopeFiscalYear, ROLLUP_ALL_YEARS))
    .orderBy(desc(paymentOverviewRollups.scopeFiscalYear))
    .limit(1)
  return rows[0]?.fy ?? new Date().getFullYear()
}

// -----------------------------------------------------------------------
// angle: agency-spend-leaders
// -----------------------------------------------------------------------
async function analyzeAgencySpendLeaders(event: H3Event): Promise<SpotlightFindings> {
  const db = useAppDatabase(event)
  const fiscalYear = await getLatestFiscalYear(event)
  const scopeFy = getRollupScopeFiscalYear(fiscalYear)

  const [overviewRows, agencyRows] = await Promise.all([
    db
      .select({ total: paymentOverviewRollups.totalSpendPublic })
      .from(paymentOverviewRollups)
      .where(eq(paymentOverviewRollups.scopeFiscalYear, scopeFy))
      .limit(1),
    db
      .select({
        agencyName: agencies.agencyName,
        totalSpend: paymentAgencyRollups.totalSpendPublic,
        paymentCount: paymentAgencyRollups.paymentCountPublic,
      })
      .from(paymentAgencyRollups)
      .leftJoin(agencies, eq(paymentAgencyRollups.agencyId, agencies.id))
      .where(eq(paymentAgencyRollups.scopeFiscalYear, scopeFy))
      .orderBy(desc(paymentAgencyRollups.totalSpendPublic))
      .limit(10),
  ])

  const total = Number(overviewRows[0]?.total || 0)
  const dataPoints: SpotlightDataPoint[] = agencyRows.map((row, i) => ({
    label: `#${i + 1}: ${formatAgencyDisplayName(row.agencyName)}`,
    value: formatUsdBig(Number(row.totalSpend || 0)),
    context:
      total > 0 ? `${pct(Number(row.totalSpend || 0), total)} of total public spend` : undefined,
  }))

  if (total > 0) {
    const top3 = agencyRows.slice(0, 3).reduce((s, r) => s + Number(r.totalSpend || 0), 0)
    dataPoints.push({
      label: 'Top 3 agencies combined share',
      value: pct(top3, total),
      context: `${formatUsdBig(top3)} of ${formatUsdBig(total)} total`,
    })
  }

  return {
    angleId: 'agency-spend-leaders',
    angleName: 'Agency Spending Leaders',
    fiscalYear,
    dataPoints,
    summary: `In FY ${fiscalYear}, ${agencyRows[0] ? formatAgencyDisplayName(agencyRows[0].agencyName) : 'the top agency'} led all state agencies in public spending at ${formatUsdBig(Number(agencyRows[0]?.totalSpend || 0))} out of ${formatUsdBig(total)} total.`,
    limitations: [
      'Figures reflect public (non-confidential) payments only.',
      'Agency names are sourced from the Texas Comptroller and may differ from official agency titles.',
      'Rollup totals may not match real-time transaction sums due to indexing lag.',
    ],
  }
}

// -----------------------------------------------------------------------
// angle: category-trends
// -----------------------------------------------------------------------
async function analyzeCategoryTrends(event: H3Event): Promise<SpotlightFindings> {
  const db = useAppDatabase(event)

  // Step 1: find the latest two distinct fiscal years that have category rollup data.
  // Fetching only these IDs avoids loading all historical rows into memory.
  const fyRows = await db
    .selectDistinct({ fy: paymentCategoryRollups.scopeFiscalYear })
    .from(paymentCategoryRollups)
    .where(ne(paymentCategoryRollups.scopeFiscalYear, ROLLUP_ALL_YEARS))
    .orderBy(desc(paymentCategoryRollups.scopeFiscalYear))
    .limit(2)

  const latestFy = fyRows[0]?.fy ?? null
  const prevFy = fyRows[1]?.fy ?? null

  if (latestFy === null) {
    return {
      angleId: 'category-trends',
      angleName: 'Expenditure Category Trends',
      fiscalYear: null,
      dataPoints: [{ label: 'Insufficient data', value: 'No category rollup data found.' }],
      summary: 'No category rollup data available.',
      limitations: ['Category rollup data has not been populated yet.'],
    }
  }

  // Step 2: fetch rows only for the identified fiscal years — far cheaper than selecting all.
  const fyValues: number[] = prevFy !== null ? [latestFy, prevFy] : [latestFy]
  const rows = await db
    .select({
      fy: paymentCategoryRollups.scopeFiscalYear,
      code: paymentCategoryRollups.categoryCode,
      title: paymentCategoryRollups.categoryTitle,
      amount: paymentCategoryRollups.totalAmountPublic,
    })
    .from(paymentCategoryRollups)
    .where(inArray(paymentCategoryRollups.scopeFiscalYear, fyValues))
    .orderBy(desc(paymentCategoryRollups.totalAmountPublic))

  const latestMap = new Map<string, number>()
  const prevMap = new Map<string, number>()
  const titles = new Map<string, string>()

  for (const row of rows) {
    if (row.fy === latestFy) {
      latestMap.set(row.code, Number(row.amount || 0))
      titles.set(row.code, row.title)
    }
    if (row.fy === prevFy) {
      prevMap.set(row.code, Number(row.amount || 0))
    }
  }

  const dataPoints: SpotlightDataPoint[] = []

  if (prevFy !== null) {
    // YoY deltas
    const deltas = [...latestMap.entries()]
      .filter(([code]) => prevMap.has(code))
      .map(([code, cur]) => ({
        code,
        title: titles.get(code) ?? code,
        cur,
        prev: prevMap.get(code) ?? 0,
        delta: cur - (prevMap.get(code) ?? 0),
      }))
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 5)

    for (const d of deltas) {
      const sign = d.delta >= 0 ? '+' : ''
      dataPoints.push({
        label: formatCategoryDisplayName(d.title),
        value: `${sign}${formatUsdBig(d.delta)} YoY`,
        context: `FY${prevFy} → FY${latestFy}: ${formatUsdBig(d.prev)} → ${formatUsdBig(d.cur)}`,
      })
    }
  } else {
    // No prior year — just show top categories
    const top = [...latestMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
    for (const [code, amount] of top) {
      dataPoints.push({
        label: formatCategoryDisplayName(titles.get(code) ?? code),
        value: formatUsdBig(amount),
      })
    }
  }

  return {
    angleId: 'category-trends',
    angleName: 'Expenditure Category Trends',
    fiscalYear: latestFy,
    dataPoints,
    summary:
      prevFy !== null
        ? `Comparing FY${prevFy} to FY${latestFy}, the biggest year-over-year category shifts in Texas state spending are highlighted below.`
        : `Top expenditure categories for FY${latestFy} in Texas state spending.`,
    limitations: [
      'Figures reflect public (non-confidential) payments only.',
      'Category codes are assigned by the Texas Comptroller and may aggregate diverse spending types.',
      'Year-over-year comparisons require both fiscal years to have rollup data.',
    ],
  }
}

// -----------------------------------------------------------------------
// angle: payee-concentration
// -----------------------------------------------------------------------
async function analyzePayeeConcentration(event: H3Event): Promise<SpotlightFindings> {
  const db = useAppDatabase(event)
  const fiscalYear = await getLatestFiscalYear(event)
  const scopeFy = getRollupScopeFiscalYear(fiscalYear)

  const [overviewRows, payeeRows] = await Promise.all([
    db
      .select({ total: paymentOverviewRollups.totalSpendPublic, payeeCount: paymentOverviewRollups.payeeCountPublic })
      .from(paymentOverviewRollups)
      .where(eq(paymentOverviewRollups.scopeFiscalYear, scopeFy))
      .limit(1),
    db
      .select({
        payeeName: payees.payeeNameRaw,
        totalSpend: paymentPayeeRollups.totalAmountPublic,
      })
      .from(paymentPayeeRollups)
      .leftJoin(payees, eq(paymentPayeeRollups.payeeId, payees.id))
      .where(eq(paymentPayeeRollups.scopeFiscalYear, scopeFy))
      .orderBy(desc(paymentPayeeRollups.totalAmountPublic))
      .limit(10),
  ])

  const total = Number(overviewRows[0]?.total || 0)
  const payeeCount = Number(overviewRows[0]?.payeeCount || 0)
  const top10Sum = payeeRows.reduce((s, r) => s + Number(r.totalSpend || 0), 0)

  const dataPoints: SpotlightDataPoint[] = payeeRows.map((row, i) => ({
    label: `#${i + 1}: ${row.payeeName || 'Unmatched payee'}`,
    value: formatUsdBig(Number(row.totalSpend || 0)),
    context: total > 0 ? pct(Number(row.totalSpend || 0), total) + ' of total' : undefined,
  }))

  if (total > 0 && payeeCount > 0) {
    dataPoints.push({
      label: 'Top 10 payees combined share',
      value: pct(top10Sum, total),
      context: `${formatUsdBig(top10Sum)} of ${formatUsdBig(total)} across ${payeeCount.toLocaleString()} public payees`,
    })
  }

  return {
    angleId: 'payee-concentration',
    angleName: 'Payee Spending Concentration',
    fiscalYear,
    dataPoints,
    summary: `In FY ${fiscalYear}, the top 10 public payees received ${pct(top10Sum, total)} of all public state spending (${formatUsdBig(top10Sum)}).`,
    limitations: [
      'Figures cover only non-confidential payees. Confidential recipients are excluded from all ranks.',
      'Payee names are sourced from raw Comptroller records and may contain duplicates or variations.',
      'Vendor matching is probabilistic; some payees may represent the same legal entity under different names.',
    ],
  }
}

// -----------------------------------------------------------------------
// angle: confidentiality-patterns
// -----------------------------------------------------------------------
async function analyzeConfidentialityPatterns(event: H3Event): Promise<SpotlightFindings> {
  const db = useAppDatabase(event)
  const fiscalYear = await getLatestFiscalYear(event)
  const scopeFy = getRollupScopeFiscalYear(fiscalYear)

  // Derive confidential totals as all - public from rollup tables,
  // avoiding expensive full-table scans on statePaymentFacts.
  const [overviewRows, agencyRows] = await Promise.all([
    db
      .select({
        totalAll: paymentOverviewRollups.totalSpendAll,
        totalPublic: paymentOverviewRollups.totalSpendPublic,
        countAll: paymentOverviewRollups.paymentCountAll,
        countPublic: paymentOverviewRollups.paymentCountPublic,
      })
      .from(paymentOverviewRollups)
      .where(eq(paymentOverviewRollups.scopeFiscalYear, scopeFy))
      .limit(1),
    db
      .select({
        agencyName: agencies.agencyName,
        totalAll: paymentAgencyRollups.totalSpendAll,
        totalPublic: paymentAgencyRollups.totalSpendPublic,
        countAll: paymentAgencyRollups.paymentCountAll,
        countPublic: paymentAgencyRollups.paymentCountPublic,
      })
      .from(paymentAgencyRollups)
      .leftJoin(agencies, eq(paymentAgencyRollups.agencyId, agencies.id))
      .where(eq(paymentAgencyRollups.scopeFiscalYear, scopeFy))
      .orderBy(
        desc(sql`${paymentAgencyRollups.totalSpendAll} - ${paymentAgencyRollups.totalSpendPublic}`),
      )
      .limit(5),
  ])

  const allTotal = Number(overviewRows[0]?.totalAll || 0)
  const confTotal = allTotal - Number(overviewRows[0]?.totalPublic || 0)
  const confCount = Number(overviewRows[0]?.countAll || 0) - Number(overviewRows[0]?.countPublic || 0)

  const dataPoints: SpotlightDataPoint[] = [
    {
      label: 'Confidential payments (amount)',
      value: formatUsdBig(confTotal),
      context: allTotal > 0 ? pct(confTotal, allTotal) + ' of all payments' : undefined,
    },
    {
      label: 'Confidential payment transactions',
      value: confCount.toLocaleString(),
    },
    ...agencyRows.map((row, i) => {
      const agConfAmount =
        Number(row.totalAll || 0) - Number(row.totalPublic || 0)
      const agConfCount =
        Number(row.countAll || 0) - Number(row.countPublic || 0)
      return {
        label: `#${i + 1} agency (confidential): ${formatAgencyDisplayName(row.agencyName)}`,
        value: formatUsdBig(agConfAmount),
        context: `${agConfCount.toLocaleString()} confidential transactions`,
      }
    }),
  ]

  return {
    angleId: 'confidentiality-patterns',
    angleName: 'Confidential Payment Patterns',
    fiscalYear,
    dataPoints,
    summary: `In FY ${fiscalYear}, ${formatUsdBig(confTotal)} (${pct(confTotal, allTotal)}) of recorded Texas state payments were marked confidential across ${confCount.toLocaleString()} transactions.`,
    limitations: [
      'Confidential payments are legally designated under Texas Government Code. The Comptroller does not disclose payee identities for these transactions.',
      'The agency attribution for confidential payments reflects the paying agency, not the ultimate recipient.',
      'Confidential totals are derived as the difference between all-payment and public-payment rollups.',
    ],
  }
}

// -----------------------------------------------------------------------
// angle: county-distribution
// -----------------------------------------------------------------------
async function analyzeCountyDistribution(event: H3Event): Promise<SpotlightFindings> {
  const db = useAppDatabase(event)

  const [totalRows, topRows, bottomRows] = await Promise.all([
    db
      .select({ total: sql<string>`COALESCE(SUM(${countyExpenditureFacts.amount}), 0)` })
      .from(countyExpenditureFacts),
    db
      .select({
        countyName: geographiesCounties.countyName,
        amount: sql<string>`COALESCE(SUM(${countyExpenditureFacts.amount}), 0)`,
      })
      .from(countyExpenditureFacts)
      .leftJoin(geographiesCounties, eq(countyExpenditureFacts.countyId, geographiesCounties.id))
      .groupBy(geographiesCounties.countyName)
      .orderBy(desc(sql`COALESCE(SUM(${countyExpenditureFacts.amount}), 0)`))
      .limit(5),
    db
      .select({
        countyName: geographiesCounties.countyName,
        amount: sql<string>`COALESCE(SUM(${countyExpenditureFacts.amount}), 0)`,
      })
      .from(countyExpenditureFacts)
      .leftJoin(geographiesCounties, eq(countyExpenditureFacts.countyId, geographiesCounties.id))
      .groupBy(geographiesCounties.countyName)
      .orderBy(sql`COALESCE(SUM(${countyExpenditureFacts.amount}), 0)`)
      .limit(5),
  ])

  const grandTotal = Number(totalRows[0]?.total || 0)

  const dataPoints: SpotlightDataPoint[] = [
    ...topRows.map((row, i) => ({
      label: `Top #${i + 1}: ${formatCountyDisplayName(row.countyName)}`,
      value: formatUsdBig(Number(row.amount || 0)),
      context: grandTotal > 0 ? pct(Number(row.amount || 0), grandTotal) + ' of total' : undefined,
    })),
    ...bottomRows.map((row, i) => ({
      label: `Bottom #${i + 1}: ${formatCountyDisplayName(row.countyName)}`,
      value: formatUsdBig(Number(row.amount || 0)),
    })),
  ]

  return {
    angleId: 'county-distribution',
    angleName: 'County Expenditure Distribution',
    fiscalYear: null,
    dataPoints,
    summary: `Across all available fiscal years, Texas county-level expenditure data covers ${formatUsdBig(grandTotal)} total, with significant geographic concentration at the top.`,
    limitations: [
      'County data comes from the Expenditures by County dataset, which covers agency-reported county allocations — not direct payments to county residents.',
      'Some payments are recorded as "In Texas" without a specific county.',
      'County totals span all available fiscal years in the dataset and are not limited to a single year.',
    ],
  }
}

// -----------------------------------------------------------------------
// angle: object-code-breakdown
// -----------------------------------------------------------------------
async function analyzeObjectCodeBreakdown(event: H3Event): Promise<SpotlightFindings> {
  const db = useAppDatabase(event)
  const fiscalYear = await getLatestFiscalYear(event)
  const scopeFy = getRollupScopeFiscalYear(fiscalYear)

  const [overviewRows, objectRows] = await Promise.all([
    db
      .select({ total: paymentOverviewRollups.totalSpendPublic })
      .from(paymentOverviewRollups)
      .where(eq(paymentOverviewRollups.scopeFiscalYear, scopeFy))
      .limit(1),
    db
      .select({
        code: paymentObjectRollups.objectCode,
        title: paymentObjectRollups.objectTitle,
        group: paymentObjectRollups.objectGroup,
        amount: paymentObjectRollups.totalAmountPublic,
      })
      .from(paymentObjectRollups)
      .where(eq(paymentObjectRollups.scopeFiscalYear, scopeFy))
      .orderBy(desc(paymentObjectRollups.totalAmountPublic))
      .limit(10),
  ])

  const total = Number(overviewRows[0]?.total || 0)

  const dataPoints: SpotlightDataPoint[] = objectRows.map((row, i) => ({
    label: `#${i + 1}: ${row.title} (${row.code})`,
    value: formatUsdBig(Number(row.amount || 0)),
    context: total > 0 ? pct(Number(row.amount || 0), total) + ' of total' : row.group ?? undefined,
  }))

  return {
    angleId: 'object-code-breakdown',
    angleName: 'Comptroller Object Code Breakdown',
    fiscalYear,
    dataPoints,
    summary: `In FY ${fiscalYear}, the top 10 comptroller object codes accounted for ${pct(objectRows.reduce((s, r) => s + Number(r.amount || 0), 0), total)} of all public state spending.`,
    limitations: [
      'Object codes are assigned by the Texas Comptroller and represent accounting classification, not economic purpose.',
      'Figures reflect public payments only.',
      'A single economic activity (e.g. a payroll run) may span multiple object codes.',
    ],
  }
}

// -----------------------------------------------------------------------
// angle: fiscal-year-contrast
// -----------------------------------------------------------------------
async function analyzeFiscalYearContrast(event: H3Event): Promise<SpotlightFindings> {
  const db = useAppDatabase(event)

  const overviewRows = await db
    .select({
      fy: paymentOverviewRollups.scopeFiscalYear,
      total: paymentOverviewRollups.totalSpendPublic,
      agencyCount: paymentOverviewRollups.agencyCountPublic,
      payeeCount: paymentOverviewRollups.payeeCountPublic,
    })
    .from(paymentOverviewRollups)
    .where(ne(paymentOverviewRollups.scopeFiscalYear, ROLLUP_ALL_YEARS))
    .orderBy(desc(paymentOverviewRollups.scopeFiscalYear))
    .limit(2)

  const [current, previous] = overviewRows
  const currentFy = current?.fy ?? null
  const previousFy = previous?.fy ?? null
  const currentTotal = Number(current?.total || 0)
  const previousTotal = Number(previous?.total || 0)
  const delta = currentTotal - previousTotal

  const dataPoints: SpotlightDataPoint[] = []
  if (current) {
    dataPoints.push({
      label: `FY${current.fy} total public spend`,
      value: formatUsdBig(currentTotal),
      context: `${Number(current.agencyCount).toLocaleString()} agencies, ${Number(current.payeeCount).toLocaleString()} payees`,
    })
  }
  if (previous) {
    dataPoints.push({
      label: `FY${previous.fy} total public spend`,
      value: formatUsdBig(previousTotal),
    })
  }
  if (current && previous) {
    dataPoints.push({
      label: `Year-over-year change`,
      value: `${delta >= 0 ? '+' : ''}${formatUsdBig(delta)}`,
      context: `${signedPct(delta, previousTotal)} relative to FY${previous.fy}`,
    })
  }

  return {
    angleId: 'fiscal-year-contrast',
    angleName: 'Fiscal Year Spending Contrast',
    fiscalYear: currentFy,
    dataPoints,
    summary:
      currentFy && previousFy
        ? `From FY${previousFy} to FY${currentFy}, Texas public state spending changed by ${delta >= 0 ? '+' : ''}${formatUsdBig(delta)} (${signedPct(delta, previousTotal)}).`
        : `Fiscal year overview data available for review.`,
    limitations: [
      'Figures reflect non-confidential payments only and may understate total government activity.',
      'Year-over-year changes can reflect changes in data collection scope, not just actual spending changes.',
      'Rollup totals are updated periodically and may not include the most recent transactions.',
    ],
  }
}

// -----------------------------------------------------------------------
// angle: agency-growth-movers
// -----------------------------------------------------------------------
async function analyzeAgencyGrowthMovers(event: H3Event): Promise<SpotlightFindings> {
  const db = useAppDatabase(event)

  const fyRows = await db
    .select({ fy: paymentAgencyRollups.scopeFiscalYear })
    .from(paymentAgencyRollups)
    .where(ne(paymentAgencyRollups.scopeFiscalYear, ROLLUP_ALL_YEARS))
    .orderBy(desc(paymentAgencyRollups.scopeFiscalYear))
    .limit(2)

  if (fyRows.length < 2) {
    return {
      angleId: 'agency-growth-movers',
      angleName: 'Biggest Agency Spending Movers',
      fiscalYear: fyRows[0]?.fy ?? null,
      dataPoints: [{ label: 'Insufficient data', value: 'Need at least 2 fiscal years of rollup data.' }],
      summary: 'Not enough fiscal year rollup data to compute year-over-year agency changes.',
      limitations: ['Year-over-year analysis requires rollup data for at least two fiscal years.'],
    }
  }

  const currentFy = fyRows[0]!.fy
  const prevFy = fyRows[1]!.fy

  const [currentRows, prevRows] = await Promise.all([
    db
      .select({
        agencyId: paymentAgencyRollups.agencyId,
        agencyName: agencies.agencyName,
        total: paymentAgencyRollups.totalSpendPublic,
      })
      .from(paymentAgencyRollups)
      .leftJoin(agencies, eq(paymentAgencyRollups.agencyId, agencies.id))
      .where(eq(paymentAgencyRollups.scopeFiscalYear, currentFy)),
    db
      .select({
        agencyId: paymentAgencyRollups.agencyId,
        total: paymentAgencyRollups.totalSpendPublic,
      })
      .from(paymentAgencyRollups)
      .where(eq(paymentAgencyRollups.scopeFiscalYear, prevFy)),
  ])

  const prevMap = new Map(prevRows.map((r) => [r.agencyId, Number(r.total || 0)]))

  const movers = currentRows
    .filter((r) => prevMap.has(r.agencyId))
    .map((r) => ({
      name: formatAgencyDisplayName(r.agencyName),
      current: Number(r.total || 0),
      prev: prevMap.get(r.agencyId) ?? 0,
      delta: Number(r.total || 0) - (prevMap.get(r.agencyId) ?? 0),
    }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 8)

  const dataPoints: SpotlightDataPoint[] = movers.map((m) => {
    const sign = m.delta >= 0 ? '+' : ''
    return {
      label: m.name,
      value: `${sign}${formatUsdBig(m.delta)}`,
      context: `FY${prevFy}: ${formatUsdBig(m.prev)} → FY${currentFy}: ${formatUsdBig(m.current)}`,
    }
  })

  return {
    angleId: 'agency-growth-movers',
    angleName: 'Biggest Agency Spending Movers',
    fiscalYear: currentFy,
    dataPoints,
    summary: `Comparing FY${prevFy} to FY${currentFy}, the largest agency spending changes — both increases and reductions — are shown below.`,
    limitations: [
      'Only agencies present in both fiscal years are included in the comparison.',
      'Figures reflect public payments only.',
      'Spending changes may reflect budget reallocations, agency restructuring, or data scope changes — not necessarily program changes.',
    ],
  }
}

// -----------------------------------------------------------------------
// Dispatcher
// -----------------------------------------------------------------------

/**
 * Run the analyzer for a given angle and return structured findings.
 */
export async function runAnalyzer(event: H3Event, angleId: string): Promise<SpotlightFindings> {
  switch (angleId) {
    case 'agency-spend-leaders':
      return analyzeAgencySpendLeaders(event)
    case 'category-trends':
      return analyzeCategoryTrends(event)
    case 'payee-concentration':
      return analyzePayeeConcentration(event)
    case 'confidentiality-patterns':
      return analyzeConfidentialityPatterns(event)
    case 'county-distribution':
      return analyzeCountyDistribution(event)
    case 'object-code-breakdown':
      return analyzeObjectCodeBreakdown(event)
    case 'fiscal-year-contrast':
      return analyzeFiscalYearContrast(event)
    case 'agency-growth-movers':
      return analyzeAgencyGrowthMovers(event)
    default:
      throw createError({ statusCode: 400, message: `Unknown angle: ${angleId}` })
  }
}
