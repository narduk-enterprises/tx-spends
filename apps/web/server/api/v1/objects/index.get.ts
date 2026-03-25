import { getValidatedQuery } from 'h3'
import { and, asc, desc, eq, like, or, sql } from 'drizzle-orm'
import { useAppDatabase } from '#server/utils/database'
import { comptrollerObjects, paymentObjectRollups } from '#server/database/schema'
import { getPaymentsBackfillStatus } from '#server/utils/payments-backfill'
import { getRollupScopeFiscalYear } from '#server/utils/payment-rollups'
import { globalQuerySchema } from '#server/utils/query'

export default defineEventHandler(async (event) => {
  const query = await getValidatedQuery(event, globalQuerySchema.parse)
  const db = useAppDatabase(event)
  const searchTerm = query.q?.trim()
  const paymentsBackfill = await getPaymentsBackfillStatus(db)
  const scopeFiscalYear = getRollupScopeFiscalYear(query.fiscal_year)
  const amountColumn = query.include_confidential
    ? paymentObjectRollups.totalAmountAll
    : paymentObjectRollups.totalAmountPublic

  const conditions = [eq(paymentObjectRollups.scopeFiscalYear, scopeFiscalYear)]
  if (searchTerm) {
    conditions.push(
      or(
        like(comptrollerObjects.code, `%${searchTerm}%`),
        like(comptrollerObjects.title, `%${searchTerm}%`),
      )!,
    )
  }

  const whereClause = and(...conditions)
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

  const list = await db
    .select({
      object_code: comptrollerObjects.code,
      object_title: comptrollerObjects.title,
      object_group: comptrollerObjects.objectGroup,
      amount: amountColumn,
    })
    .from(paymentObjectRollups)
    .innerJoin(comptrollerObjects, eq(comptrollerObjects.code, paymentObjectRollups.objectCode))
    .where(whereClause)
    .orderBy(
      ...(searchTerm
        ? [asc(relevanceSql), desc(amountColumn), asc(comptrollerObjects.code)]
        : [desc(amountColumn), asc(comptrollerObjects.code)]),
    )
    .limit(query.limit)
    .offset(query.offset)

  const [summary] = await db
    .select({
      total: sql<number>`COUNT(*)`,
    })
    .from(paymentObjectRollups)
    .innerJoin(comptrollerObjects, eq(comptrollerObjects.code, paymentObjectRollups.objectCode))
    .where(whereClause)

  return {
    filters_applied: query,
    data: list.map((object) => ({
      ...object,
      amount: Number(object.amount || 0),
    })),
    meta: {
      currency: 'USD',
      limit: query.limit,
      offset: query.offset,
      returned: list.length,
      total: Number(summary?.total || 0),
      payments_backfill_active: paymentsBackfill.active,
      payments_backfill: paymentsBackfill,
    },
  }
})
