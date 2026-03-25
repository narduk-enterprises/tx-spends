import { getValidatedQuery } from 'h3'
import { and, asc, desc, eq, isNotNull, like, sql } from 'drizzle-orm'
import { useAppDatabase } from '#server/utils/database'
import { payeeVendorMatches, payees, statePaymentFacts } from '#server/database/schema'
import { isPaymentsBackfillActive } from '#server/utils/payments-backfill'
import { globalQuerySchema } from '#server/utils/query'

export default defineEventHandler(async (event) => {
  const query = await getValidatedQuery(event, globalQuerySchema.parse)
  const db = useAppDatabase(event)

  if (await isPaymentsBackfillActive(db)) {
    return {
      filters_applied: query,
      data: [],
      meta: {
        currency: 'USD',
        limit: query.limit,
        offset: query.offset,
        returned: 0,
        total: 0,
        payments_backfill_active: true,
      },
    }
  }

  const conditions = []
  if (query.q) {
    conditions.push(
      like(payees.payeeNameNormalized, `%${query.q.toUpperCase().replaceAll(/[^A-Z0-9 ]/g, '')}%`),
    )
  }
  if (query.fiscal_year) {
    conditions.push(eq(statePaymentFacts.fiscalYear, query.fiscal_year))
  }
  if (!query.include_confidential) {
    conditions.push(eq(payees.isConfidential, false))
  }
  if (query.matched_vendor_only) {
    conditions.push(isNotNull(payeeVendorMatches.id))
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined
  const spendMetric = sql`COALESCE(SUM(${statePaymentFacts.amount}), 0)`
  const agencyCountMetric = sql`COUNT(DISTINCT ${statePaymentFacts.agencyId})`
  const sortColumn =
    query.sort === 'payee_name'
      ? payees.payeeNameRaw
      : query.sort === 'agency_count'
        ? agencyCountMetric
        : spendMetric
  const orderDirection = query.order === 'asc' ? asc : desc

  const list = await db
    .select({
      payee_id: payees.id,
      payee_name: payees.payeeNameRaw,
      is_confidential: payees.isConfidential,
      amount: sql<string>`COALESCE(SUM(${statePaymentFacts.amount}), 0)`,
      agency_count: sql<number>`COUNT(DISTINCT ${statePaymentFacts.agencyId})`,
      matched_vendor: sql<boolean>`MAX(CASE WHEN ${payeeVendorMatches.id} IS NOT NULL THEN 1 ELSE 0 END) = 1`,
    })
    .from(statePaymentFacts)
    .innerJoin(payees, eq(payees.id, statePaymentFacts.payeeId))
    .leftJoin(payeeVendorMatches, eq(payees.id, payeeVendorMatches.payeeId))
    .where(whereClause)
    .groupBy(payees.id, payees.payeeNameRaw, payees.isConfidential)
    .orderBy(orderDirection(sortColumn), asc(payees.payeeNameRaw))
    .limit(query.limit)
    .offset(query.offset)

  const [summary] = await db
    .select({
      total: sql<number>`COUNT(DISTINCT ${statePaymentFacts.payeeId})`,
    })
    .from(statePaymentFacts)
    .innerJoin(payees, eq(payees.id, statePaymentFacts.payeeId))
    .leftJoin(payeeVendorMatches, eq(payees.id, payeeVendorMatches.payeeId))
    .where(whereClause)

  return {
    filters_applied: query,
    data: list.map((p) => ({
      ...p,
      amount: Number(p.amount || 0),
      agency_count: Number(p.agency_count || 0),
      matched_vendor: Boolean(p.matched_vendor),
    })),
    meta: {
      currency: 'USD',
      limit: query.limit,
      offset: query.offset,
      returned: list.length,
      total: Number(summary?.total || 0),
      payments_backfill_active: false,
    },
  }
})
