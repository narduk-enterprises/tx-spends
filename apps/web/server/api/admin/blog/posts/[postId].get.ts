import { getRouterParam } from 'h3'
import { requireAdmin } from '#server/lib/auth'
import { getAdminBlogPost } from '#server/utils/adminBlogPosts'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const postId = getRouterParam(event, 'postId')
  if (!postId) {
    throw createError({ statusCode: 400, message: 'Missing postId.' })
  }

  return {
    data: await getAdminBlogPost(event, postId),
  }
})
