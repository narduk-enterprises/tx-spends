import { getValidatedQuery } from 'h3'
import { and, asc, desc, eq, like, sql } from 'drizzle-orm'
import { useAppDatabase } from '#server/utils/database'
import { payeeVendorMatches, payees, paymentPayeeRollups } from '#server/database/schema'
import { getPaymentsBackfillStatus } from '#server/utils/payments-backfill'
import { getRollupScopeFiscalYear } from '#server/utils/payment-rollups'
import { normalizeSearchTerm } from '#server/utils/explorer'
import { globalQuerySchema } from '#server/utils/query'

export default defineEventHandler(async (event) => {
  const query = await getValidatedQuery(event, globalQuerySchema.parse)
  const db = useAppDatabase(event)
  const paymentsBackfill = await getPaymentsBackfillStatus(db)

  if (paymentsBackfill.active) {
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
        payments_backfill: paymentsBackfill,
      },
    }
  }

  const scopeFiscalYear = getRollupScopeFiscalYear(query.fiscal_year)
  const amountColumn = query.include_confidential
    ? paymentPayeeRollups.totalAmountAll
    : paymentPayeeRollups.totalAmountPublic
  const agencyCountColumn = query.include_confidential
    ? paymentPayeeRollups.agencyCountAll
    : paymentPayeeRollups.agencyCountPublic
  const matchedVendorExists = sql<boolean>`EXISTS (
    SELECT 1
    FROM ${payeeVendorMatches}
    WHERE ${payeeVendorMatches.payeeId} = ${paymentPayeeRollups.payeeId}
  )`
  const conditions = [eq(paymentPayeeRollups.scopeFiscalYear, scopeFiscalYear)]

  if (query.q) {
    conditions.push(
      like(payees.payeeNameNormalized, `%${normalizeSearchTerm(query.q)}%`),
    )
  }
  if (!query.include_confidential) {
    conditions.push(eq(payees.isConfidential, false))
  }
  if (query.matched_vendor_only) {
    conditions.push(matchedVendorExists)
  }

  const whereClause = and(...conditions)
  const sortColumn =
    query.sort === 'payee_name'
      ? payees.payeeNameRaw
      : query.sort === 'agency_count'
        ? agencyCountColumn
        : amountColumn
  const orderDirection = query.order === 'asc' ? asc : desc

  const list = await db
    .select({
      payee_id: payees.id,
      payee_name: payees.payeeNameRaw,
      is_confidential: payees.isConfidential,
      amount: amountColumn,
      agency_count: agencyCountColumn,
      matched_vendor: matchedVendorExists,
    })
    .from(paymentPayeeRollups)
    .innerJoin(payees, eq(payees.id, paymentPayeeRollups.payeeId))
    .where(whereClause)
    .orderBy(orderDirection(sortColumn), asc(payees.payeeNameRaw))
    .limit(query.limit)
    .offset(query.offset)

  const [summary] = await db
    .select({
      total: sql<number>`COUNT(*)`,
    })
    .from(paymentPayeeRollups)
    .innerJoin(payees, eq(payees.id, paymentPayeeRollups.payeeId))
    .where(whereClause)

  return {
    filters_applied: query,
    data: list.map((payee) => ({
      ...payee,
      amount: Number(payee.amount || 0),
      agency_count: Number(payee.agency_count || 0),
      matched_vendor: Boolean(payee.matched_vendor),
    })),
    meta: {
      currency: 'USD',
      limit: query.limit,
      offset: query.offset,
      returned: list.length,
      total: Number(summary?.total || 0),
      payments_backfill_active: false,
      payments_backfill: paymentsBackfill,
    },
  }
})
