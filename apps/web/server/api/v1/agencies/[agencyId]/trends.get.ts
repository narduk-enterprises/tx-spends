import { getRouterParam, getValidatedQuery } from 'h3'
import { and, eq, sql } from 'drizzle-orm'
import { useAppDatabase } from '#server/utils/database'
import { paymentAgencyRollups } from '#server/database/schema'
import { ROLLUP_ALL_YEARS } from '#server/utils/payment-rollups'
import { globalQuerySchema } from '#server/utils/query'

export default defineEventHandler(async (event) => {
  const db = useAppDatabase(event)
  const agencyId = getRouterParam(event, 'agencyId')
  const query = await getValidatedQuery(event, globalQuerySchema.parse)

  if (!agencyId) {
    throw createError({ statusCode: 400, message: 'Missing agency_id' })
  }

  const amountColumn = query.include_confidential
    ? paymentAgencyRollups.totalSpendAll
    : paymentAgencyRollups.totalSpendPublic
  const conditions = [eq(paymentAgencyRollups.agencyId, agencyId)]

  if (query.fiscal_year) {
    conditions.push(eq(paymentAgencyRollups.scopeFiscalYear, query.fiscal_year))
  } else {
    conditions.push(sql`${paymentAgencyRollups.scopeFiscalYear} <> ${ROLLUP_ALL_YEARS}`)
  }

  const trends = await db
    .select({
      fiscal_year: paymentAgencyRollups.scopeFiscalYear,
      amount: amountColumn,
    })
    .from(paymentAgencyRollups)
    .where(and(...conditions))
    .orderBy(paymentAgencyRollups.scopeFiscalYear)

  return {
    filters_applied: query,
    data: trends.map((trend) => ({
      ...trend,
      amount: Number(trend.amount || 0),
    })),
    meta: { currency: 'USD' },
  }
})
