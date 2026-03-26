import { getRouterParam, getValidatedQuery } from 'h3'
import { eq, desc, sql, and } from 'drizzle-orm'
import { useAppDatabase } from '#server/utils/database'
import { formatCategoryDisplayName, slugifyCategory } from '#server/utils/explorer'
import { statePaymentFacts } from '#server/database/schema'
import { globalQuerySchema } from '#server/utils/query'

export default defineEventHandler(async (event) => {
  const db = useAppDatabase(event)
  const payeeId = getRouterParam(event, 'payeeId')
  const query = await getValidatedQuery(event, globalQuerySchema.parse)

  if (!payeeId) throw createError({ statusCode: 400, message: 'Missing payee_id' })

  const conditions = [eq(statePaymentFacts.payeeId, payeeId)]
  if (query.fiscal_year) conditions.push(eq(statePaymentFacts.fiscalYear, query.fiscal_year))
  if (!query.include_confidential) {
    conditions.push(eq(statePaymentFacts.isConfidential, false))
  }
  const whereClause = and(...conditions)

  const categories = await db
    .select({
      category_raw: statePaymentFacts.objectCategoryRaw,
      amount: sql<string>`SUM(${statePaymentFacts.amount})`,
    })
    .from(statePaymentFacts)
    .where(whereClause)
    .groupBy(statePaymentFacts.objectCategoryRaw)
    .orderBy(desc(sql`SUM(${statePaymentFacts.amount})`))
    .limit(query.limit)
    .offset(query.offset)

  return {
    filters_applied: query,
    data: categories.map((category: any) => ({
      category_code: slugifyCategory(category.category_raw, 'uncategorized'),
      category_title: formatCategoryDisplayName(category.category_raw, 'Uncategorized'),
      amount: Number(category.amount || 0),
    })),
    meta: { currency: 'USD' },
  }
})
