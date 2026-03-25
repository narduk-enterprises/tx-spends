import { sql, like } from 'drizzle-orm'
import { getValidatedQuery } from 'h3'
import { useAppDatabase } from '#server/utils/database'
import { agencies, payees, geographiesCounties } from '#server/database/schema'
import { globalQuerySchema } from '#server/utils/query'

export default defineEventHandler(async (event) => {
  const query = await getValidatedQuery(event, globalQuerySchema.parse)
  const db = useAppDatabase(event)

  if (!query.q) {
    return { data: { agencies: [], payees: [], geographiesCounties: [] } }
  }

  const searchStr = `%${query.q.toUpperCase().replaceAll(/[^A-Z0-9 ]/g, '')}%`

  const agencyList = await db
    .select({
      id: agencies.id,
      name: agencies.agencyName,
      type: sql<string>`'agency'`,
    })
    .from(agencies)
    .where(like(agencies.agencyNameNormalized, searchStr))
    .limit(5)

  const payeeList = await db
    .select({
      id: payees.id,
      name: payees.payeeNameRaw,
      type: sql<string>`'payee'`,
    })
    .from(payees)
    .where(like(payees.payeeNameNormalized, searchStr))
    .limit(5)

  const countySearchRaw = `%${query.q}%`
  const countyList = await db
    .select({
      id: geographiesCounties.id,
      name: geographiesCounties.countyName,
      type: sql<string>`'county'`,
    })
    .from(geographiesCounties)
    .where(like(geographiesCounties.countyName, countySearchRaw))
    .limit(5)

  return {
    filters_applied: query,
    data: {
      agencies: agencyList,
      payees: payeeList,
      geographiesCounties: countyList,
      // merged for a unified autocomplete type response
      results: [...agencyList, ...payeeList, ...countyList],
    },
  }
})
