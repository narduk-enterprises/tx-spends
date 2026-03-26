import { getRouterParam } from 'h3'
import { z } from 'zod'
import { defineAdminMutation, withValidatedBody } from '#layer/server/utils/mutation'
import { RATE_LIMIT_POLICIES } from '#layer/server/utils/rateLimit'
import { updateAdminBlogPost } from '#server/utils/adminBlogPosts'

const updateBodySchema = z.object({
  slug: z.string().trim().min(1).max(140).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().trim().min(1).max(120),
  excerpt: z.string().trim().min(1).max(300),
  body: z.object({
    intro: z.string().default(''),
    dataNotes: z.string().default(''),
    sections: z
      .array(
        z.object({
          heading: z.string().default(''),
          content: z.string().default(''),
        }),
      )
      .max(12)
      .default([]),
  }),
})

export default defineAdminMutation(
  {
    rateLimit: RATE_LIMIT_POLICIES.adminAiModel,
    parseBody: withValidatedBody(updateBodySchema.parse),
  },
  async ({ event, body }) => {
    const postId = getRouterParam(event, 'postId')
    if (!postId) {
      throw createError({ statusCode: 400, message: 'Missing postId.' })
    }

    return {
      data: await updateAdminBlogPost(event, {
        postId,
        slug: body.slug,
        title: body.title,
        excerpt: body.excerpt,
        body: body.body,
      }),
    }
  },
)
