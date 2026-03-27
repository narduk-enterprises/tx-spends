import { requireAdmin } from '#layer/server/utils/auth'
import { listAdminInvestigationTopics } from '#server/utils/adminInvestigationTopics'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  return {
    data: await listAdminInvestigationTopics(event),
  }
})
