import { getRouterParam, getValidatedQuery } from 'h3'
import { and, eq, sql } from 'drizzle-orm'
import { useAppDatabase } from '#server/utils/database'
import { paymentCategoryRollups } from '#server/database/schema'
import { ROLLUP_ALL_YEARS } from '#server/utils/payment-rollups'
import { globalQuerySchema } from '#server/utils/query'

export default defineEventHandler(async (event) => {
  const db = useAppDatabase(event)
  const code = getRouterParam(event, 'code')
  const query = await getValidatedQuery(event, globalQuerySchema.parse)

  if (!code) {
    throw createError({ statusCode: 400, message: 'Missing category_code' })
  }

  const amountColumn = query.include_confidential
    ? paymentCategoryRollups.totalAmountAll
    : paymentCategoryRollups.totalAmountPublic
  const conditions = [eq(paymentCategoryRollups.categoryCode, code)]

  if (query.fiscal_year) {
    conditions.push(eq(paymentCategoryRollups.scopeFiscalYear, query.fiscal_year))
  } else {
    conditions.push(sql`${paymentCategoryRollups.scopeFiscalYear} <> ${ROLLUP_ALL_YEARS}`)
  }

  const trends = await db
    .select({
      fiscal_year: paymentCategoryRollups.scopeFiscalYear,
      amount: amountColumn,
    })
    .from(paymentCategoryRollups)
    .where(and(...conditions))
    .orderBy(paymentCategoryRollups.scopeFiscalYear)

  return {
    filters_applied: query,
    data: trends.map((trend) => ({
      ...trend,
      amount: Number(trend.amount || 0),
    })),
    meta: { currency: 'USD' },
  }
})
