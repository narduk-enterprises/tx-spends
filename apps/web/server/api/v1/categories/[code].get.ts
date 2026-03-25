import { getRouterParam } from 'h3'
import { eq } from 'drizzle-orm'
import { useAppDatabase } from '#server/utils/database'
import { expenditureCategories } from '#server/database/schema'

export default defineEventHandler(async (event) => {
  const db = useAppDatabase(event)
  const code = getRouterParam(event, 'code')

  if (!code) throw createError({ statusCode: 400, message: 'Missing category_code' })

  const [category] = await db
    .select()
    .from(expenditureCategories)
    .where(eq(expenditureCategories.code, code))
    .limit(1)

  if (!category) throw createError({ statusCode: 404, message: 'Category not found' })

  return {
    data: {
      category_code: category.code,
      category_title: category.title,
    },
  }
})
