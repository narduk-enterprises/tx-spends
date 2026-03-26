import { requireAdmin } from '#layer/server/utils/auth'
import { listAdminBlogPosts } from '#server/utils/adminBlogPosts'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  return {
    data: await listAdminBlogPosts(event),
  }
})
