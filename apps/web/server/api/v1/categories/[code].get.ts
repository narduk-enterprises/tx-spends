import { getRouterParam, getValidatedQuery } from 'h3'
import { and, eq, sql } from 'drizzle-orm'
import { useAppDatabase } from '#server/utils/database'
import {
  normalizeSearchTerm,
  paymentCategoryCodeSql,
  paymentCategoryTitleSql,
} from '#server/utils/explorer'
import { agencies, payees, statePaymentFacts } from '#server/database/schema'
import { globalQuerySchema } from '#server/utils/query'

export default defineEventHandler(async (event) => {
  const db = useAppDatabase(event)
  const code = getRouterParam(event, 'code')
  const query = await getValidatedQuery(event, globalQuerySchema.parse)

  if (!code) throw createError({ statusCode: 400, message: 'Missing category_code' })

  const categoryCode = paymentCategoryCodeSql(statePaymentFacts.objectCategoryRaw)
  const categoryTitle = paymentCategoryTitleSql(statePaymentFacts.objectCategoryRaw)
  const conditions = [sql`${categoryCode} = ${code}`]
  if (query.fiscal_year) {
    conditions.push(eq(statePaymentFacts.fiscalYear, query.fiscal_year))
  }
  if (!query.include_confidential) {
    conditions.push(eq(statePaymentFacts.isConfidential, false))
  }
  const whereClause = and(...conditions)

  const [summary] = await db
    .select({
      category_code: categoryCode,
      category_title: categoryTitle,
      total_spend: sql<string>`COALESCE(SUM(${statePaymentFacts.amount}), 0)`,
      agency_count: sql<number>`COUNT(DISTINCT ${statePaymentFacts.agencyId})`,
      payee_count: sql<number>`COUNT(DISTINCT ${statePaymentFacts.payeeId})`,
    })
    .from(statePaymentFacts)
    .where(whereClause)
    .groupBy(categoryCode, categoryTitle)

  if (!summary) {
    throw createError({ statusCode: 404, message: 'Category not found' })
  }

  return {
    data: {
      category_code: summary.category_code,
      category_title: summary.category_title,
      total_spend: Number(summary.total_spend || 0),
      agency_count: Number(summary.agency_count || 0),
      payee_count: Number(summary.payee_count || 0),
    },
  }
})
