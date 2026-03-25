import { getValidatedQuery } from 'h3'
import { and, asc, desc, eq, sql } from 'drizzle-orm'
import { useAppDatabase } from '#server/utils/database'
import {
  normalizeSearchTerm,
  paymentCategoryCodeSql,
  paymentCategoryTitleSql,
} from '#server/utils/explorer'
import { isPaymentsBackfillActive } from '#server/utils/payments-backfill'
import { statePaymentFacts } from '#server/database/schema'
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

  const categoryCode = paymentCategoryCodeSql(statePaymentFacts.objectCategoryRaw)
  const categoryTitle = paymentCategoryTitleSql(statePaymentFacts.objectCategoryRaw)
  const conditions = []
  if (query.fiscal_year) {
    conditions.push(eq(statePaymentFacts.fiscalYear, query.fiscal_year))
  }
  if (!query.include_confidential) {
    conditions.push(eq(statePaymentFacts.isConfidential, false))
  }
  if (query.q) {
    conditions.push(sql`upper(${categoryTitle}) like ${`%${normalizeSearchTerm(query.q)}%`}`)
  }
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined
  const sortColumn =
    query.sort === 'category_code'
      ? categoryCode
      : query.sort === 'category_title'
        ? categoryTitle
        : sql`COALESCE(SUM(${statePaymentFacts.amount}), 0)`
  const orderDirection = query.order === 'asc' ? asc : desc

  const list = await db
    .select({
      category_code: categoryCode,
      category_title: categoryTitle,
      amount: sql<string>`COALESCE(SUM(${statePaymentFacts.amount}), 0)`,
    })
    .from(statePaymentFacts)
    .where(whereClause)
    .groupBy(categoryCode, categoryTitle)
    .orderBy(orderDirection(sortColumn))
    .limit(query.limit)
    .offset(query.offset)

  const [summary] = await db
    .select({
      total: sql<number>`COUNT(DISTINCT ${categoryCode})`,
    })
    .from(statePaymentFacts)
    .where(whereClause)

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
      payments_backfill_active: false,
    },
  }
})
