import { getRouterParam, getValidatedQuery } from 'h3'
import { eq, desc, sql, and } from 'drizzle-orm'
import { useAppDatabase } from '#server/utils/database'
import { countyExpenditureFacts, agencies } from '#server/database/schema'
import { globalQuerySchema } from '#server/utils/query'

export default defineEventHandler(async (event) => {
  const db = useAppDatabase(event)
  const id = getRouterParam(event, 'id')
  const query = await getValidatedQuery(event, globalQuerySchema.parse)

  if (!id) throw createError({ statusCode: 400, message: 'Missing county_id' })

  const conditions = [eq(countyExpenditureFacts.countyId, id)]
  if (query.fiscal_year) conditions.push(eq(countyExpenditureFacts.fiscalYear, query.fiscal_year))
  const whereClause = and(...conditions)

  const topAgencies = await db
    .select({
      agency_id: countyExpenditureFacts.agencyId,
      agency_name: agencies.agencyName,
      amount: sql<string>`SUM(${countyExpenditureFacts.amount})`,
    })
    .from(countyExpenditureFacts)
    .leftJoin(agencies, eq(countyExpenditureFacts.agencyId, agencies.id))
    .where(whereClause)
    .groupBy(countyExpenditureFacts.agencyId, agencies.agencyName)
    .orderBy(desc(sql`SUM(${countyExpenditureFacts.amount})`))
    .limit(query.limit)
    .offset(query.offset)

  return {
    filters_applied: query,
    data: topAgencies.map((t: any) => ({
      ...t,
      amount: Number(t.amount || 0),
    })),
    meta: { currency: 'USD' },
  }
})
