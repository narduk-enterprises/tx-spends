import { getValidatedQuery } from 'h3'
import { eq, desc, sql } from 'drizzle-orm'
import { useAppDatabase } from '#server/utils/database'
import { globalQuerySchema } from '#server/utils/query'
import {
  countyExpenditureFacts,
  statePaymentFacts,
  agencies,
  payees,
  geographiesCounties,
  expenditureCategories,
} from '#server/database/schema'

export default defineEventHandler(async (event) => {
  const query = await getValidatedQuery(event, globalQuerySchema.parse)
  const db = useAppDatabase(event)

  // Wait, Drizzle dynamic query building requires building an array of conditions
  // if we have them. For the overview, we might filter by fiscal_year.
  const countyConditions = query.fiscal_year
    ? [eq(countyExpenditureFacts.fiscalYear, query.fiscal_year)]
    : []
  const paymentConditions = query.fiscal_year
    ? [eq(statePaymentFacts.fiscalYear, query.fiscal_year)]
    : []

  const whereCounty =
    countyConditions.length > 0 ? sql.join(countyConditions, sql` and `) : undefined
  const wherePayment =
    paymentConditions.length > 0 ? sql.join(paymentConditions, sql` and `) : undefined

  // 1. Total landed spend (from county facts)
  const [totalCountySpendRes] = await db
    .select({ total: sql<string>`SUM(${countyExpenditureFacts.amount})` })
    .from(countyExpenditureFacts)
    .where(whereCounty)

  // Total state spend (from payment facts)
  const [totalPaymentSpendRes] = await db
    .select({ total: sql<string>`SUM(${statePaymentFacts.amount})` })
    .from(statePaymentFacts)
    .where(wherePayment)

  // 2. Entity Counts
  const [agencyCountRes] = await db.select({ count: sql<number>`COUNT(*)` }).from(agencies)
  const [payeeCountRes] = await db.select({ count: sql<number>`COUNT(*)` }).from(payees)

  // 3. Top 5 Agencies (from county facts since we have data there, or payments. We'll use county facts for fallback)
  const topAgencies = await db
    .select({
      agencyId: countyExpenditureFacts.agencyId,
      agencyName: agencies.agencyName,
      totalSpend: sql<string>`SUM(${countyExpenditureFacts.amount})`,
    })
    .from(countyExpenditureFacts)
    .leftJoin(agencies, eq(countyExpenditureFacts.agencyId, agencies.id))
    .where(whereCounty)
    .groupBy(countyExpenditureFacts.agencyId, agencies.agencyName)
    .orderBy(desc(sql`SUM(${countyExpenditureFacts.amount})`))
    .limit(5)

  // 4. Top 5 Payees (from payment facts entirely)
  const topPayees = await db
    .select({
      payeeId: statePaymentFacts.payeeId,
      payeeName: payees.payeeNameRaw,
      totalSpend: sql<string>`SUM(${statePaymentFacts.amount})`,
    })
    .from(statePaymentFacts)
    .leftJoin(payees, eq(statePaymentFacts.payeeId, payees.id))
    .where(wherePayment)
    .groupBy(statePaymentFacts.payeeId, payees.payeeNameRaw)
    .orderBy(desc(sql`SUM(${statePaymentFacts.amount})`))
    .limit(5)

  // 5. Top 5 Categories (from county facts)
  const topCategories = await db
    .select({
      categoryCode: countyExpenditureFacts.expenditureCategoryCode,
      categoryTitle: expenditureCategories.title,
      totalSpend: sql<string>`SUM(${countyExpenditureFacts.amount})`,
    })
    .from(countyExpenditureFacts)
    .leftJoin(
      expenditureCategories,
      eq(countyExpenditureFacts.expenditureCategoryCode, expenditureCategories.code),
    )
    .where(whereCounty)
    .groupBy(countyExpenditureFacts.expenditureCategoryCode, expenditureCategories.title)
    .orderBy(desc(sql`SUM(${countyExpenditureFacts.amount})`))
    .limit(5)

  // Top 5 Counties (from county facts)
  const topCounties = await db
    .select({
      countyId: countyExpenditureFacts.countyId,
      countyName: geographiesCounties.countyName,
      totalSpend: sql<string>`SUM(${countyExpenditureFacts.amount})`,
    })
    .from(countyExpenditureFacts)
    .leftJoin(geographiesCounties, eq(countyExpenditureFacts.countyId, geographiesCounties.id))
    .where(whereCounty)
    .groupBy(countyExpenditureFacts.countyId, geographiesCounties.countyName)
    .orderBy(desc(sql`SUM(${countyExpenditureFacts.amount})`))
    .limit(5)

  // 6. Timeline of total spend by fiscal year (from county facts)
  const timeline = await db
    .select({
      fiscalYear: countyExpenditureFacts.fiscalYear,
      totalSpend: sql<string>`SUM(${countyExpenditureFacts.amount})`,
    })
    .from(countyExpenditureFacts)
    .groupBy(countyExpenditureFacts.fiscalYear)
    .orderBy(desc(countyExpenditureFacts.fiscalYear))
    .limit(10)

  return {
    filters_applied: query,
    data: {
      total_spend: Number(totalCountySpendRes?.total || 0),
      agency_count: Number(agencyCountRes?.count || 0),
      payee_count: Number(payeeCountRes?.count || 0),
      top_agency: topAgencies[0]
        ? {
            agency_id: topAgencies[0].agencyId,
            agency_name: topAgencies[0].agencyName,
            amount: Number(topAgencies[0].totalSpend),
          }
        : null,
      top_payee: topPayees[0]
        ? {
            payee_id: topPayees[0].payeeId,
            payee_name: topPayees[0].payeeName,
            amount: Number(topPayees[0].totalSpend),
          }
        : null,
      top_category: topCategories[0]
        ? {
            category_code: topCategories[0].categoryCode,
            category_title: topCategories[0].categoryTitle,
            amount: Number(topCategories[0].totalSpend),
          }
        : null,
      top_county: topCounties[0]
        ? {
            county_id: topCounties[0].countyId,
            county_name: topCounties[0].countyName,
            amount: Number(topCounties[0].totalSpend),
          }
        : null,
      total_state_spend: Number(totalPaymentSpendRes?.total || 0),
      timeline: timeline.map((t: any) => ({
        fiscal_year: t.fiscalYear,
        amount: Number(t.totalSpend),
      })),
    },
    meta: {
      currency: 'USD',
    },
  }
})
