import { getRouterParam, getValidatedQuery } from 'h3'
import { eq, desc, sql, and } from 'drizzle-orm'
import { useAppDatabase } from '#server/utils/database'
import { countyExpenditureFacts, geographiesCounties } from '#server/database/schema'
import { formatCountyDisplayName } from '#server/utils/explorer'
import { globalQuerySchema } from '#server/utils/query'

export default defineEventHandler(async (event) => {
  const db = useAppDatabase(event)
  const id = getRouterParam(event, 'id')
  const query = await getValidatedQuery(event, globalQuerySchema.parse)

  if (!id) throw createError({ statusCode: 400, message: 'Missing agency_id' })

  const conditions = [eq(countyExpenditureFacts.agencyId, id)]
  if (query.fiscal_year) conditions.push(eq(countyExpenditureFacts.fiscalYear, query.fiscal_year))
  const whereClause = and(...conditions)

  const countyBreakdown = await db
    .select({
      county_id: countyExpenditureFacts.countyId,
      county_name: geographiesCounties.countyName,
      amount: sql<string>`SUM(${countyExpenditureFacts.amount})`,
    })
    .from(countyExpenditureFacts)
    .leftJoin(geographiesCounties, eq(countyExpenditureFacts.countyId, geographiesCounties.id))
    .where(whereClause)
    .groupBy(countyExpenditureFacts.countyId, geographiesCounties.countyName)
    .orderBy(desc(sql`SUM(${countyExpenditureFacts.amount})`))
    .limit(query.limit)
    .offset(query.offset)

  return {
    filters_applied: query,
    data: countyBreakdown.map((t: any) => ({
      ...t,
      county_name: formatCountyDisplayName(t.county_name, 'Unknown'),
      amount: Number(t.amount || 0),
    })),
    meta: { currency: 'USD' },
  }
})
