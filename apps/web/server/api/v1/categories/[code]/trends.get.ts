import { getRouterParam, getValidatedQuery } from 'h3'
import { and, eq, sql } from 'drizzle-orm'
import { useAppDatabase } from '#server/utils/database'
import { paymentCategoryCodeSql } from '#server/utils/explorer'
import { statePaymentFacts } from '#server/database/schema'
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
