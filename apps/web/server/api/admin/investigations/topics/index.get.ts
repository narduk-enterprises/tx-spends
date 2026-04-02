import { requireAdmin } from '#server/lib/auth'
import { listAdminInvestigationTopics } from '#server/utils/adminInvestigationTopics'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  return {
    data: await listAdminInvestigationTopics(event),
  }
})
