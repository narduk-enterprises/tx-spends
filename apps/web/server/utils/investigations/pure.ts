import type {
  DefaultInvestigationTopic,
  InvestigationSourceReference,
  InvestigationTopicDifficulty,
  InvestigationTopicImpact,
  InvestigationTopicStatus,
} from '#server/utils/investigations/defaultTopics'
import { DEFAULT_INVESTIGATION_TOPICS } from '#server/utils/investigations/defaultTopics'

export interface InvestigationTopicEditableInput {
  slug: string
  title: string
  priorityRank: number
  status: InvestigationTopicStatus
  lane: string
  flaggedPattern: string
  impact: InvestigationTopicImpact
  difficulty: InvestigationTopicDifficulty
  summary: string
  investigativeQuestion: string
  publicImpact: string
  notes: string
  sourceReferences: InvestigationSourceReference[]
  recordsToObtain: string[]
  reportingSteps: string[]
  visualIdeas: string[]
}

export function getSeedableInvestigationTopics(
  existingSlugs: Iterable<string>,
): DefaultInvestigationTopic[] {
  const existing = new Set(existingSlugs)
  return DEFAULT_INVESTIGATION_TOPICS.filter((topic) => !existing.has(topic.slug))
}

export function sortInvestigationTopicsForAdmin<
  T extends { priorityRank: number; updatedAt: Date | string | null },
>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    if (a.priorityRank !== b.priorityRank) return a.priorityRank - b.priorityRank

    const aTime =
      a.updatedAt instanceof Date
        ? a.updatedAt.getTime()
        : a.updatedAt
          ? new Date(a.updatedAt).getTime()
          : 0
    const bTime =
      b.updatedAt instanceof Date
        ? b.updatedAt.getTime()
        : b.updatedAt
          ? new Date(b.updatedAt).getTime()
          : 0

    return bTime - aTime
  })
}

function normalizeSourceReference(
  reference: InvestigationSourceReference,
): InvestigationSourceReference | null {
  const label = reference.label.trim()
  const note = reference.note.trim()
  const url = reference.url?.trim() || null

  if (!label && !note && !url) return null

  return {
    label,
    note,
    url,
  }
}

function normalizeStringList(values: string[]): string[] {
  return values.map((value) => value.trim()).filter((value) => value.length > 0)
}

export function serializeInvestigationTopicUpdate(
  input: InvestigationTopicEditableInput,
): InvestigationTopicEditableInput {
  return {
    slug: input.slug.trim(),
    title: input.title.trim(),
    priorityRank: input.priorityRank,
    status: input.status,
    lane: input.lane.trim(),
    flaggedPattern: input.flaggedPattern.trim(),
    impact: input.impact,
    difficulty: input.difficulty,
    summary: input.summary.trim(),
    investigativeQuestion: input.investigativeQuestion.trim(),
    publicImpact: input.publicImpact.trim(),
    notes: input.notes.trim(),
    sourceReferences: input.sourceReferences
      .map((reference) => normalizeSourceReference(reference))
      .filter((reference): reference is InvestigationSourceReference => reference !== null),
    recordsToObtain: normalizeStringList(input.recordsToObtain),
    reportingSteps: normalizeStringList(input.reportingSteps),
    visualIdeas: normalizeStringList(input.visualIdeas),
  }
}
