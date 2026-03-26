import { getValidatedQuery } from 'h3'
import { and, asc, desc, eq, inArray, isNotNull, like, sql } from 'drizzle-orm'
import { useAppDatabase } from '#server/utils/database'
import {
  payeeVendorMatches,
  payees,
  paymentPayeeRollups,
  vendorEnrichment,
} from '#server/database/schema'
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

  const conditions = [eq(paymentPayeeRollups.scopeFiscalYear, scopeFiscalYear)]

  if (query.q) {
    conditions.push(like(payees.payeeNameNormalized, `%${normalizeSearchTerm(query.q)}%`))
  }
  if (!query.include_confidential) {
    conditions.push(eq(payees.isConfidential, false))
  }
  // Vendor-match and vendor-attribute filters — all rely on the LEFT JOINs below
  if (query.matched_vendor_only) {
    conditions.push(isNotNull(payeeVendorMatches.payeeId))
  }
  if (query.hub_only) {
    conditions.push(isNotNull(vendorEnrichment.hubStatus))
  }
  if (query.small_business_only) {
    conditions.push(eq(vendorEnrichment.smallBusinessFlag, true))
  }
  if (query.sdv_only) {
    conditions.push(eq(vendorEnrichment.sdvFlag, true))
  }
  if (query.in_state_only) {
    conditions.push(eq(vendorEnrichment.state, 'TX'))
  }

  const whereClause = and(...conditions)
  const sortColumn =
    query.sort === 'payee_name'
      ? payees.payeeNameRaw
      : query.sort === 'agency_count'
        ? agencyCountColumn
        : amountColumn
  const orderDirection = query.order === 'asc' ? asc : desc

  // LEFT JOIN vendor tables (only approved/auto-accepted matches per §8.4 public API rule).
  // A 1:1 unique constraint on payee_vendor_matches.payee_id keeps this join cheap.
  // Rows with tentative/unreviewed status fail the ON predicate and naturally produce
  // NULL right-side columns — no isNull guard needed for unmatched rows.
  const vendorJoinCondition = and(
    eq(payeeVendorMatches.payeeId, paymentPayeeRollups.payeeId),
    inArray(payeeVendorMatches.reviewStatus, ['auto-accepted', 'approved']),
  )

  const list = await db
    .select({
      payee_id: payees.id,
      payee_name: payees.payeeNameRaw,
      is_confidential: payees.isConfidential,
      amount: amountColumn,
      agency_count: agencyCountColumn,
      matched_vendor: sql<boolean>`${payeeVendorMatches.payeeId} IS NOT NULL`,
      hub_status: vendorEnrichment.hubStatus,
      small_business_flag: vendorEnrichment.smallBusinessFlag,
      sdv_flag: vendorEnrichment.sdvFlag,
    })
    .from(paymentPayeeRollups)
    .innerJoin(payees, eq(payees.id, paymentPayeeRollups.payeeId))
    .leftJoin(payeeVendorMatches, vendorJoinCondition)
    .leftJoin(vendorEnrichment, eq(payeeVendorMatches.vendorEnrichmentId, vendorEnrichment.id))
    .where(whereClause)
    .orderBy(orderDirection(sortColumn), asc(payees.payeeNameRaw))
    .limit(query.limit)
    .offset(query.offset)

  // Only add vendor LEFT JOINs to the count query when at least one vendor filter is
  // active — the WHERE clause won't reference vendor columns otherwise.
  const needsVendorJoin = query.matched_vendor_only || query.hub_only || query.small_business_only || query.sdv_only || query.in_state_only
  const countBase = db
    .select({ total: sql<number>`COUNT(*)` })
    .from(paymentPayeeRollups)
    .innerJoin(payees, eq(payees.id, paymentPayeeRollups.payeeId))
  const [summary] = await (needsVendorJoin
    ? countBase
        .leftJoin(payeeVendorMatches, vendorJoinCondition)
        .leftJoin(vendorEnrichment, eq(payeeVendorMatches.vendorEnrichmentId, vendorEnrichment.id))
        .where(whereClause)
    : countBase.where(whereClause))

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
