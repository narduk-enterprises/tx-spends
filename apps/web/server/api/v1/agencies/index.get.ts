import { getValidatedQuery } from 'h3'
import { and, asc, desc, eq, like, sql } from 'drizzle-orm'
import { useAppDatabase } from '#server/utils/database'
import { normalizeSearchTerm } from '#server/utils/explorer'
import { isPaymentsBackfillActive } from '#server/utils/payments-backfill'
import { globalQuerySchema } from '#server/utils/query'
import { agencies, statePaymentFacts } from '#server/database/schema'

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
  if (query.fiscal_year) {
    conditions.push(eq(statePaymentFacts.fiscalYear, query.fiscal_year))
  }
  if (!query.include_confidential) {
    conditions.push(eq(statePaymentFacts.isConfidential, false))
  }
  if (query.q) {
    conditions.push(like(agencies.agencyNameNormalized, `%${normalizeSearchTerm(query.q)}%`))
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const sortColumn =
    query.sort === 'agency_name'
      ? agencies.agencyName
      : query.sort === 'agency_code'
        ? agencies.agencyCode
        : sql`COALESCE(SUM(${statePaymentFacts.amount}), 0)`
  const orderDirection = query.order === 'asc' ? asc : desc

  const list = await db
    .select({
      agency_id: agencies.id,
      agency_name: agencies.agencyName,
      agency_code: agencies.agencyCode,
      total_spend: sql<string>`COALESCE(SUM(${statePaymentFacts.amount}), 0)`,
      payment_count: sql<number>`COUNT(${statePaymentFacts.sourceRowHash})`,
    })
    .from(statePaymentFacts)
    .innerJoin(agencies, eq(agencies.id, statePaymentFacts.agencyId))
    .where(whereClause)
    .groupBy(agencies.id, agencies.agencyName, agencies.agencyCode)
    .orderBy(orderDirection(sortColumn))
    .limit(query.limit)
    .offset(query.offset)

  const [summary] = await db
    .select({
      total: sql<number>`COUNT(DISTINCT ${statePaymentFacts.agencyId})`,
    })
    .from(statePaymentFacts)
    .innerJoin(agencies, eq(agencies.id, statePaymentFacts.agencyId))
    .where(whereClause)

  return {
    filters_applied: query,
    data: list.map((agency) => ({
      ...agency,
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
    },
  }
})
