import { getValidatedQuery } from 'h3'
import { and, asc, desc, eq, like, sql } from 'drizzle-orm'
import { useAppDatabase } from '#server/utils/database'
import { paymentCategoryRollups } from '#server/database/schema'
import { formatCategoryDisplayName, normalizeSearchTerm } from '#server/utils/explorer'
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
  const amountColumn = query.include_confidential
    ? paymentCategoryRollups.totalAmountAll
    : paymentCategoryRollups.totalAmountPublic
  const conditions = [eq(paymentCategoryRollups.scopeFiscalYear, scopeFiscalYear)]

  if (query.q) {
    conditions.push(
      like(
        sql`upper(${paymentCategoryRollups.categoryTitle})`,
        `%${normalizeSearchTerm(query.q)}%`,
      ),
    )
  }

  const whereClause = and(...conditions)
  const sortColumn =
    query.sort === 'category_code'
      ? paymentCategoryRollups.categoryCode
      : query.sort === 'category_title'
        ? paymentCategoryRollups.categoryTitle
        : amountColumn
  const orderDirection = query.order === 'asc' ? asc : desc

  const list = await db
    .select({
      category_code: paymentCategoryRollups.categoryCode,
      category_title: paymentCategoryRollups.categoryTitle,
      amount: amountColumn,
    })
    .from(paymentCategoryRollups)
    .where(whereClause)
    .orderBy(orderDirection(sortColumn), asc(paymentCategoryRollups.categoryTitle))
    .limit(query.limit)
    .offset(query.offset)

  const [summary] = await db
    .select({
      total: sql<number>`COUNT(*)`,
    })
    .from(paymentCategoryRollups)
    .where(whereClause)

  return {
    filters_applied: query,
    data: list.map((category) => ({
      ...category,
      category_title: formatCategoryDisplayName(category.category_title, 'Uncategorized'),
      amount: Number(category.amount || 0),
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
