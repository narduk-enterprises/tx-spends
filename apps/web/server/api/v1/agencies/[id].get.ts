import { getRouterParam, getValidatedQuery } from 'h3'
import { and, desc, eq, sql } from 'drizzle-orm'
import { useAppDatabase } from '#server/utils/database'
import { agencies, comptrollerObjects, payees, statePaymentFacts } from '#server/database/schema'
import { globalQuerySchema } from '#server/utils/query'

export default defineEventHandler(async (event) => {
  const db = useAppDatabase(event)
  const id = getRouterParam(event, 'id')
  const query = await getValidatedQuery(event, globalQuerySchema.parse)

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Missing agency_id',
    })
  }

  const [agency] = await db.select().from(agencies).where(eq(agencies.id, id)).limit(1)

  if (!agency) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: 'Agency not found',
    })
  }

  const conditions = [eq(statePaymentFacts.agencyId, id)]
  if (query.fiscal_year) {
    conditions.push(eq(statePaymentFacts.fiscalYear, query.fiscal_year))
  }
  if (!query.include_confidential) {
    conditions.push(eq(statePaymentFacts.isConfidential, false))
  }
  const whereClause = and(...conditions)

  const [summary] = await db
    .select({
      total_spend: sql<string>`COALESCE(SUM(${statePaymentFacts.amount}), 0)`,
      payment_count: sql<number>`COUNT(${statePaymentFacts.sourceRowHash})`,
      distinct_payee_count: sql<number>`COUNT(DISTINCT ${statePaymentFacts.payeeId})`,
    })
    .from(statePaymentFacts)
    .where(whereClause)

  const [topPayee] = await db
    .select({
      payee_id: statePaymentFacts.payeeId,
      payee_name: payees.payeeNameRaw,
      amount: sql<string>`COALESCE(SUM(${statePaymentFacts.amount}), 0)`,
    })
    .from(statePaymentFacts)
    .leftJoin(payees, eq(statePaymentFacts.payeeId, payees.id))
    .where(whereClause)
    .groupBy(statePaymentFacts.payeeId, payees.payeeNameRaw)
    .orderBy(desc(sql`COALESCE(SUM(${statePaymentFacts.amount}), 0)`))
    .limit(1)

  const [topObject] = await db
    .select({
      object_code: statePaymentFacts.comptrollerObjectCode,
      object_title: comptrollerObjects.title,
      amount: sql<string>`COALESCE(SUM(${statePaymentFacts.amount}), 0)`,
    })
    .from(statePaymentFacts)
    .leftJoin(
      comptrollerObjects,
      eq(statePaymentFacts.comptrollerObjectCode, comptrollerObjects.code),
    )
    .where(whereClause)
    .groupBy(statePaymentFacts.comptrollerObjectCode, comptrollerObjects.title)
    .orderBy(desc(sql`COALESCE(SUM(${statePaymentFacts.amount}), 0)`))
    .limit(1)

  const trendRows = await db
    .select({
      fiscal_year: statePaymentFacts.fiscalYear,
      amount: sql<string>`COALESCE(SUM(${statePaymentFacts.amount}), 0)`,
    })
    .from(statePaymentFacts)
    .where(and(eq(statePaymentFacts.agencyId, id), eq(statePaymentFacts.isConfidential, false)))
    .groupBy(statePaymentFacts.fiscalYear)
    .orderBy(desc(statePaymentFacts.fiscalYear))
    .limit(2)

  const currentAmount = Number(trendRows[0]?.amount || 0)
  const previousAmount = Number(trendRows[1]?.amount || 0)
  const yoyChangePct =
    previousAmount > 0 ? ((currentAmount - previousAmount) / previousAmount) * 100 : null

  return {
    data: {
      agency_id: agency.id,
      agency_code: agency.agencyCode,
      agency_name: agency.agencyName,
      agency_name_normalized: agency.agencyNameNormalized,
      total_spend: Number(summary?.total_spend || 0),
      payment_count: Number(summary?.payment_count || 0),
      distinct_payee_count: Number(summary?.distinct_payee_count || 0),
      top_payee: topPayee
        ? {
            payee_id: topPayee.payee_id,
            payee_name: topPayee.payee_name,
            amount: Number(topPayee.amount || 0),
          }
        : null,
      top_object: topObject
        ? {
            object_code: topObject.object_code,
            object_title: topObject.object_title,
            amount: Number(topObject.amount || 0),
          }
        : null,
      yoy_change_pct: yoyChangePct,
    },
  }
})
