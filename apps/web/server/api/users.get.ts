import { desc, sql } from 'drizzle-orm'
import { z } from 'zod'
import { requireAdmin } from '#layer/server/utils/auth'
import { useDatabase } from '#layer/server/utils/database'
import { users } from '#layer/orm-tables'

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const query = await getValidatedQuery(event, (value) => querySchema.safeParse(value))
  if (!query.success) {
    throw createError({ statusCode: 400, message: 'Invalid pagination parameters.' })
  }

  const { page, limit } = query.data
  const offset = (page - 1) * limit

  const db = useDatabase(event)

  const [totalRows, userRows] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(users),
    db.select().from(users).orderBy(desc(users.createdAt)).limit(limit).offset(offset),
  ])
  const totalResult = totalRows[0]

  return {
    users: userRows.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      isAdmin: user.isAdmin,
      createdAt: user.createdAt,
    })),
    total: Number(totalResult?.count || 0),
    page,
    limit,
  }
})
