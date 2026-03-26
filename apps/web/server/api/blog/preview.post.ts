/**
 * POST /api/blog/preview
 *
 * Admin-only route for ad-hoc blog post generation without waiting for
 * the Cloudflare cron schedule. By default saves the result as a draft,
 * but can also create a published post when requested.
 *
 * Body (optional):
 *   {
 *     "angle_id"?: "agency-spend-leaders",
 *     "publish"?: boolean // defaults to false (draft); true creates a published post
 *   }
 *
 * If angle_id is omitted the rotation strategy selects the next angle.
 * When publish is true the route mirrors the cron publish side effects:
 * angle rotation state is updated and IndexNow is submitted.
 */
import { and, eq, gte, sql } from 'drizzle-orm'
import { z } from 'zod'
import { useAppDatabase } from '#server/utils/database'
import { blogAnalyzerRuns, blogAngles, blogPosts } from '#server/database/schema'
import { pickNextAngle, seedBlogAngles, BLOG_ANGLE_DEFINITIONS } from '#server/utils/blog/angles'
import { runAnalyzer } from '#server/utils/blog/analyzers'
import { generateBlogPost } from '#server/utils/blog/generator'
import { defineAdminMutation, withOptionalValidatedBody } from '#layer/server/utils/mutation'
import { RATE_LIMIT_POLICIES } from '#layer/server/utils/rateLimit'
import { notifyIndexNow } from '#layer/server/utils/indexNow'

const bodySchema = z.object({
  angle_id: z
    .string()
    .optional()
    .refine((v) => v === undefined || BLOG_ANGLE_DEFINITIONS.some((a) => a.id === v), {
      message: 'Unknown angle_id. See BLOG_ANGLE_DEFINITIONS for valid values.',
    }),
  publish: z.boolean().optional().default(false),
})

export default defineAdminMutation(
  {
    rateLimit: RATE_LIMIT_POLICIES.adminAiModel,
    parseBody: withOptionalValidatedBody(bodySchema.parse, {}),
  },
  async ({ event, body }) => {
    const db = useAppDatabase(event)
    const publicationDayUtc = new Date()
    publicationDayUtc.setUTCHours(0, 0, 0, 0)
    const publicationDayKey = Math.trunc(publicationDayUtc.getTime() / 86_400_000)
    const BLOG_PUBLICATION_LOCK_NAMESPACE = 5405

    await seedBlogAngles(event)

    const angleId = body.angle_id ?? (await pickNextAngle(event))

    // Insert analyzer run record
    const runRows = await db
      .insert(blogAnalyzerRuns)
      .values({ angleId, status: 'pending' })
      .returning({ id: blogAnalyzerRuns.id })
    const runId = runRows[0]!.id

    let findings
    try {
      findings = await runAnalyzer(event, angleId)
      await db
        .update(blogAnalyzerRuns)
        .set({
          status: 'completed',
          findingsJson: findings as unknown as Record<string, unknown>,
          dataAsOfFiscalYear: findings.fiscalYear ?? undefined,
          finishedAt: new Date(),
        })
        .where(eq(blogAnalyzerRuns.id, runId))
    } catch (err) {
      const errorText = err instanceof Error ? err.message : String(err)
      await db
        .update(blogAnalyzerRuns)
        .set({ status: 'failed', errorText, finishedAt: new Date() })
        .where(eq(blogAnalyzerRuns.id, runId))
      throw createError({ statusCode: 500, message: `Analyzer failed: ${errorText}` })
    }

    const generated = await generateBlogPost(event, findings)

    const targetStatus = body.publish ? 'published' : 'draft'
    const now = body.publish ? new Date() : undefined

    // Slug strategy:
    // - Drafts/previews: always incorporate the run ID for guaranteed uniqueness
    //   (repeated previews of the same angle/day can't collide)
    // - Published: keep human-friendly slugs and deduplicate with a timestamp suffix
    const baseSlug = generated.slug
    let slug: string
    if (!body.publish) {
      slug = `${baseSlug}-${runId.replaceAll('-', '').slice(0, 8)}`
    } else {
      slug = baseSlug
      const existing = await db
        .select({ id: blogPosts.id })
        .from(blogPosts)
        .where(eq(blogPosts.slug, slug))
        .limit(1)
      if (existing.length > 0) {
        slug = `${baseSlug}-${Date.now().toString(36)}`
      }
    }

    let postId: string
    if (body.publish) {
      const publishResult = await db.transaction(async (tx) => {
        await tx.execute(
          sql`SELECT pg_advisory_xact_lock(${BLOG_PUBLICATION_LOCK_NAMESPACE}, ${publicationDayKey})`,
        )

        const existingToday = await tx
          .select({ id: blogPosts.id, slug: blogPosts.slug })
          .from(blogPosts)
          .where(
            and(eq(blogPosts.status, 'published'), gte(blogPosts.publishedAt, publicationDayUtc)),
          )
          .limit(1)

        if (existingToday.length > 0) {
          return {
            skipped: true as const,
            postId: existingToday[0]!.id,
            slug: existingToday[0]!.slug,
          }
        }

        const postRows = await tx
          .insert(blogPosts)
          .values({
            slug,
            author: generated.author,
            title: generated.title,
            excerpt: generated.excerpt,
            body: generated.body as unknown as Record<string, unknown>,
            angleId,
            analyzerRunId: runId,
            findingsJson: findings as unknown as Record<string, unknown>,
            status: targetStatus,
            publishedAt: now,
            generationModel: generated.model,
            generationPromptKey: generated.promptKey,
          })
          .returning({ id: blogPosts.id })

        await tx
          .update(blogAngles)
          .set({
            lastUsedAt: now ?? new Date(),
            useCount: sql`${blogAngles.useCount} + 1`,
          })
          .where(eq(blogAngles.id, angleId))

        return {
          skipped: false as const,
          postId: postRows[0]!.id,
          slug,
        }
      })

      if (publishResult.skipped) {
        return {
          ok: true,
          skipped: true,
          reason: 'A daily spotlight post already exists for today.',
          post_id: publishResult.postId,
          slug: publishResult.slug,
          status: 'published',
          angle_id: angleId,
          analyzer_run_id: runId,
        }
      }

      postId = publishResult.postId
      slug = publishResult.slug
    } else {
      const postRows = await db
        .insert(blogPosts)
        .values({
          slug,
          author: generated.author,
          title: generated.title,
          excerpt: generated.excerpt,
          body: generated.body as unknown as Record<string, unknown>,
          angleId,
          analyzerRunId: runId,
          findingsJson: findings as unknown as Record<string, unknown>,
          status: targetStatus,
          publishedAt: now,
          generationModel: generated.model,
          generationPromptKey: generated.promptKey,
        })
        .returning({ id: blogPosts.id })

      postId = postRows[0]!.id
    }

    // When publishing via this admin route, mirror the cron publish side effects:
    // update angle rotation state and submit to IndexNow so the post is indexed.
    if (body.publish) {
      const config = useRuntimeConfig(event)
      const siteUrl =
        ((config.public as Record<string, unknown>).appUrl as string | undefined) ?? ''
      if (siteUrl.startsWith('https://') || siteUrl.startsWith('http://localhost')) {
        const indexNowResult = await notifyIndexNow(event, [
          `${siteUrl}/blog/${slug}`,
          `${siteUrl}/blog`,
        ]).catch(() => ({ success: false, submitted: 0 as const }))

        if (indexNowResult.success) {
          await db
            .update(blogPosts)
            .set({ indexNowSubmitted: true })
            .where(eq(blogPosts.id, postId))
        }
      }
    }

    return {
      ok: true,
      post_id: postId,
      slug,
      status: targetStatus,
      title: generated.title,
      author: generated.author,
      excerpt: generated.excerpt,
      angle_id: angleId,
      analyzer_run_id: runId,
      body: generated.body,
      findings,
    }
  },
)
