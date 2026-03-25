import { getValidatedQuery } from 'h3'
import { eq, desc, sql, like, and } from 'drizzle-orm'
import { useAppDatabase } from '#server/utils/database'
import { countyExpenditureFacts, expenditureCategories } from '#server/database/schema'
import { globalQuerySchema } from '#server/utils/query'

export default defineEventHandler(async (event) => {
  const query = await getValidatedQuery(event, globalQuerySchema.parse)
  const db = useAppDatabase(event)

  const conditions = []
  if (query.q) {
    conditions.push(like(expenditureCategories.title, `%${query.q}%`))
  }
  const whereCats = conditions.length > 0 ? and(...conditions) : undefined
  const countyConditions = query.fiscal_year
    ? [eq(countyExpenditureFacts.fiscalYear, query.fiscal_year)]
    : []

  const list = await db
    .select({
      category_code: expenditureCategories.code,
      category_title: expenditureCategories.title,
      amount: sql<string>`SUM(${countyExpenditureFacts.amount})`,
    })
    .from(expenditureCategories)
    .leftJoin(
      countyExpenditureFacts,
      and(
        eq(expenditureCategories.code, countyExpenditureFacts.expenditureCategoryCode),
        ...countyConditions,
      ),
    )
    .where(whereCats)
    .groupBy(expenditureCategories.code, expenditureCategories.title)
    .orderBy(desc(sql`SUM(${countyExpenditureFacts.amount})`))
    .limit(query.limit)
    .offset(query.offset)

  return {
    filters_applied: query,
    data: list.map((c) => ({
      ...c,
      amount: Number(c.amount || 0),
    })),
    meta: { currency: 'USD' },
  }
})
