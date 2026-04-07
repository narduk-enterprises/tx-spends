import { getValidatedQuery } from 'h3'
import { and, asc, desc, eq, like, or, sql } from 'drizzle-orm'
import { useAppDatabase } from '#server/utils/database'
import { normalizeSearchTerm } from '#server/utils/explorer'
import { dirSalesFacts, agencies } from '#server/database/schema'
import { globalQuerySchema } from '#server/utils/query'

export default defineEventHandler(async (event) => {
  const query = await getValidatedQuery(event, globalQuerySchema.parse)
  const db = useAppDatabase(event)

  const conditions = []
  if (query.fiscal_year) conditions.push(eq(dirSalesFacts.fiscalYear, query.fiscal_year))
  if (query.agency_id) conditions.push(eq(dirSalesFacts.agencyId, query.agency_id))

  if (query.q) {
    const normalizedSearch = `%${normalizeSearchTerm(query.q)}%`
    conditions.push(
      or(
        like(dirSalesFacts.vendorNameRaw, normalizedSearch),
        like(dirSalesFacts.rfoDescription, normalizedSearch),
        like(dirSalesFacts.contractNumber, normalizedSearch),
      )!,
    )
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined
  const orderDirection = query.order === 'asc' ? asc : desc
  const sortCol =
    query.sort === 'payment_date'
      ? dirSalesFacts.shippedDate
      : query.sort === 'payee_name'
        ? dirSalesFacts.vendorNameRaw
        : dirSalesFacts.purchaseAmount

  const list = await db
    .select({
      id: dirSalesFacts.id,
      transaction_id: dirSalesFacts.sourceRowHash,
      fiscal_year: dirSalesFacts.fiscalYear,
      agency_id: dirSalesFacts.agencyId,
      agency_name: agencies.agencyName,
      vendor_name: dirSalesFacts.vendorNameRaw,
      purchase_amount: dirSalesFacts.purchaseAmount,
      contract_number: dirSalesFacts.contractNumber,
      rfo_description: dirSalesFacts.rfoDescription,
      contract_type: dirSalesFacts.contractType,
      staffing_contractor_name: dirSalesFacts.staffingContractorName,
      staffing_title: dirSalesFacts.staffingTitle,
      shipped_date: dirSalesFacts.shippedDate,
    })
    .from(dirSalesFacts)
    .leftJoin(agencies, eq(dirSalesFacts.agencyId, agencies.id))
    .where(whereClause)
    .orderBy(orderDirection(sortCol))
    .limit(query.limit)
    .offset(query.offset)

  const [summary] = await db
    .select({ total: sql<number>`COUNT(*)` })
    .from(dirSalesFacts)
    .where(whereClause)

  return {
    filters_applied: query,
    data: list.map((c) => ({
      ...c,
      purchase_amount: Number(c.purchase_amount || 0),
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
