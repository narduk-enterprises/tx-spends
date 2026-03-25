import { getRouterParam, getValidatedQuery } from 'h3'
import { and, eq, sql } from 'drizzle-orm'
import { useAppDatabase } from '#server/utils/database'
import { paymentPayeeRollups } from '#server/database/schema'
import { ROLLUP_ALL_YEARS } from '#server/utils/payment-rollups'
import { globalQuerySchema } from '#server/utils/query'

export default defineEventHandler(async (event) => {
  const db = useAppDatabase(event)
  const id = getRouterParam(event, 'id')
  const query = await getValidatedQuery(event, globalQuerySchema.parse)

  if (!id) {
    throw createError({ statusCode: 400, message: 'Missing payee_id' })
  }

  const amountColumn = query.include_confidential
    ? paymentPayeeRollups.totalAmountAll
    : paymentPayeeRollups.totalAmountPublic
  const conditions = [eq(paymentPayeeRollups.payeeId, id)]

  if (query.fiscal_year) {
    conditions.push(eq(paymentPayeeRollups.scopeFiscalYear, query.fiscal_year))
  } else {
    conditions.push(sql`${paymentPayeeRollups.scopeFiscalYear} <> ${ROLLUP_ALL_YEARS}`)
  }

  const trends = await db
    .select({
      fiscal_year: paymentPayeeRollups.scopeFiscalYear,
      amount: amountColumn,
    })
    .from(paymentPayeeRollups)
    .where(and(...conditions))
    .orderBy(paymentPayeeRollups.scopeFiscalYear)

  return {
    filters_applied: query,
    data: trends.map((trend) => ({
      ...trend,
      amount: Number(trend.amount || 0),
    })),
    meta: { currency: 'USD' },
  }
})
