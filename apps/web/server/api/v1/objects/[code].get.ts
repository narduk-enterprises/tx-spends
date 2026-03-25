import { getRouterParam, getValidatedQuery } from 'h3'
import { and, eq, sql } from 'drizzle-orm'
import { useAppDatabase } from '#server/utils/database'
import { comptrollerObjects, statePaymentFacts } from '#server/database/schema'
import { globalQuerySchema } from '#server/utils/query'

export default defineEventHandler(async (event) => {
  const db = useAppDatabase(event)
  const code = getRouterParam(event, 'code')
  const query = await getValidatedQuery(event, globalQuerySchema.parse)

  if (!code) throw createError({ statusCode: 400, message: 'Missing object_code' })

  const [obj] = await db
    .select()
    .from(comptrollerObjects)
    .where(eq(comptrollerObjects.code, code))
    .limit(1)

  if (!obj) throw createError({ statusCode: 404, message: 'Object not found' })

  const conditions = [eq(statePaymentFacts.comptrollerObjectCode, code)]
  if (query.fiscal_year) {
    conditions.push(eq(statePaymentFacts.fiscalYear, query.fiscal_year))
  }
  if (!query.include_confidential) {
    conditions.push(eq(statePaymentFacts.isConfidential, false))
  }

  const [summary] = await db
    .select({
      total_spend: sql<string>`COALESCE(SUM(${statePaymentFacts.amount}), 0)`,
    })
    .from(statePaymentFacts)
    .where(and(...conditions))

  return {
    data: {
      object_code: obj.code,
      object_title: obj.title,
      object_group: obj.objectGroup,
      total_spend: Number(summary?.total_spend || 0),
    },
  }
})
