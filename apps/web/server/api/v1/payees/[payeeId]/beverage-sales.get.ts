import { getRouterParam, getValidatedQuery } from 'h3'
import { and, asc, desc, eq, like, or, sql } from 'drizzle-orm'
import { useAppDatabase } from '#server/utils/database'
import { normalizeSearchTerm } from '#server/utils/explorer'
import { beverageSalesFacts } from '#server/database/schema'
import { globalQuerySchema } from '#server/utils/query'

export default defineEventHandler(async (event) => {
  const payeeId = getRouterParam(event, 'payeeId')
  const query = await getValidatedQuery(event, globalQuerySchema.parse)
  const db = useAppDatabase(event)

  if (!payeeId) throw createError({ statusCode: 400, message: 'Missing payee_id' })

  const conditions = [eq(beverageSalesFacts.payeeId, payeeId)]
  
  if (query.q) {
    const normalizedSearch = `%${normalizeSearchTerm(query.q)}%`
    conditions.push(
      or(
        like(beverageSalesFacts.locationNameRaw, normalizedSearch),
        like(beverageSalesFacts.locationCity, normalizedSearch),
        like(beverageSalesFacts.tabcPermitNumber, normalizedSearch)
      )!
    )
  }

  const whereClause = and(...conditions)
  const orderDirection = query.order === 'asc' ? asc : desc
  const sortCol =
    query.sort === 'sales'
      ? beverageSalesFacts.totalSalesReceipts
      : query.sort === 'date'
        ? beverageSalesFacts.obligationEndDate
        : beverageSalesFacts.obligationEndDate

  const list = await db
    .select({
      id: beverageSalesFacts.id,
      transaction_id: beverageSalesFacts.sourceRowHash,
      payee_id: beverageSalesFacts.payeeId,
      location_name: beverageSalesFacts.locationNameRaw,
      location_city: beverageSalesFacts.locationCity,
      permit_number: beverageSalesFacts.tabcPermitNumber,
      total_sales: beverageSalesFacts.totalSalesReceipts,
      total_taxable: beverageSalesFacts.totalTaxableReceipts,
      obligation_end_date: beverageSalesFacts.obligationEndDate,
    })
    .from(beverageSalesFacts)
    .where(whereClause)
    // Coalesce obligationEndDate to 1970 if null to ensure proper sorting locally if missing
    .orderBy(orderDirection(sortCol))
    .limit(query.limit)
    .offset(query.offset)

  const [summary] = await db
    .select({ total: sql<number>`COUNT(*)` })
    .from(beverageSalesFacts)
    .where(whereClause)

  return {
    filters_applied: query,
    data: list.map((c) => ({
      ...c,
      total_sales: Number(c.total_sales || 0),
      total_taxable: Number(c.total_taxable || 0)
    })),
    meta: {
      currency: 'USD',
      limit: query.limit,
      offset: query.offset,
      returned: list.length,
      total: Number(summary?.total || 0),
    },
  }
})
