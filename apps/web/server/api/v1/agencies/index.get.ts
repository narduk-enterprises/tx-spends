import { getValidatedQuery } from 'h3'
import { eq, desc, sql, like, or } from 'drizzle-orm'
import { useAppDatabase } from '#server/utils/database'
import { globalQuerySchema } from '#server/utils/query'
import { countyExpenditureFacts, agencies } from '#server/database/schema'

export default defineEventHandler(async (event) => {
  const query = await getValidatedQuery(event, globalQuerySchema.parse)
  const db = useAppDatabase(event)

  const countyConditions = []
  if (query.fiscal_year)
    countyConditions.push(eq(countyExpenditureFacts.fiscalYear, query.fiscal_year))
  if (query.q) {
    countyConditions.push(
      like(
        agencies.agencyNameNormalized,
        `%${query.q.toUpperCase().replaceAll(/[^A-Z0-9 ]/g, '')}%`,
      ),
    )
  }

  const whereCounty =
    countyConditions.length > 0 ? sql.join(countyConditions, sql` and `) : undefined

  const list = await db
    .select({
      agency_id: agencies.id,
      agency_name: agencies.agencyName,
      amount: sql<string>`SUM(${countyExpenditureFacts.amount})`,
    })
    .from(agencies)
    // We left join the facts to allow sorting by amount. So we start from agencies.
    .leftJoin(countyExpenditureFacts, eq(agencies.id, countyExpenditureFacts.agencyId))
    .where(whereCounty)
    .groupBy(agencies.id, agencies.agencyName)
    .orderBy(desc(sql`SUM(${countyExpenditureFacts.amount})`))
    .limit(query.limit)
    .offset(query.offset)

  return {
    filters_applied: query,
    data: list.map((a) => ({
      ...a,
      amount: Number(a.amount || 0),
    })),
    meta: {
      currency: 'USD',
    },
  }
})
