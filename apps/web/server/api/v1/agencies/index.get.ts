import { getValidatedQuery } from 'h3'
import { and, asc, desc, eq, like, sql } from 'drizzle-orm'
import { useAppDatabase } from '#server/utils/database'
import { agencies, paymentAgencyRollups } from '#server/database/schema'
import { formatAgencyDisplayName, normalizeSearchTerm } from '#server/utils/explorer'
import { getPaymentsBackfillStatus } from '#server/utils/payments-backfill'
import { getRollupScopeFiscalYear } from '#server/utils/payment-rollups'
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
  const totalSpendColumn = query.include_confidential
    ? paymentAgencyRollups.totalSpendAll
    : paymentAgencyRollups.totalSpendPublic
  const paymentCountColumn = query.include_confidential
    ? paymentAgencyRollups.paymentCountAll
    : paymentAgencyRollups.paymentCountPublic
  const conditions = [eq(paymentAgencyRollups.scopeFiscalYear, scopeFiscalYear)]

  if (query.q) {
    conditions.push(like(agencies.agencyNameNormalized, `%${normalizeSearchTerm(query.q)}%`))
  }

  const whereClause = and(...conditions)
  const sortColumn =
    query.sort === 'agency_name'
      ? agencies.agencyName
      : query.sort === 'agency_code'
        ? agencies.agencyCode
        : totalSpendColumn
  const orderDirection = query.order === 'asc' ? asc : desc

  const list = await db
    .select({
      agency_id: agencies.id,
      agency_name: agencies.agencyName,
      agency_code: agencies.agencyCode,
      total_spend: totalSpendColumn,
      payment_count: paymentCountColumn,
    })
    .from(paymentAgencyRollups)
    .innerJoin(agencies, eq(agencies.id, paymentAgencyRollups.agencyId))
    .where(whereClause)
    .orderBy(orderDirection(sortColumn), asc(agencies.agencyName))
    .limit(query.limit)
    .offset(query.offset)

  const [summary] = await db
    .select({
      total: sql<number>`COUNT(*)`,
    })
    .from(paymentAgencyRollups)
    .innerJoin(agencies, eq(agencies.id, paymentAgencyRollups.agencyId))
    .where(whereClause)

  return {
    filters_applied: query,
    data: list.map((agency) => ({
      ...agency,
      agency_name: formatAgencyDisplayName(agency.agency_name),
      total_spend: Number(agency.total_spend || 0),
      payment_count: Number(agency.payment_count || 0),
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
