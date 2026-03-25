import { getValidatedQuery } from 'h3'
import { and, asc, desc, eq, like, sql } from 'drizzle-orm'
import { useAppDatabase } from '#server/utils/database'
import { countyCategoryCodeSql, formatCountyDisplayName } from '#server/utils/explorer'
import { countyExpenditureFacts, geographiesCounties } from '#server/database/schema'
import { globalQuerySchema } from '#server/utils/query'

export default defineEventHandler(async (event) => {
  const query = await getValidatedQuery(event, globalQuerySchema.parse)
  const db = useAppDatabase(event)

  const conditions = []
  const countyFactsConditions = []
  if (query.q) {
    conditions.push(like(geographiesCounties.countyName, `%${query.q}%`))
  }
  if (query.fiscal_year) {
    countyFactsConditions.push(eq(countyExpenditureFacts.fiscalYear, query.fiscal_year))
  }
  if (query.agency_id) {
    countyFactsConditions.push(eq(countyExpenditureFacts.agencyId, query.agency_id))
  }
  if (query.category_code) {
    const countyCategoryCode = countyCategoryCodeSql(countyExpenditureFacts.expenditureTypeRaw)
    countyFactsConditions.push(sql`${countyCategoryCode} = ${query.category_code}`)
  }

  const whereCountyFilter = conditions.length > 0 ? and(...conditions) : undefined

  const countyTotals = db.$with('county_totals').as(
    db
      .select({
        county_id: geographiesCounties.id,
        county_name: geographiesCounties.countyName,
        fips_code: geographiesCounties.fipsCode,
        amount: sql<number>`COALESCE(SUM(${countyExpenditureFacts.amount}), 0)`.as('amount'),
      })
      .from(geographiesCounties)
      .leftJoin(
        countyExpenditureFacts,
        and(eq(geographiesCounties.id, countyExpenditureFacts.countyId), ...countyFactsConditions),
      )
      .where(whereCountyFilter)
      .groupBy(geographiesCounties.id, geographiesCounties.countyName, geographiesCounties.fipsCode)
      .having(sql`COALESCE(SUM(${countyExpenditureFacts.amount}), 0) > 0`),
  )

  const orderBy =
    query.sort === 'county_name'
      ? query.order === 'asc'
        ? asc(countyTotals.county_name)
        : desc(countyTotals.county_name)
      : query.sort === 'fips_code'
        ? query.order === 'asc'
          ? asc(countyTotals.fips_code)
          : desc(countyTotals.fips_code)
        : query.order === 'asc'
          ? asc(countyTotals.amount)
          : desc(countyTotals.amount)

  const list = await db
    .with(countyTotals)
    .select()
    .from(countyTotals)
    .orderBy(orderBy)
    .limit(query.limit)
    .offset(query.offset)

  const [summary] = await db
    .with(countyTotals)
    .select({
      total: sql<number>`COUNT(*)`,
    })
    .from(countyTotals)

  const fiscalYears = await db
    .select({
      fiscal_year: countyExpenditureFacts.fiscalYear,
    })
    .from(countyExpenditureFacts)
    .groupBy(countyExpenditureFacts.fiscalYear)
    .orderBy(desc(countyExpenditureFacts.fiscalYear))

  return {
    filters_applied: query,
    data: list.map((c) => ({
      ...c,
      county_name: formatCountyDisplayName(c.county_name, 'Unknown'),
      amount: Number(c.amount || 0),
    })),
    meta: {
      currency: 'USD',
      limit: query.limit,
      offset: query.offset,
      returned: list.length,
      total: Number(summary?.total || 0),
      available_fiscal_years: fiscalYears
        .map((entry) => entry.fiscal_year)
        .filter((value): value is number => Number.isFinite(value)),
    },
  }
})
