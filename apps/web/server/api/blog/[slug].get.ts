/**
 * GET /api/blog/[slug]
 * Returns a single published blog post by slug.
 */
import { getRouterParam } from 'h3'
import { eq, and } from 'drizzle-orm'
import { useAppDatabase } from '#server/utils/database'
import { blogPosts, blogAngles } from '#server/database/schema'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  if (!slug) {
    throw createError({ statusCode: 400, message: 'Missing slug.' })
  }

  const db = useAppDatabase(event)

  const rows = await db
    .select({
      id: blogPosts.id,
      slug: blogPosts.slug,
      title: blogPosts.title,
      excerpt: blogPosts.excerpt,
      body: blogPosts.body,
      angleId: blogPosts.angleId,
      angleName: blogAngles.name,
      angleDescription: blogAngles.description,
      findingsJson: blogPosts.findingsJson,
      publishedAt: blogPosts.publishedAt,
      updatedAt: blogPosts.updatedAt,
      generationModel: blogPosts.generationModel,
    })
    .from(blogPosts)
    .leftJoin(blogAngles, eq(blogPosts.angleId, blogAngles.id))
    .where(and(eq(blogPosts.slug, slug), eq(blogPosts.status, 'published')))
    .limit(1)

  if (rows.length === 0) {
    throw createError({ statusCode: 404, message: 'Blog post not found.' })
  }

  const row = rows[0]!

  return {
    data: {
      id: row.id,
      slug: row.slug,
      title: row.title,
      excerpt: row.excerpt,
      body: row.body, // jsonb — already parsed by Drizzle
      angle_id: row.angleId,
      angle_name: row.angleName,
      angle_description: row.angleDescription,
      published_at: row.publishedAt,
      updated_at: row.updatedAt,
    },
  }
})
