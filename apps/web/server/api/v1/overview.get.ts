import { getValidatedQuery } from 'h3'
import { and, desc, eq, sql } from 'drizzle-orm'
import { useAppDatabase } from '#server/utils/database'
import {
  countyCategoryCodeSql,
  countyCategoryTitleSql,
  formatAgencyDisplayName,
  formatCountyDisplayName,
  paymentCategoryCodeSql,
  paymentCategoryTitleSql,
} from '#server/utils/explorer'
import { globalQuerySchema } from '#server/utils/query'
import {
  countyExpenditureFacts,
  statePaymentFacts,
  agencies,
  payees,
  fiscalYears,
  geographiesCounties,
} from '#server/database/schema'

export default defineEventHandler(async (event) => {
  const query = await getValidatedQuery(event, globalQuerySchema.parse)
  const db = useAppDatabase(event)

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
  const paymentCategoryCode = paymentCategoryCodeSql(statePaymentFacts.objectCategoryRaw)
  const paymentCategoryTitle = paymentCategoryTitleSql(statePaymentFacts.objectCategoryRaw)
  const countyCategoryCode = countyCategoryCodeSql(countyExpenditureFacts.expenditureTypeRaw)
  const countyCategoryTitle = countyCategoryTitleSql(countyExpenditureFacts.expenditureTypeRaw)

  const [paymentsBackfillState] = await db
    .select({
      active: sql<boolean>`exists(
        select 1
        from pg_stat_activity
        where state = 'active'
          and query ilike 'INSERT INTO state_payment_facts%'
      )`.as('active'),
    })
    .from(fiscalYears)
    .limit(1)

  const paymentsBackfillActive = Boolean(paymentsBackfillState?.active)

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

  let totalPaymentSpendRes: { total: string } | undefined
  let paymentAgencyCountRes: { count: number } | undefined
  let paymentPayeeCountRes: { count: number } | undefined
  let topAgencies: Array<{
    agencyId: string | null
    agencyName: string | null
    totalSpend: string
  }> = []
  let topPayees: Array<{
    payeeId: string | null
    payeeName: string | null
    totalSpend: string
  }> = []
  let topCategories: Array<{
    categoryCode: string | null
    categoryTitle: string | null
    totalSpend: string
  }> = []
  let timeline: Array<{
    fiscalYear: number
    totalSpend: string
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
      totalPaymentSpendRows,
      paymentAgencyCountRows,
      paymentPayeeCountRows,
      paymentAgencyRows,
      paymentPayeeRows,
      paymentCategoryRows,
      paymentTimelineRows,
      transactionRows,
    ] = await Promise.all([
      db
        .select({ total: sql<string>`COALESCE(SUM(${statePaymentFacts.amount}), 0)` })
        .from(statePaymentFacts)
        .where(paymentWhere),
      db
        .select({ count: sql<number>`COUNT(DISTINCT ${statePaymentFacts.agencyId})` })
        .from(statePaymentFacts)
        .where(paymentWhere),
      db
        .select({ count: sql<number>`COUNT(DISTINCT ${statePaymentFacts.payeeId})` })
        .from(statePaymentFacts)
        .where(paymentWhere),
      db
        .select({
          agencyId: statePaymentFacts.agencyId,
          agencyName: agencies.agencyName,
          totalSpend: sql<string>`COALESCE(SUM(${statePaymentFacts.amount}), 0)`,
        })
        .from(statePaymentFacts)
        .leftJoin(agencies, eq(statePaymentFacts.agencyId, agencies.id))
        .where(paymentWhere)
        .groupBy(statePaymentFacts.agencyId, agencies.agencyName)
        .orderBy(desc(sql`COALESCE(SUM(${statePaymentFacts.amount}), 0)`))
        .limit(5),
      db
        .select({
          payeeId: statePaymentFacts.payeeId,
          payeeName: payees.payeeNameRaw,
          totalSpend: sql<string>`COALESCE(SUM(${statePaymentFacts.amount}), 0)`,
        })
        .from(statePaymentFacts)
        .leftJoin(payees, eq(statePaymentFacts.payeeId, payees.id))
        .where(paymentWhere)
        .groupBy(statePaymentFacts.payeeId, payees.payeeNameRaw)
        .orderBy(desc(sql`COALESCE(SUM(${statePaymentFacts.amount}), 0)`))
        .limit(5),
      db
        .select({
          categoryCode: paymentCategoryCode,
          categoryTitle: paymentCategoryTitle,
          totalSpend: sql<string>`COALESCE(SUM(${statePaymentFacts.amount}), 0)`,
        })
        .from(statePaymentFacts)
        .where(paymentWhere)
        .groupBy(paymentCategoryCode, paymentCategoryTitle)
        .orderBy(desc(sql`COALESCE(SUM(${statePaymentFacts.amount}), 0)`))
        .limit(5),
      db
        .select({
          fiscalYear: statePaymentFacts.fiscalYear,
          totalSpend: sql<string>`COALESCE(SUM(${statePaymentFacts.amount}), 0)`,
        })
        .from(statePaymentFacts)
        .where(paymentWhere)
        .groupBy(statePaymentFacts.fiscalYear)
        .orderBy(statePaymentFacts.fiscalYear)
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

    totalPaymentSpendRes = totalPaymentSpendRows[0]
    paymentAgencyCountRes = paymentAgencyCountRows[0]
    paymentPayeeCountRes = paymentPayeeCountRows[0]
    topAgencies = paymentAgencyRows
    topPayees = paymentPayeeRows
    topCategories = paymentCategoryRows
    timeline = paymentTimelineRows
    recentTransactions = transactionRows
  }

  const hasPaymentFacts =
    !paymentsBackfillActive && Number(totalPaymentSpendRes?.total || 0) > 0
  const agencyRankings = hasPaymentFacts
    ? topAgencies.map((agency) => ({
        agency_id: agency.agencyId,
        agency_name: formatAgencyDisplayName(agency.agencyName),
        amount: Number(agency.totalSpend),
      }))
    : countyAgencyFallback.map((agency) => ({
        agency_id: agency.agencyId,
        agency_name: formatAgencyDisplayName(agency.agencyName || agency.agencyNameRaw),
        amount: Number(agency.totalSpend),
      }))

  const trendSeries = (hasPaymentFacts ? timeline : countyTimeline).map((entry) => ({
    fiscal_year: entry.fiscalYear,
    amount: Number(entry.totalSpend),
  }))
  const categoryRankings = (hasPaymentFacts ? topCategories : countyCategoryFallback).map(
    (category) => ({
      category_code: category.categoryCode,
      category_title: category.categoryTitle || 'Uncategorized',
      amount: Number(category.totalSpend),
    }),
  )

  return {
    filters_applied: query,
    data: {
      total_spend: Number(totalPaymentSpendRes?.total || 0),
      agency_count: hasPaymentFacts
        ? Number(paymentAgencyCountRes?.count || 0)
        : Number(countyAgencyCountRes?.count || 0),
      payee_count: hasPaymentFacts ? Number(paymentPayeeCountRes?.count || 0) : 0,
      top_agency: agencyRankings[0]
        ? {
            agency_id: agencyRankings[0].agency_id,
            agency_name: agencyRankings[0].agency_name,
            amount: Number(agencyRankings[0].amount),
          }
        : null,
      top_payee: topPayees[0]
        ? {
            payee_id: topPayees[0].payeeId,
            payee_name: topPayees[0].payeeName,
            amount: Number(topPayees[0].totalSpend),
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
            amount: Number(topCounties[0].totalSpend),
          }
        : null,
      county_layer_total: Number(totalCountySpendRes?.total || 0),
      timeline: trendSeries,
      top_agencies: agencyRankings,
      top_payees: topPayees.map((payee) => ({
        payee_id: payee.payeeId,
        payee_name: payee.payeeName || 'Confidential or unmatched payee',
        amount: Number(payee.totalSpend),
      })),
      top_categories: categoryRankings,
      top_counties: topCounties.map((county) => ({
        county_id: county.countyId,
        county_name: formatCountyDisplayName(county.countyName, 'Unknown'),
        amount: Number(county.totalSpend),
      })),
      recent_transactions: recentTransactions.map((transaction) => ({
        ...transaction,
        agency_name: formatAgencyDisplayName(transaction.agency_name),
        payee_name: query.include_confidential
          ? transaction.payee_name || 'CONFIDENTIAL'
          : transaction.payee_name,
        amount: Number(transaction.amount || 0),
      })),
    },
    meta: {
      currency: 'USD',
      payments_backfill_active: paymentsBackfillActive,
    },
  }
})
