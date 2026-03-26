/**
 * POST /api/blog/preview
 *
 * Admin-only route for ad-hoc blog post generation without waiting for
 * the Cloudflare cron schedule. Saves the result as a 'draft'.
 *
 * Body (optional):
 *   { "angle_id": "agency-spend-leaders" }
 *
 * If angle_id is omitted the rotation strategy selects the next angle.
 */
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { useAppDatabase } from '#server/utils/database'
import { blogAnalyzerRuns, blogPosts } from '#server/database/schema'
import { pickNextAngle, seedBlogAngles, BLOG_ANGLE_DEFINITIONS } from '#server/utils/blog/angles'
import { runAnalyzer } from '#server/utils/blog/analyzers'
import { generateBlogPost } from '#server/utils/blog/generator'
import { defineAdminMutation, withOptionalValidatedBody } from '#layer/server/utils/mutation'
import { RATE_LIMIT_POLICIES } from '#layer/server/utils/rateLimit'

const bodySchema = z.object({
  angle_id: z
    .string()
    .optional()
    .refine(
      (v) => v === undefined || BLOG_ANGLE_DEFINITIONS.some((a) => a.id === v),
      { message: 'Unknown angle_id. See BLOG_ANGLE_DEFINITIONS for valid values.' },
    ),
  publish: z.boolean().optional().default(false),
})

export default defineAdminMutation(
  {
    rateLimit: RATE_LIMIT_POLICIES.adminAiModel,
    parseBody: withOptionalValidatedBody(bodySchema.parse, {}),
  },
  async ({ event, body }) => {
    const db = useAppDatabase(event)

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

    // Deduplicate slug
    let slug = generated.slug
    const existing = await db
      .select({ id: blogPosts.id })
      .from(blogPosts)
      .where(eq(blogPosts.slug, slug))
      .limit(1)
    if (existing.length > 0) {
      slug = `${slug}-preview`
    }

    const postRows = await db
      .insert(blogPosts)
      .values({
        slug,
        title: generated.title,
        excerpt: generated.excerpt,
        body: generated.bodyJson,
        angleId,
        analyzerRunId: runId,
        findingsJson: findings as unknown as Record<string, unknown>,
        status: targetStatus,
        publishedAt: now,
        generationModel: generated.model,
        generationPromptKey: generated.promptKey,
      })
      .returning({ id: blogPosts.id })

    return {
      ok: true,
      post_id: postRows[0]!.id,
      slug,
      status: targetStatus,
      title: generated.title,
      excerpt: generated.excerpt,
      angle_id: angleId,
      analyzer_run_id: runId,
      body: generated.body,
      findings,
    }
  },
)
