import { getValidatedQuery } from 'h3'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { useAppDatabase } from '#server/utils/database'
import {
  countyCategoryCodeSql,
  countyCategoryTitleSql,
  formatAgencyDisplayName,
  formatCategoryDisplayName,
  formatCountyDisplayName,
} from '#server/utils/explorer'
import { getPaymentsBackfillStatus } from '#server/utils/payments-backfill'
import { getRollupScopeFiscalYear, ROLLUP_ALL_YEARS } from '#server/utils/payment-rollups'
import { globalQuerySchema } from '#server/utils/query'
import { computePctChange, computeYoyMovers, type YoyMoverRow } from '#server/utils/yoy'
import {
  agencies,
  countyExpenditureFacts,
  geographiesCounties,
  payees,
  paymentAgencyRollups,
  paymentCategoryRollups,
  paymentOverviewRollups,
  paymentPayeeRollups,
  statePaymentFacts,
} from '#server/database/schema'

export default defineEventHandler(async (event) => {
  const query = await getValidatedQuery(event, globalQuerySchema.parse)
  const db = useAppDatabase(event)
  const paymentsBackfill = await getPaymentsBackfillStatus(db)
  const paymentsBackfillActive = paymentsBackfill.active
  const rollupScopeFiscalYear = getRollupScopeFiscalYear(query.fiscal_year)

  const countyConditions = []
  const paymentConditions = []

  if (query.fiscal_year) {
    countyConditions.push(eq(countyExpenditureFacts.fiscalYear, query.fiscal_year))
    paymentConditions.push(eq(statePaymentFacts.fiscalYear, query.fiscal_year))
  }

  if (!query.include_confidential) {
    paymentConditions.push(eq(statePaymentFacts.isConfidential, false))
  }

  const countyWhere = countyConditions.length > 0 ? and(...countyConditions) : undefined
  const paymentWhere = paymentConditions.length > 0 ? and(...paymentConditions) : undefined
  const countyCategoryCode = countyCategoryCodeSql(countyExpenditureFacts.expenditureTypeRaw)
  const countyCategoryTitle = countyCategoryTitleSql(countyExpenditureFacts.expenditureTypeRaw)
  const overviewAmountColumn = query.include_confidential
    ? paymentOverviewRollups.totalSpendAll
    : paymentOverviewRollups.totalSpendPublic
  const overviewAgencyCountColumn = query.include_confidential
    ? paymentOverviewRollups.agencyCountAll
    : paymentOverviewRollups.agencyCountPublic
  const overviewPayeeCountColumn = query.include_confidential
    ? paymentOverviewRollups.payeeCountAll
    : paymentOverviewRollups.payeeCountPublic
  const agencyAmountColumn = query.include_confidential
    ? paymentAgencyRollups.totalSpendAll
    : paymentAgencyRollups.totalSpendPublic
  const payeeAmountColumn = query.include_confidential
    ? paymentPayeeRollups.totalAmountAll
    : paymentPayeeRollups.totalAmountPublic
  const categoryAmountColumn = query.include_confidential
    ? paymentCategoryRollups.totalAmountAll
    : paymentCategoryRollups.totalAmountPublic

  const [
    totalCountySpendRows,
    countyAgencyCountRows,
    topCounties,
    countyTimeline,
    countyAgencyFallback,
    countyCategoryFallback,
  ] = await Promise.all([
    db
      .select({ total: sql<string>`COALESCE(SUM(${countyExpenditureFacts.amount}), 0)` })
      .from(countyExpenditureFacts)
      .where(countyWhere),
    db
      .select({
        count: sql<number>`COUNT(DISTINCT COALESCE(${countyExpenditureFacts.agencyId}::text, ${countyExpenditureFacts.agencyNameRaw}))`,
      })
      .from(countyExpenditureFacts)
      .where(countyWhere),
    db
      .select({
        countyId: countyExpenditureFacts.countyId,
        countyName: geographiesCounties.countyName,
        totalSpend: sql<string>`COALESCE(SUM(${countyExpenditureFacts.amount}), 0)`,
      })
      .from(countyExpenditureFacts)
      .leftJoin(geographiesCounties, eq(countyExpenditureFacts.countyId, geographiesCounties.id))
      .where(countyWhere)
      .groupBy(countyExpenditureFacts.countyId, geographiesCounties.countyName)
      .orderBy(desc(sql`COALESCE(SUM(${countyExpenditureFacts.amount}), 0)`))
      .limit(5),
    db
      .select({
        fiscalYear: countyExpenditureFacts.fiscalYear,
        totalSpend: sql<string>`COALESCE(SUM(${countyExpenditureFacts.amount}), 0)`,
      })
      .from(countyExpenditureFacts)
      .where(countyWhere)
      .groupBy(countyExpenditureFacts.fiscalYear)
      .orderBy(countyExpenditureFacts.fiscalYear)
      .limit(10),
    db
      .select({
        agencyId: countyExpenditureFacts.agencyId,
        agencyName: agencies.agencyName,
        agencyNameRaw: countyExpenditureFacts.agencyNameRaw,
        totalSpend: sql<string>`COALESCE(SUM(${countyExpenditureFacts.amount}), 0)`,
      })
      .from(countyExpenditureFacts)
      .leftJoin(agencies, eq(countyExpenditureFacts.agencyId, agencies.id))
      .where(countyWhere)
      .groupBy(
        countyExpenditureFacts.agencyId,
        agencies.agencyName,
        countyExpenditureFacts.agencyNameRaw,
      )
      .orderBy(desc(sql`COALESCE(SUM(${countyExpenditureFacts.amount}), 0)`))
      .limit(5),
    db
      .select({
        categoryCode: countyCategoryCode,
        categoryTitle: countyCategoryTitle,
        totalSpend: sql<string>`COALESCE(SUM(${countyExpenditureFacts.amount}), 0)`,
      })
      .from(countyExpenditureFacts)
      .where(countyWhere)
      .groupBy(countyCategoryCode, countyCategoryTitle)
      .orderBy(desc(sql`COALESCE(SUM(${countyExpenditureFacts.amount}), 0)`))
      .limit(5),
  ])

  const totalCountySpendRes = totalCountySpendRows[0]
  const countyAgencyCountRes = countyAgencyCountRows[0]

  let paymentOverview:
    | {
        totalSpend: string | null
        agencyCount: number | null
        payeeCount: number | null
      }
    | undefined
  let topAgencies: Array<{
    agencyId: string | null
    agencyName: string | null
    totalSpend: string | null
  }> = []
  let topPayees: Array<{
    payeeId: string | null
    payeeName: string | null
    totalSpend: string | null
  }> = []
  let topCategories: Array<{
    categoryCode: string | null
    categoryTitle: string | null
    totalSpend: string | null
  }> = []
  let timeline: Array<{
    fiscalYear: number
    totalSpend: string | null
  }> = []
  let recentTransactions: Array<{
    transaction_id: string
    payment_date: string
    agency_id: string | null
    agency_name: string | null
    payee_id: string | null
    payee_name: string | null
    amount: string | number | null
    object_code: string | null
  }> = []

  if (!paymentsBackfillActive) {
    const [
      paymentOverviewRows,
      paymentAgencyRows,
      paymentPayeeRows,
      paymentCategoryRows,
      paymentTimelineRows,
      transactionRows,
    ] = await Promise.all([
      db
        .select({
          totalSpend: overviewAmountColumn,
          agencyCount: overviewAgencyCountColumn,
          payeeCount: overviewPayeeCountColumn,
        })
        .from(paymentOverviewRollups)
        .where(eq(paymentOverviewRollups.scopeFiscalYear, rollupScopeFiscalYear))
        .limit(1),
      db
        .select({
          agencyId: paymentAgencyRollups.agencyId,
          agencyName: agencies.agencyName,
          totalSpend: agencyAmountColumn,
        })
        .from(paymentAgencyRollups)
        .leftJoin(agencies, eq(paymentAgencyRollups.agencyId, agencies.id))
        .where(eq(paymentAgencyRollups.scopeFiscalYear, rollupScopeFiscalYear))
        .orderBy(desc(agencyAmountColumn))
        .limit(5),
      db
        .select({
          payeeId: paymentPayeeRollups.payeeId,
          payeeName: payees.payeeNameRaw,
          totalSpend: payeeAmountColumn,
        })
        .from(paymentPayeeRollups)
        .leftJoin(payees, eq(paymentPayeeRollups.payeeId, payees.id))
        .where(eq(paymentPayeeRollups.scopeFiscalYear, rollupScopeFiscalYear))
        .orderBy(desc(payeeAmountColumn))
        .limit(5),
      db
        .select({
          categoryCode: paymentCategoryRollups.categoryCode,
          categoryTitle: paymentCategoryRollups.categoryTitle,
          totalSpend: categoryAmountColumn,
        })
        .from(paymentCategoryRollups)
        .where(eq(paymentCategoryRollups.scopeFiscalYear, rollupScopeFiscalYear))
        .orderBy(desc(categoryAmountColumn))
        .limit(5),
      db
        .select({
          fiscalYear: paymentOverviewRollups.scopeFiscalYear,
          totalSpend: overviewAmountColumn,
        })
        .from(paymentOverviewRollups)
        .where(
          query.fiscal_year
            ? eq(paymentOverviewRollups.scopeFiscalYear, rollupScopeFiscalYear)
            : sql`${paymentOverviewRollups.scopeFiscalYear} <> ${ROLLUP_ALL_YEARS}`,
        )
        .orderBy(paymentOverviewRollups.scopeFiscalYear)
        .limit(10),
      db
        .select({
          transaction_id: statePaymentFacts.sourceRowHash,
          payment_date: statePaymentFacts.paymentDate,
          agency_id: statePaymentFacts.agencyId,
          agency_name: agencies.agencyName,
          payee_id: statePaymentFacts.payeeId,
          payee_name: payees.payeeNameRaw,
          amount: statePaymentFacts.amount,
          object_code: statePaymentFacts.comptrollerObjectCode,
        })
        .from(statePaymentFacts)
        .leftJoin(agencies, eq(statePaymentFacts.agencyId, agencies.id))
        .leftJoin(payees, eq(statePaymentFacts.payeeId, payees.id))
        .where(paymentWhere)
        .orderBy(desc(statePaymentFacts.paymentDate))
        .limit(10),
    ])

    paymentOverview = paymentOverviewRows[0]
    topAgencies = paymentAgencyRows
    topPayees = paymentPayeeRows
    topCategories = paymentCategoryRows
    timeline = paymentTimelineRows
    recentTransactions = transactionRows
  }

  const hasPaymentFacts = !paymentsBackfillActive && Number(paymentOverview?.totalSpend || 0) > 0

  // Year-over-year movers: only when payment facts are available and no single-year filter is
  // active. Years are queried directly (desc limit 2) so we always use the two most-recent
  // fiscal years even when the database contains more than 10 years total.
  // Note: prior-year agencies are fetched after the current-year query because the IN-filter
  // requires currentIds; the two queries are therefore sequential by design.
  /** Maximum number of top agencies to include in the current-year top-agency cohort query. */
  const YOY_AGENCY_POOL_SIZE = 50
  let yoyMovers: {
    current_year: number
    prior_year: number
    total_change_pct: number | null
    top_increases: YoyMoverRow[]
    top_decreases: YoyMoverRow[]
  } | null = null

  if (hasPaymentFacts && !query.fiscal_year) {
    // Query the two most-recent fiscal years directly so we always compare the latest years
    // even when there are more than 10 years in the database (the timeline array is limited to 10).
    const latestFiscalYears = await db
      .select({ fiscalYear: paymentOverviewRollups.scopeFiscalYear })
      .from(paymentOverviewRollups)
      .where(sql`${paymentOverviewRollups.scopeFiscalYear} <> ${ROLLUP_ALL_YEARS}`)
      .orderBy(desc(paymentOverviewRollups.scopeFiscalYear))
      .limit(2)

    if (latestFiscalYears.length >= 2) {
      const currentYear = latestFiscalYears[0]!.fiscalYear
      const priorYear = latestFiscalYears[1]!.fiscalYear

      // Run the overview totals and top-agency queries in parallel — both depend only on
      // currentYear/priorYear, not on each other.
      const [overviewByYear, currentYearAgencies] = await Promise.all([
        db
          .select({
            fiscalYear: paymentOverviewRollups.scopeFiscalYear,
            totalSpend: overviewAmountColumn,
          })
          .from(paymentOverviewRollups)
          .where(inArray(paymentOverviewRollups.scopeFiscalYear, [currentYear, priorYear])),
        db
          .select({
            agencyId: paymentAgencyRollups.agencyId,
            agencyName: agencies.agencyName,
            totalSpend: agencyAmountColumn,
          })
          .from(paymentAgencyRollups)
          .leftJoin(agencies, eq(paymentAgencyRollups.agencyId, agencies.id))
          .where(eq(paymentAgencyRollups.scopeFiscalYear, currentYear))
          .orderBy(desc(agencyAmountColumn))
          .limit(YOY_AGENCY_POOL_SIZE),
      ])

      const currentOverview = overviewByYear.find((r) => r.fiscalYear === currentYear)
      const priorOverview = overviewByYear.find((r) => r.fiscalYear === priorYear)
      const totalChangePct =
        currentOverview && priorOverview
          ? computePctChange(
              Number(currentOverview.totalSpend || 0),
              Number(priorOverview.totalSpend || 0),
            )
          : null

      const currentIds = currentYearAgencies
        .map((row) => row.agencyId)
        .filter((id): id is string => Boolean(id))

      const priorYearAgencies =
        currentIds.length > 0
          ? await db
              .select({
                agencyId: paymentAgencyRollups.agencyId,
                totalSpend: agencyAmountColumn,
              })
              .from(paymentAgencyRollups)
              .where(
                and(
                  eq(paymentAgencyRollups.scopeFiscalYear, priorYear),
                  inArray(paymentAgencyRollups.agencyId, currentIds),
                ),
              )
          : []

      const movers = computeYoyMovers(
        currentYearAgencies.map((row) => ({
          id: row.agencyId,
          name: formatAgencyDisplayName(row.agencyName),
          amount: Number(row.totalSpend || 0),
        })),
        priorYearAgencies.map((row) => ({
          id: row.agencyId,
          amount: Number(row.totalSpend || 0),
        })),
      )

      yoyMovers = {
        current_year: currentYear,
        prior_year: priorYear,
        total_change_pct: totalChangePct,
        top_increases: movers.increases,
        top_decreases: movers.decreases,
      }
    }
  }

  const agencyRankings = hasPaymentFacts
    ? topAgencies.map((agency) => ({
        agency_id: agency.agencyId,
        agency_name: formatAgencyDisplayName(agency.agencyName),
        amount: Number(agency.totalSpend || 0),
      }))
    : countyAgencyFallback.map((agency) => ({
        agency_id: agency.agencyId,
        agency_name: formatAgencyDisplayName(agency.agencyName || agency.agencyNameRaw),
        amount: Number(agency.totalSpend || 0),
      }))

  const categoryRankings = (hasPaymentFacts ? topCategories : countyCategoryFallback).map(
    (category) => ({
      category_code: category.categoryCode,
      category_title: formatCategoryDisplayName(category.categoryTitle, 'Uncategorized'),
      amount: Number(category.totalSpend || 0),
    }),
  )

  const trendSeries = (hasPaymentFacts ? timeline : countyTimeline).map((entry) => ({
    fiscal_year: entry.fiscalYear,
    amount: Number(entry.totalSpend || 0),
  }))

  return {
    filters_applied: query,
    data: {
      total_spend: Number(paymentOverview?.totalSpend || 0),
      agency_count: hasPaymentFacts
        ? Number(paymentOverview?.agencyCount || 0)
        : Number(countyAgencyCountRes?.count || 0),
      payee_count: hasPaymentFacts ? Number(paymentOverview?.payeeCount || 0) : 0,
      top_agency: agencyRankings[0]
        ? {
            agency_id: agencyRankings[0].agency_id,
            agency_name: agencyRankings[0].agency_name,
            amount: agencyRankings[0].amount,
          }
        : null,
      top_payee: topPayees[0]
        ? {
            payee_id: topPayees[0].payeeId,
            payee_name: topPayees[0].payeeName || 'Confidential or unmatched payee',
            amount: Number(topPayees[0].totalSpend || 0),
          }
        : null,
      top_category: categoryRankings[0]
        ? {
            category_code: categoryRankings[0].category_code,
            category_title: categoryRankings[0].category_title,
            amount: categoryRankings[0].amount,
          }
        : null,
      top_county: topCounties[0]
        ? {
            county_id: topCounties[0].countyId,
            county_name: formatCountyDisplayName(topCounties[0].countyName, 'Unknown'),
            amount: Number(topCounties[0].totalSpend || 0),
          }
        : null,
      county_layer_total: Number(totalCountySpendRes?.total || 0),
      timeline: trendSeries,
      top_agencies: agencyRankings,
      top_payees: topPayees.map((payee) => ({
        payee_id: payee.payeeId,
        payee_name: payee.payeeName || 'Confidential or unmatched payee',
        amount: Number(payee.totalSpend || 0),
      })),
      top_categories: categoryRankings,
      top_counties: topCounties.map((county) => ({
        county_id: county.countyId,
        county_name: formatCountyDisplayName(county.countyName, 'Unknown'),
        amount: Number(county.totalSpend || 0),
      })),
      recent_transactions: recentTransactions.map((transaction) => ({
        ...transaction,
        agency_name: formatAgencyDisplayName(transaction.agency_name),
        payee_name: query.include_confidential
          ? transaction.payee_name || 'CONFIDENTIAL'
          : transaction.payee_name,
        amount: Number(transaction.amount || 0),
      })),
      yoy_movers: yoyMovers,
    },
    meta: {
      currency: 'USD',
      payments_backfill_active: paymentsBackfillActive,
      payments_backfill: paymentsBackfill,
    },
  }
})
