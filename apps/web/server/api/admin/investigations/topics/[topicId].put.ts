import { getRouterParam } from 'h3'
import { defineAdminMutation, withValidatedBody } from '#layer/server/utils/mutation'
import { RATE_LIMIT_POLICIES } from '#layer/server/utils/rateLimit'
import { updateAdminInvestigationTopic } from '#server/utils/adminInvestigationTopics'
import { updateInvestigationTopicBodySchema } from '#server/utils/investigations/validation'

export default defineAdminMutation(
  {
    rateLimit: RATE_LIMIT_POLICIES.adminAiModel,
    parseBody: withValidatedBody(updateInvestigationTopicBodySchema.parse),
  },
  async ({ event, body }) => {
    const topicId = getRouterParam(event, 'topicId')
    if (!topicId) {
      throw createError({ statusCode: 400, message: 'Missing topicId.' })
    }

    return {
      data: await updateAdminInvestigationTopic(event, {
        topicId,
        slug: body.slug,
        title: body.title,
        priorityRank: body.priorityRank,
        status: body.status,
        lane: body.lane,
        flaggedPattern: body.flaggedPattern,
        impact: body.impact,
        difficulty: body.difficulty,
        summary: body.summary,
        investigativeQuestion: body.investigativeQuestion,
        publicImpact: body.publicImpact,
        notes: body.notes,
        sourceReferences: body.sourceReferences,
        recordsToObtain: body.recordsToObtain,
        reportingSteps: body.reportingSteps,
        visualIdeas: body.visualIdeas,
      }),
    }
  },
)
