import { getRouterParam, getValidatedQuery } from 'h3'
import { eq, desc, sql, and } from 'drizzle-orm'
import { useAppDatabase } from '#server/utils/database'
import { statePaymentFacts, comptrollerObjects } from '#server/database/schema'
import { globalQuerySchema } from '#server/utils/query'

export default defineEventHandler(async (event) => {
  const db = useAppDatabase(event)
  const agencyId = getRouterParam(event, 'agencyId')
  const query = await getValidatedQuery(event, globalQuerySchema.parse)

  if (!agencyId) throw createError({ statusCode: 400, message: 'Missing agency_id' })

  const conditions = [eq(statePaymentFacts.agencyId, agencyId)]
  if (query.fiscal_year) conditions.push(eq(statePaymentFacts.fiscalYear, query.fiscal_year))
  const whereClause = and(...conditions)

  const objects = await db
    .select({
      object_code: statePaymentFacts.comptrollerObjectCode,
      object_title: comptrollerObjects.title,
      amount: sql<string>`SUM(${statePaymentFacts.amount})`,
    })
    .from(statePaymentFacts)
    .leftJoin(
      comptrollerObjects,
      eq(statePaymentFacts.comptrollerObjectCode, comptrollerObjects.code),
    )
    .where(whereClause)
    .groupBy(statePaymentFacts.comptrollerObjectCode, comptrollerObjects.title)
    .orderBy(desc(sql`SUM(${statePaymentFacts.amount})`))
    .limit(query.limit)
    .offset(query.offset)

  return {
    filters_applied: query,
    data: objects.map((t) => ({
      ...t,
      amount: Number(t.amount || 0),
    })),
    meta: { currency: 'USD' },
  }
})
