import { getRouterParam, getValidatedQuery } from 'h3'
import { and, desc, eq, sql } from 'drizzle-orm'
import { useAppDatabase } from '#server/utils/database'
import { paymentCategoryCodeSql } from '#server/utils/explorer'
import { comptrollerObjects, statePaymentFacts } from '#server/database/schema'
import { globalQuerySchema } from '#server/utils/query'

export default defineEventHandler(async (event) => {
  const db = useAppDatabase(event)
  const code = getRouterParam(event, 'code')
  const query = await getValidatedQuery(event, globalQuerySchema.parse)

  if (!code) throw createError({ statusCode: 400, message: 'Missing category_code' })

  const categoryCode = paymentCategoryCodeSql(statePaymentFacts.objectCategoryRaw)
  const conditions = [sql`${categoryCode} = ${code}`]
  if (query.fiscal_year) conditions.push(eq(statePaymentFacts.fiscalYear, query.fiscal_year))
  if (!query.include_confidential) conditions.push(eq(statePaymentFacts.isConfidential, false))
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
