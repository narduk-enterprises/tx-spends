import { getRouterParam, getValidatedQuery } from 'h3'
import { eq, desc, sql, and } from 'drizzle-orm'
import { useAppDatabase } from '#server/utils/database'
import { formatAgencyDisplayName, paymentCategoryCodeSql } from '#server/utils/explorer'
import { agencies, statePaymentFacts } from '#server/database/schema'
import { globalQuerySchema } from '#server/utils/query'

export default defineEventHandler(async (event) => {
  const db = useAppDatabase(event)
  const code = getRouterParam(event, 'code')
  const query = await getValidatedQuery(event, globalQuerySchema.parse)

  if (!code) throw createError({ statusCode: 400, message: 'Missing category_code' })

  const categoryCode = paymentCategoryCodeSql(statePaymentFacts.objectCategoryRaw)
  const conditions = [sql`${categoryCode} = ${code}`]
  if (query.fiscal_year) conditions.push(eq(statePaymentFacts.fiscalYear, query.fiscal_year))
  if (!query.include_confidential) conditions.push(eq(statePaymentFacts.isConfidential, false))
  const whereClause = and(...conditions)

  const topAgencies = await db
    .select({
      agency_id: statePaymentFacts.agencyId,
      agency_name: agencies.agencyName,
      amount: sql<string>`SUM(${statePaymentFacts.amount})`,
    })
    .from(statePaymentFacts)
    .leftJoin(agencies, eq(statePaymentFacts.agencyId, agencies.id))
    .where(whereClause)
    .groupBy(statePaymentFacts.agencyId, agencies.agencyName)
    .orderBy(desc(sql`SUM(${statePaymentFacts.amount})`))
    .limit(query.limit)
    .offset(query.offset)

  return {
    filters_applied: query,
    data: topAgencies.map((t: any) => ({
      ...t,
      agency_name: formatAgencyDisplayName(t.agency_name),
      amount: Number(t.amount || 0),
    })),
    meta: { currency: 'USD' },
  }
})
