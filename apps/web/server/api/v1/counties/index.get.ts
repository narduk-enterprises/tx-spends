import { getValidatedQuery } from 'h3'
import { eq, desc, sql, like, and } from 'drizzle-orm'
import { useAppDatabase } from '#server/utils/database'
import { countyExpenditureFacts, geographiesCounties } from '#server/database/schema'
import { globalQuerySchema } from '#server/utils/query'

export default defineEventHandler(async (event) => {
  const query = await getValidatedQuery(event, globalQuerySchema.parse)
  const db = useAppDatabase(event)

  const conditions = []
  if (query.q) {
    conditions.push(like(geographiesCounties.countyName, `%${query.q}%`))
  }
  const whereCountyFilter = conditions.length > 0 ? and(...conditions) : undefined
  const countyFactsConditions = query.fiscal_year
    ? [eq(countyExpenditureFacts.fiscalYear, query.fiscal_year)]
    : []

  const list = await db
    .select({
      county_id: geographiesCounties.id,
      county_name: geographiesCounties.countyName,
      fips_code: geographiesCounties.fipsCode,
      amount: sql<string>`SUM(${countyExpenditureFacts.amount})`,
    })
    .from(geographiesCounties)
    .leftJoin(
      countyExpenditureFacts,
      and(eq(geographiesCounties.id, countyExpenditureFacts.countyId), ...countyFactsConditions),
    )
    .where(whereCountyFilter)
    .groupBy(geographiesCounties.id, geographiesCounties.countyName, geographiesCounties.fipsCode)
    .orderBy(desc(sql`SUM(${countyExpenditureFacts.amount})`))
    .limit(query.limit)
    .offset(query.offset)

  return {
    filters_applied: query,
    data: list.map((c) => ({
      ...c,
      amount: Number(c.amount || 0),
    })),
    meta: { currency: 'USD' },
  }
})
