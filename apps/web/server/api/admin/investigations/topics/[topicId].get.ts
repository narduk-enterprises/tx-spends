import { getRouterParam } from 'h3'
import { requireAdmin } from '#server/lib/auth'
import { getAdminInvestigationTopic } from '#server/utils/adminInvestigationTopics'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const topicId = getRouterParam(event, 'topicId')
  if (!topicId) {
    throw createError({ statusCode: 400, message: 'Missing topicId.' })
  }

  return {
    data: await getAdminInvestigationTopic(event, topicId),
  }
})
