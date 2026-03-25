import { getRouterParam, getValidatedQuery } from 'h3'
import { and, eq, sql } from 'drizzle-orm'
import { useAppDatabase } from '#server/utils/database'
import { statePaymentFacts } from '#server/database/schema'
import { globalQuerySchema } from '#server/utils/query'

export default defineEventHandler(async (event) => {
  const db = useAppDatabase(event)
  const id = getRouterParam(event, 'id')
  const query = await getValidatedQuery(event, globalQuerySchema.parse)

  if (!id) throw createError({ statusCode: 400, message: 'Missing agency_id' })

  const conditions = [eq(statePaymentFacts.agencyId, id)]
  if (query.fiscal_year) conditions.push(eq(statePaymentFacts.fiscalYear, query.fiscal_year))
  if (!query.include_confidential) conditions.push(eq(statePaymentFacts.isConfidential, false))
  const whereClause = and(...conditions)

  const trends = await db
    .select({
      fiscal_year: statePaymentFacts.fiscalYear,
      amount: sql<string>`SUM(${statePaymentFacts.amount})`,
    })
    .from(statePaymentFacts)
    .where(whereClause)
    .groupBy(statePaymentFacts.fiscalYear)
    .orderBy(statePaymentFacts.fiscalYear)

  return {
    filters_applied: query,
    data: trends.map((t: any) => ({
      ...t,
      amount: Number(t.amount || 0),
    })),
    meta: { currency: 'USD' },
  }
})
