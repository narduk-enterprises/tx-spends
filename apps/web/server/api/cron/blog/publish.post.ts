/**
 * POST /api/cron/blog/publish
 *
 * Cloudflare-cron-triggered daily blog post generation.
 * Secured with the layer cron auth helper (Bearer CRON_SECRET).
 *
 * Flow:
 *   1. Pick the next rotation angle
 *   2. Run the analyzer to mine spending data
 *   3. Persist an analyzer run record
 *   4. Generate article copy with xAI Grok
 *   5. Save the post as 'published'
 *   6. Update angle rotation state
 *   7. Submit URL to IndexNow
 */
import { eq, and, gte } from 'drizzle-orm'
import { useAppDatabase } from '#server/utils/database'
import { blogAnalyzerRuns, blogPosts } from '#server/database/schema'
import { pickNextAngle, markAngleUsed } from '#server/utils/blog/angles'
import { runAnalyzer } from '#server/utils/blog/analyzers'
import { generateBlogPost } from '#server/utils/blog/generator'
import { defineCronMutation } from '#layer/server/utils/mutation'
import { RATE_LIMIT_POLICIES } from '#layer/server/utils/rateLimit'
import { notifyIndexNow } from '#layer/server/utils/indexNow'

export default defineCronMutation(
  { rateLimit: RATE_LIMIT_POLICIES.adminAiModel },
  async ({ event }) => {
    const db = useAppDatabase(event)
    const config = useRuntimeConfig(event)
    const siteUrl = ((config.public as Record<string, unknown>).appUrl as string) || ''

    // 1. Pick angle
    const angleId = await pickNextAngle(event)

    // Idempotency guard: if a published post for this angle was already created
    // today (UTC), skip the rest of the flow.  This prevents duplicate articles
    // from concurrent or retried cron invocations for the same day/angle.
    const todayUtc = new Date()
    todayUtc.setUTCHours(0, 0, 0, 0)
    const existingToday = await db
      .select({ id: blogPosts.id, slug: blogPosts.slug })
      .from(blogPosts)
      .where(
        and(
          eq(blogPosts.angleId, angleId),
          eq(blogPosts.status, 'published'),
          gte(blogPosts.publishedAt, todayUtc),
        ),
      )
      .limit(1)

    if (existingToday.length > 0) {
      return {
        ok: true,
        skipped: true,
        reason: 'A published post for this angle already exists for today.',
        post_id: existingToday[0]!.id,
        slug: existingToday[0]!.slug,
        angle_id: angleId,
      }
    }

    // 2. Insert analyzer run record (pending)
    const runRows = await db
      .insert(blogAnalyzerRuns)
      .values({
        angleId,
        status: 'pending',
      })
      .returning({ id: blogAnalyzerRuns.id })

    const runId = runRows[0]!.id

    let findings
    try {
      // 3. Run analyzer
      findings = await runAnalyzer(event, angleId)

      // Update run to completed
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

    // 4. Generate post with xAI
    let generated
    try {
      generated = await generateBlogPost(event, findings)
    } catch (err) {
      const errorText = err instanceof Error ? err.message : String(err)
      throw createError({ statusCode: 500, message: `Post generation failed: ${errorText}` })
    }

    // 5. Deduplicate slug — if the base slug is already taken (e.g., a retry
    //    or same-day re-run), use the unique analyzer run ID as a suffix to
    //    guarantee uniqueness without an unbounded loop.
    const baseSlug = generated.slug
    let slug = baseSlug
    const existing = await db
      .select({ id: blogPosts.id })
      .from(blogPosts)
      .where(eq(blogPosts.slug, slug))
      .limit(1)

    if (existing.length > 0) {
      slug = `${baseSlug}-${runId.replace(/-/g, '').slice(0, 8)}`
    }

    // 6. Save post as published
    const now = new Date()
    const postRows = await db
      .insert(blogPosts)
      .values({
        slug,
        title: generated.title,
        excerpt: generated.excerpt,
        body: generated.body as unknown as Record<string, unknown>,
        angleId,
        analyzerRunId: runId,
        findingsJson: findings as unknown as Record<string, unknown>,
        status: 'published',
        publishedAt: now,
        generationModel: generated.model,
        generationPromptKey: generated.promptKey,
      })
      .returning({ id: blogPosts.id })

    const postId = postRows[0]!.id

    // 7. Mark angle as used
    await markAngleUsed(event, angleId)

    // 8. Notify IndexNow
    let indexNowResult: { success: boolean; submitted: number; error?: string } = {
      success: false,
      submitted: 0,
    }
    if (siteUrl) {
      const postUrl = `${siteUrl}/blog/${slug}`
      const blogUrl = `${siteUrl}/blog`
      indexNowResult = await notifyIndexNow(event, [postUrl, blogUrl])

      if (indexNowResult.success) {
        await db
          .update(blogPosts)
          .set({ indexNowSubmitted: true })
          .where(eq(blogPosts.id, postId))
      }
    }

    return {
      ok: true,
      post_id: postId,
      slug,
      title: generated.title,
      angle_id: angleId,
      analyzer_run_id: runId,
      index_now: indexNowResult,
    }
  },
)
