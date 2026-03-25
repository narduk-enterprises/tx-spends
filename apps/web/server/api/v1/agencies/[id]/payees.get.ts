import { getRouterParam, getValidatedQuery } from 'h3'
import { eq, desc, sql, and } from 'drizzle-orm'
import { useAppDatabase } from '#server/utils/database'
import { statePaymentFacts, payees } from '#server/database/schema'
import { globalQuerySchema } from '#server/utils/query'

export default defineEventHandler(async (event) => {
  const db = useAppDatabase(event)
  const id = getRouterParam(event, 'id')
  const query = await getValidatedQuery(event, globalQuerySchema.parse)

  if (!id) throw createError({ statusCode: 400, message: 'Missing agency_id' })

  const conditions = [eq(statePaymentFacts.agencyId, id)]
  if (query.fiscal_year) conditions.push(eq(statePaymentFacts.fiscalYear, query.fiscal_year))
  const whereClause = and(...conditions)

  const topPayees = await db
    .select({
      payee_id: statePaymentFacts.payeeId,
      payee_name: payees.payeeNameRaw,
      amount: sql<string>`SUM(${statePaymentFacts.amount})`,
    })
    .from(statePaymentFacts)
    .leftJoin(payees, eq(statePaymentFacts.payeeId, payees.id))
    .where(whereClause)
    .groupBy(statePaymentFacts.payeeId, payees.payeeNameRaw)
    .orderBy(desc(sql`SUM(${statePaymentFacts.amount})`))
    .limit(query.limit)
    .offset(query.offset)

  return {
    filters_applied: query,
    data: topPayees.map((t) => ({
      ...t,
      amount: Number(t.amount || 0),
    })),
    meta: { currency: 'USD' },
  }
})
