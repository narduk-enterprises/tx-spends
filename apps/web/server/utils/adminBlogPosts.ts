import type { H3Event } from 'h3'
import { and, desc, eq, gte, ne, sql } from 'drizzle-orm'
import { notifyIndexNow } from '#layer/server/utils/indexNow'
import { blogAngles, blogPosts } from '#server/database/schema'
import { useAppDatabase } from '#server/utils/database'

const BLOG_PUBLICATION_LOCK_NAMESPACE = 5405

export interface AdminBlogSection {
  heading: string
  content: string
}

export interface AdminBlogBody {
  intro: string
  sections: AdminBlogSection[]
  dataNotes: string
}

function trustedBlogUrls(event: H3Event, slug: string): string[] {
  const config = useRuntimeConfig(event)
  const siteUrl = ((config.public as Record<string, unknown>).appUrl as string | undefined) ?? ''

  if (!siteUrl.startsWith('https://') && !siteUrl.startsWith('http://localhost')) {
    return []
  }

  return [`${siteUrl}/blog/${slug}`, `${siteUrl}/blog`]
}

function normalizeBody(body: unknown): AdminBlogBody {
  const raw = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {}

  const sections = Array.isArray(raw.sections)
    ? raw.sections
        .map((section) => {
          const value =
            typeof section === 'object' && section !== null
              ? (section as Record<string, unknown>)
              : {}
          return {
            heading: typeof value.heading === 'string' ? value.heading : '',
            content: typeof value.content === 'string' ? value.content : '',
          }
        })
        .filter((section) => section.heading.trim().length > 0 || section.content.trim().length > 0)
    : []

  return {
    intro: typeof raw.intro === 'string' ? raw.intro : '',
    sections,
    dataNotes: typeof raw.dataNotes === 'string' ? raw.dataNotes : '',
  }
}

function serializeBody(body: AdminBlogBody): AdminBlogBody {
  return {
    intro: body.intro.trim(),
    sections: body.sections
      .map((section) => ({
        heading: section.heading.trim(),
        content: section.content.trim(),
      }))
      .filter((section) => section.heading.length > 0 || section.content.length > 0),
    dataNotes: body.dataNotes.trim(),
  }
}

function publicationDayStart(): Date {
  const value = new Date()
  value.setUTCHours(0, 0, 0, 0)
  return value
}

async function ensureUniqueSlug(event: H3Event, slug: string, postId: string) {
  const db = useAppDatabase(event)
  const existing = await db
    .select({ id: blogPosts.id })
    .from(blogPosts)
    .where(and(eq(blogPosts.slug, slug), ne(blogPosts.id, postId)))
    .limit(1)

  if (existing.length > 0) {
    throw createError({
      statusCode: 409,
      message: 'Another blog post already uses that slug.',
    })
  }
}

async function fetchPostRecord(event: H3Event, postId: string) {
  const db = useAppDatabase(event)

  const rows = await db
    .select({
      id: blogPosts.id,
      slug: blogPosts.slug,
      author: blogPosts.author,
      title: blogPosts.title,
      excerpt: blogPosts.excerpt,
      body: blogPosts.body,
      status: blogPosts.status,
      angleId: blogPosts.angleId,
      angleName: blogAngles.name,
      analyzerRunId: blogPosts.analyzerRunId,
      findingsJson: blogPosts.findingsJson,
      publishedAt: blogPosts.publishedAt,
      generationModel: blogPosts.generationModel,
      generationPromptKey: blogPosts.generationPromptKey,
      indexNowSubmitted: blogPosts.indexNowSubmitted,
      createdAt: blogPosts.createdAt,
      updatedAt: blogPosts.updatedAt,
    })
    .from(blogPosts)
    .leftJoin(blogAngles, eq(blogPosts.angleId, blogAngles.id))
    .where(eq(blogPosts.id, postId))
    .limit(1)

  if (rows.length === 0) {
    throw createError({ statusCode: 404, message: 'Blog post not found.' })
  }

  return rows[0]!
}

function mapSummary(
  row:
    | Awaited<ReturnType<typeof fetchPostRecord>>
    | {
        id: string
        slug: string
        author: string
        title: string
        excerpt: string
        status: string
        angleId: string
        angleName: string | null
        publishedAt: Date | null
        indexNowSubmitted: boolean
        createdAt: Date
        updatedAt: Date
      },
) {
  return {
    id: row.id,
    slug: row.slug,
    author: row.author,
    title: row.title,
    excerpt: row.excerpt,
    status: row.status,
    angle_id: row.angleId,
    angle_name: row.angleName,
    published_at: row.publishedAt,
    index_now_submitted: row.indexNowSubmitted,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }
}

function mapDetail(row: Awaited<ReturnType<typeof fetchPostRecord>>) {
  return {
    ...mapSummary(row),
    body: normalizeBody(row.body),
    analyzer_run_id: row.analyzerRunId,
    findings_json: row.findingsJson,
    generation_model: row.generationModel,
    generation_prompt_key: row.generationPromptKey,
  }
}

async function submitIndexNow(event: H3Event, postId: string, slug: string) {
  const urls = trustedBlogUrls(event, slug)
  if (urls.length === 0) {
    return { success: false, submitted: 0 as const }
  }

  const result = await notifyIndexNow(event, urls).catch(() => ({
    success: false,
    submitted: 0 as const,
  }))

  if (result.success) {
    const db = useAppDatabase(event)
    await db
      .update(blogPosts)
      .set({ indexNowSubmitted: true, updatedAt: new Date() })
      .where(eq(blogPosts.id, postId))
  }

  return result
}

export async function listAdminBlogPosts(event: H3Event) {
  const db = useAppDatabase(event)

  const rows = await db
    .select({
      id: blogPosts.id,
      slug: blogPosts.slug,
      author: blogPosts.author,
      title: blogPosts.title,
      excerpt: blogPosts.excerpt,
      status: blogPosts.status,
      angleId: blogPosts.angleId,
      angleName: blogAngles.name,
      publishedAt: blogPosts.publishedAt,
      indexNowSubmitted: blogPosts.indexNowSubmitted,
      createdAt: blogPosts.createdAt,
      updatedAt: blogPosts.updatedAt,
    })
    .from(blogPosts)
    .leftJoin(blogAngles, eq(blogPosts.angleId, blogAngles.id))
    .orderBy(desc(blogPosts.publishedAt), desc(blogPosts.updatedAt), desc(blogPosts.createdAt))

  return rows.map((row) => mapSummary(row))
}

export async function getAdminBlogPost(event: H3Event, postId: string) {
  return mapDetail(await fetchPostRecord(event, postId))
}

export async function updateAdminBlogPost(
  event: H3Event,
  input: {
    postId: string
    slug: string
    author: string
    title: string
    excerpt: string
    body: AdminBlogBody
  },
) {
  const db = useAppDatabase(event)
  const current = await fetchPostRecord(event, input.postId)

  await ensureUniqueSlug(event, input.slug, input.postId)

  await db
    .update(blogPosts)
    .set({
      slug: input.slug,
      author: input.author.trim(),
      title: input.title.trim(),
      excerpt: input.excerpt.trim(),
      body: serializeBody(input.body) as unknown as Record<string, unknown>,
      indexNowSubmitted: current.status === 'published' ? false : current.indexNowSubmitted,
      updatedAt: new Date(),
    })
    .where(eq(blogPosts.id, input.postId))

  if (current.status === 'published') {
    await submitIndexNow(event, input.postId, input.slug)
  }

  return getAdminBlogPost(event, input.postId)
}

export async function setAdminBlogPostStatus(
  event: H3Event,
  input: {
    postId: string
    status: 'draft' | 'published' | 'archived'
  },
) {
  const db = useAppDatabase(event)
  const current = await fetchPostRecord(event, input.postId)

  if (current.status === input.status) {
    return {
      data: mapDetail(current),
      meta: {
        changed: false,
        index_now: null,
      },
    }
  }

  if (input.status === 'published') {
    const dayStart = publicationDayStart()
    const dayKey = Math.trunc(dayStart.getTime() / 86_400_000)

    await db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(${BLOG_PUBLICATION_LOCK_NAMESPACE}, ${dayKey})`,
      )

      const existingToday = await tx
        .select({ id: blogPosts.id })
        .from(blogPosts)
        .where(
          and(
            eq(blogPosts.status, 'published'),
            gte(blogPosts.publishedAt, dayStart),
            ne(blogPosts.id, input.postId),
          ),
        )
        .limit(1)

      if (existingToday.length > 0) {
        throw createError({
          statusCode: 409,
          message: 'A different spotlight post is already published for today.',
        })
      }

      await tx
        .update(blogPosts)
        .set({
          status: 'published',
          publishedAt: current.publishedAt ?? new Date(),
          indexNowSubmitted: false,
          updatedAt: new Date(),
        })
        .where(eq(blogPosts.id, input.postId))
    })

    const updated = await getAdminBlogPost(event, input.postId)
    const indexNowResult = await submitIndexNow(event, input.postId, updated.slug)

    return {
      data: await getAdminBlogPost(event, input.postId),
      meta: {
        changed: true,
        index_now: indexNowResult,
      },
    }
  }

  await db
    .update(blogPosts)
    .set({
      status: input.status,
      publishedAt: input.status === 'draft' ? null : current.publishedAt,
      updatedAt: new Date(),
    })
    .where(eq(blogPosts.id, input.postId))

  return {
    data: await getAdminBlogPost(event, input.postId),
    meta: {
      changed: true,
      index_now: null,
    },
  }
}
