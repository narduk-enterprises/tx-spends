import { getRouterParam, getValidatedQuery } from 'h3'
import { eq, desc, sql, and } from 'drizzle-orm'
import { useAppDatabase } from '#server/utils/database'
import { countyExpenditureFacts } from '#server/database/schema'
import { globalQuerySchema } from '#server/utils/query'

export default defineEventHandler(async (event) => {
  const db = useAppDatabase(event)
  const id = getRouterParam(event, 'id')
  const query = await getValidatedQuery(event, globalQuerySchema.parse)

  if (!id) throw createError({ statusCode: 400, message: 'Missing county_id' })

  const conditions = [eq(countyExpenditureFacts.countyId, id)]
  if (query.fiscal_year) {
    conditions.push(eq(countyExpenditureFacts.fiscalYear, query.fiscal_year))
  }
  const whereClause = and(...conditions)

  const trends = await db
    .select({
      fiscal_year: countyExpenditureFacts.fiscalYear,
      amount: sql<string>`SUM(${countyExpenditureFacts.amount})`,
    })
    .from(countyExpenditureFacts)
    .where(whereClause)
    .groupBy(countyExpenditureFacts.fiscalYear)
    .orderBy(countyExpenditureFacts.fiscalYear)

  return {
    filters_applied: query,
    data: trends.map((t: any) => ({
      ...t,
      amount: Number(t.amount || 0),
    })),
    meta: { currency: 'USD' },
  }
})
