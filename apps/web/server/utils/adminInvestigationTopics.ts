import type { H3Event } from 'h3'
import { and, asc, desc, eq, ne } from 'drizzle-orm'
import { investigationTopics } from '#server/database/schema'
import { useAppDatabase } from '#server/utils/database'
import type {
  InvestigationSourceReference,
  InvestigationTopicDifficulty,
  InvestigationTopicImpact,
  InvestigationTopicStatus,
} from '#server/utils/investigations/defaultTopics'
import { DEFAULT_INVESTIGATION_TOPICS } from '#server/utils/investigations/defaultTopics'
import {
  getSeedableInvestigationTopics,
  serializeInvestigationTopicUpdate,
  sortInvestigationTopicsForAdmin,
  type InvestigationTopicEditableInput,
} from '#server/utils/investigations/pure'

function normalizeSourceReferences(value: unknown): InvestigationSourceReference[] {
  if (!Array.isArray(value)) return []

  return value
    .map((item) => {
      const record =
        typeof item === 'object' && item !== null ? (item as Record<string, unknown>) : {}

      return {
        label: typeof record.label === 'string' ? record.label : '',
        note: typeof record.note === 'string' ? record.note : '',
        url: typeof record.url === 'string' ? record.url : null,
      }
    })
    .filter((item) => item.label.trim().length > 0 || item.note.trim().length > 0 || item.url)
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

function mapSummary(
  row:
    | Awaited<ReturnType<typeof fetchTopicRecord>>
    | {
        id: string
        slug: string
        title: string
        priorityRank: number
        status: string
        lane: string
        flaggedPattern: string
        impact: string
        difficulty: string
        createdAt: Date
        updatedAt: Date
      },
) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    priority_rank: row.priorityRank,
    status: row.status,
    lane: row.lane,
    flagged_pattern: row.flaggedPattern,
    impact: row.impact,
    difficulty: row.difficulty,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }
}

function mapDetail(row: Awaited<ReturnType<typeof fetchTopicRecord>>) {
  return {
    ...mapSummary(row),
    summary: row.summary,
    investigative_question: row.investigativeQuestion,
    public_impact: row.publicImpact,
    notes: row.notes,
    source_references: normalizeSourceReferences(row.sourceReferences),
    records_to_obtain: normalizeStringList(row.recordsToObtain),
    reporting_steps: normalizeStringList(row.reportingSteps),
    visual_ideas: normalizeStringList(row.visualIdeas),
  }
}

async function ensureUniqueSlug(event: H3Event, slug: string, topicId: string) {
  const db = useAppDatabase(event)

  const existing = await db
    .select({ id: investigationTopics.id })
    .from(investigationTopics)
    .where(and(eq(investigationTopics.slug, slug), ne(investigationTopics.id, topicId)))
    .limit(1)

  if (existing.length > 0) {
    throw createError({
      statusCode: 409,
      message: 'Another investigation topic already uses that slug.',
    })
  }
}

async function fetchTopicRecord(event: H3Event, topicId: string) {
  const db = useAppDatabase(event)

  const rows = await db
    .select({
      id: investigationTopics.id,
      slug: investigationTopics.slug,
      title: investigationTopics.title,
      priorityRank: investigationTopics.priorityRank,
      status: investigationTopics.status,
      lane: investigationTopics.lane,
      flaggedPattern: investigationTopics.flaggedPattern,
      impact: investigationTopics.impact,
      difficulty: investigationTopics.difficulty,
      summary: investigationTopics.summary,
      investigativeQuestion: investigationTopics.investigativeQuestion,
      publicImpact: investigationTopics.publicImpact,
      notes: investigationTopics.notes,
      sourceReferences: investigationTopics.sourceReferences,
      recordsToObtain: investigationTopics.recordsToObtain,
      reportingSteps: investigationTopics.reportingSteps,
      visualIdeas: investigationTopics.visualIdeas,
      createdAt: investigationTopics.createdAt,
      updatedAt: investigationTopics.updatedAt,
    })
    .from(investigationTopics)
    .where(eq(investigationTopics.id, topicId))
    .limit(1)

  if (rows.length === 0) {
    throw createError({ statusCode: 404, message: 'Investigation topic not found.' })
  }

  return rows[0]!
}

export async function seedInvestigationTopics(event: H3Event) {
  const db = useAppDatabase(event)

  const existingRows = await db
    .select({ slug: investigationTopics.slug })
    .from(investigationTopics)
    .limit(DEFAULT_INVESTIGATION_TOPICS.length + 10)

  const missing = getSeedableInvestigationTopics(existingRows.map((row) => row.slug))
  if (missing.length === 0) return 0

  await db
    .insert(investigationTopics)
    .values(
      missing.map((topic) => ({
        slug: topic.slug,
        title: topic.title,
        priorityRank: topic.priorityRank,
        status: 'backlog' satisfies InvestigationTopicStatus,
        lane: topic.lane,
        flaggedPattern: topic.flaggedPattern,
        impact: topic.impact satisfies InvestigationTopicImpact,
        difficulty: topic.difficulty satisfies InvestigationTopicDifficulty,
        summary: topic.summary,
        investigativeQuestion: topic.investigativeQuestion,
        publicImpact: topic.publicImpact,
        notes: topic.notes,
        sourceReferences: topic.sourceReferences,
        recordsToObtain: topic.recordsToObtain,
        reportingSteps: topic.reportingSteps,
        visualIdeas: topic.visualIdeas,
      })),
    )
    .onConflictDoNothing()

  return missing.length
}

export async function listAdminInvestigationTopics(event: H3Event) {
  await seedInvestigationTopics(event)
  const db = useAppDatabase(event)

  const rows = await db
    .select({
      id: investigationTopics.id,
      slug: investigationTopics.slug,
      title: investigationTopics.title,
      priorityRank: investigationTopics.priorityRank,
      status: investigationTopics.status,
      lane: investigationTopics.lane,
      flaggedPattern: investigationTopics.flaggedPattern,
      impact: investigationTopics.impact,
      difficulty: investigationTopics.difficulty,
      createdAt: investigationTopics.createdAt,
      updatedAt: investigationTopics.updatedAt,
    })
    .from(investigationTopics)
    .orderBy(asc(investigationTopics.priorityRank), desc(investigationTopics.updatedAt))

  return sortInvestigationTopicsForAdmin(rows).map((row) => mapSummary(row))
}

export async function getAdminInvestigationTopic(event: H3Event, topicId: string) {
  await seedInvestigationTopics(event)
  return mapDetail(await fetchTopicRecord(event, topicId))
}

export async function updateAdminInvestigationTopic(
  event: H3Event,
  input: InvestigationTopicEditableInput & { topicId: string },
) {
  const db = useAppDatabase(event)
  const next = serializeInvestigationTopicUpdate(input)

  await ensureUniqueSlug(event, next.slug, input.topicId)

  await db
    .update(investigationTopics)
    .set({
      slug: next.slug,
      title: next.title,
      priorityRank: next.priorityRank,
      status: next.status,
      lane: next.lane,
      flaggedPattern: next.flaggedPattern,
      impact: next.impact,
      difficulty: next.difficulty,
      summary: next.summary,
      investigativeQuestion: next.investigativeQuestion,
      publicImpact: next.publicImpact,
      notes: next.notes,
      sourceReferences: next.sourceReferences,
      recordsToObtain: next.recordsToObtain,
      reportingSteps: next.reportingSteps,
      visualIdeas: next.visualIdeas,
      updatedAt: new Date(),
    })
    .where(eq(investigationTopics.id, input.topicId))

  return getAdminInvestigationTopic(event, input.topicId)
}
