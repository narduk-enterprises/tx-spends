/**
 * GET /api/blog
 * Returns a paginated list of published blog posts.
 */
import { getValidatedQuery } from 'h3'
import { desc, eq, and, lt } from 'drizzle-orm'
import { z } from 'zod'
import { useAppDatabase } from '#server/utils/database'
import { blogPosts, blogAngles } from '#server/database/schema'

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})

export default defineEventHandler(async (event) => {
  const query = await getValidatedQuery(event, querySchema.parse)
  const db = useAppDatabase(event)

  const rows = await db
    .select({
      id: blogPosts.id,
      slug: blogPosts.slug,
      title: blogPosts.title,
      excerpt: blogPosts.excerpt,
      angleId: blogPosts.angleId,
      angleName: blogAngles.name,
      publishedAt: blogPosts.publishedAt,
      createdAt: blogPosts.createdAt,
    })
    .from(blogPosts)
    .leftJoin(blogAngles, eq(blogPosts.angleId, blogAngles.id))
    .where(eq(blogPosts.status, 'published'))
    .orderBy(desc(blogPosts.publishedAt))
    .limit(query.limit)
    .offset(query.offset)

  return {
    data: rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      excerpt: row.excerpt,
      angle_id: row.angleId,
      angle_name: row.angleName,
      published_at: row.publishedAt,
    })),
    meta: {
      limit: query.limit,
      offset: query.offset,
    },
  }
})
