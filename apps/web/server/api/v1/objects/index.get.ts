import { getValidatedQuery } from 'h3'
import { and, asc, desc, eq, like, or, sql } from 'drizzle-orm'
import { useAppDatabase } from '#server/utils/database'
import { statePaymentFacts, comptrollerObjects } from '#server/database/schema'
import { isPaymentsBackfillActive } from '#server/utils/payments-backfill'
import { globalQuerySchema } from '#server/utils/query'

export default defineEventHandler(async (event) => {
  const query = await getValidatedQuery(event, globalQuerySchema.parse)
  const db = useAppDatabase(event)
  const searchTerm = query.q?.trim()
  const paymentsBackfillActive = await isPaymentsBackfillActive(db)

  const conditions = []
  if (searchTerm) {
    conditions.push(
      or(
        like(comptrollerObjects.code, `%${searchTerm}%`),
        like(comptrollerObjects.title, `%${searchTerm}%`),
      )!,
    )
  }
  const whereObj = conditions.length > 0 ? and(...conditions) : undefined
  const paymentConditions = query.fiscal_year
    ? [eq(statePaymentFacts.fiscalYear, query.fiscal_year)]
    : []
  const amountSql = sql`COALESCE(SUM(${statePaymentFacts.amount}), 0)`
  const relevanceSql = searchTerm
    ? sql<number>`CASE
        WHEN ${comptrollerObjects.code} = ${searchTerm} THEN 0
        WHEN ${comptrollerObjects.code} LIKE ${`${searchTerm}%`} THEN 1
        WHEN ${comptrollerObjects.title} LIKE ${`${searchTerm}%`} THEN 2
        WHEN ${comptrollerObjects.code} LIKE ${`%${searchTerm}%`} THEN 3
        WHEN ${comptrollerObjects.title} LIKE ${`%${searchTerm}%`} THEN 4
        ELSE 5
      END`
    : sql<number>`0`

  const list = paymentsBackfillActive
    ? await db
        .select({
          object_code: comptrollerObjects.code,
          object_title: comptrollerObjects.title,
          object_group: comptrollerObjects.objectGroup,
          amount: sql<string>`0`,
        })
        .from(comptrollerObjects)
        .where(whereObj)
        .orderBy(
          ...(searchTerm
            ? [asc(relevanceSql), asc(comptrollerObjects.code)]
            : [asc(comptrollerObjects.code)]),
        )
        .limit(query.limit)
        .offset(query.offset)
    : await db
        .select({
          object_code: comptrollerObjects.code,
          object_title: comptrollerObjects.title,
          object_group: comptrollerObjects.objectGroup,
          amount: sql<string>`${amountSql}`,
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
        .groupBy(comptrollerObjects.code, comptrollerObjects.title, comptrollerObjects.objectGroup)
        .orderBy(
          ...(searchTerm
            ? [asc(relevanceSql), desc(amountSql), asc(comptrollerObjects.code)]
            : [desc(amountSql)]),
        )
        .limit(query.limit)
        .offset(query.offset)

  const [summary] = paymentsBackfillActive
    ? await db
        .select({
          total: sql<number>`COUNT(DISTINCT ${comptrollerObjects.code})`,
        })
        .from(comptrollerObjects)
        .where(whereObj)
    : await db
        .select({
          total: sql<number>`COUNT(DISTINCT ${comptrollerObjects.code})`,
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

  return {
    filters_applied: query,
    data: list.map((c) => ({
      ...c,
      amount: Number(c.amount || 0),
    })),
    meta: {
      currency: 'USD',
      limit: query.limit,
      offset: query.offset,
      returned: list.length,
      total: Number(summary?.total || 0),
      payments_backfill_active: paymentsBackfillActive,
    },
  }
})
