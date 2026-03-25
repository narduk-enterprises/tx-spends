import { getRouterParam, getValidatedQuery } from 'h3'
import { eq, desc, sql, and } from 'drizzle-orm'
import { useAppDatabase } from '#server/utils/database'
import { countyExpenditureFacts, expenditureCategories } from '#server/database/schema'
import { globalQuerySchema } from '#server/utils/query'

export default defineEventHandler(async (event) => {
  const db = useAppDatabase(event)
  const id = getRouterParam(event, 'id')
  const query = await getValidatedQuery(event, globalQuerySchema.parse)

  if (!id) throw createError({ statusCode: 400, message: 'Missing county_id' })

  const conditions = [eq(countyExpenditureFacts.countyId, id)]
  if (query.fiscal_year) conditions.push(eq(countyExpenditureFacts.fiscalYear, query.fiscal_year))
  const whereClause = and(...conditions)

  const types = await db
    .select({
      category_code: countyExpenditureFacts.expenditureCategoryCode,
      category_title: expenditureCategories.title,
      amount: sql<string>`SUM(${countyExpenditureFacts.amount})`,
    })
    .from(countyExpenditureFacts)
    .leftJoin(
      expenditureCategories,
      eq(countyExpenditureFacts.expenditureCategoryCode, expenditureCategories.code),
    )
    .where(whereClause)
    .groupBy(countyExpenditureFacts.expenditureCategoryCode, expenditureCategories.title)
    .orderBy(desc(sql`SUM(${countyExpenditureFacts.amount})`))
    .limit(query.limit)
    .offset(query.offset)

  return {
    filters_applied: query,
    data: types.map((t: any) => ({
      ...t,
      amount: Number(t.amount || 0),
    })),
    meta: { currency: 'USD' },
  }
})
