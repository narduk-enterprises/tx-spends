import { z } from 'zod'
import {
  INVESTIGATION_TOPIC_DIFFICULTIES,
  INVESTIGATION_TOPIC_IMPACTS,
  INVESTIGATION_TOPIC_STATUSES,
} from '#server/utils/investigations/defaultTopics'

export const investigationSourceReferenceSchema = z.object({
  label: z.string().trim().min(1).max(240),
  note: z.string().trim().min(1).max(600),
  url: z
    .string()
    .trim()
    .url()
    .nullable()
    .or(z.literal(''))
    .transform((value) => (value === '' ? null : value)),
})

const topicStringListSchema = z.array(z.string().trim().min(1).max(600)).max(24)

export const updateInvestigationTopicBodySchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .max(160)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().trim().min(1).max(220),
  priorityRank: z.coerce.number().int().min(1).max(999),
  status: z.enum(INVESTIGATION_TOPIC_STATUSES),
  lane: z.string().trim().min(1).max(120),
  flaggedPattern: z.string().trim().min(1).max(160),
  impact: z.enum(INVESTIGATION_TOPIC_IMPACTS),
  difficulty: z.enum(INVESTIGATION_TOPIC_DIFFICULTIES),
  summary: z.string().trim().min(1).max(4000),
  investigativeQuestion: z.string().trim().min(1).max(4000),
  publicImpact: z.string().trim().min(1).max(4000),
  notes: z.string().trim().max(8000).default(''),
  sourceReferences: z.array(investigationSourceReferenceSchema).max(24).default([]),
  recordsToObtain: topicStringListSchema.default([]),
  reportingSteps: topicStringListSchema.default([]),
  visualIdeas: topicStringListSchema.default([]),
})

export type UpdateInvestigationTopicBody = z.infer<typeof updateInvestigationTopicBodySchema>
