import { getRouterParam } from 'h3'
import { z } from 'zod'
import { defineAdminMutation, withValidatedBody } from '#layer/server/utils/mutation'
import { RATE_LIMIT_POLICIES } from '#layer/server/utils/rateLimit'
import { setAdminBlogPostStatus } from '#server/utils/adminBlogPosts'

const statusBodySchema = z.object({
  status: z.enum(['draft', 'published', 'archived']),
})

export default defineAdminMutation(
  {
    rateLimit: RATE_LIMIT_POLICIES.adminAiModel,
    parseBody: withValidatedBody(statusBodySchema.parse),
  },
  async ({ event, body }) => {
    const postId = getRouterParam(event, 'postId')
    if (!postId) {
      throw createError({ statusCode: 400, message: 'Missing postId.' })
    }

    return setAdminBlogPostStatus(event, {
      postId,
      status: body.status,
    })
  },
)
