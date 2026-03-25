import { getValidatedQuery } from 'h3'
import { and, desc, eq, like, sql } from 'drizzle-orm'
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

  const countyTotals = await db
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
    .having(sql`COALESCE(SUM(${countyExpenditureFacts.amount}), 0) > 0`)
    .orderBy(desc(sql`COALESCE(SUM(${countyExpenditureFacts.amount}), 0)`))

  return {
    filters_applied: query,
    data: countyTotals.map((county) => ({
      ...county,
      county_name: formatCountyDisplayName(county.county_name, 'Unknown'),
      amount: Number(county.amount || 0),
    })),
    meta: {
      currency: 'USD',
      returned: countyTotals.length,
      total: countyTotals.length,
    },
  }
})
