import { getValidatedQuery } from 'h3'
import { eq, desc, sql, like, and } from 'drizzle-orm'
import { useAppDatabase } from '#server/utils/database'
import { statePaymentFacts, comptrollerObjects } from '#server/database/schema'
import { globalQuerySchema } from '#server/utils/query'

export default defineEventHandler(async (event) => {
  const query = await getValidatedQuery(event, globalQuerySchema.parse)
  const db = useAppDatabase(event)

  const conditions = []
  if (query.q) {
    conditions.push(like(comptrollerObjects.title, `%${query.q}%`))
  }
  const whereObj = conditions.length > 0 ? and(...conditions) : undefined
  const paymentConditions = query.fiscal_year
    ? [eq(statePaymentFacts.fiscalYear, query.fiscal_year)]
    : []

  const list = await db
    .select({
      object_code: comptrollerObjects.code,
      object_title: comptrollerObjects.title,
      amount: sql<string>`SUM(${statePaymentFacts.amount})`,
    })
    .from(comptrollerObjects)
    .leftJoin(
      statePaymentFacts,
      and(
        eq(comptrollerObjects.code, statePaymentFacts.comptrollerObjectCode),
        ...paymentConditions,
      ),
    )
    .where(whereObj)
    .groupBy(comptrollerObjects.code, comptrollerObjects.title)
    .orderBy(desc(sql`SUM(${statePaymentFacts.amount})`))
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
