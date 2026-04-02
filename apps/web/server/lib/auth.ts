import type { H3Event } from 'h3'
import { createError } from 'h3'
import { getCurrentSessionUser } from '#server/utils/app-auth'

export type AuthUser = {
  id: string
  email: string
  name: string | null
  isAdmin: boolean | null
}

export async function requireAuth(event: H3Event): Promise<AuthUser> {
  const user = await getCurrentSessionUser(event)

  if (!user) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized',
    })
  }

  return user
}

export async function requireAdmin(event: H3Event): Promise<AuthUser> {
  const user = await requireAuth(event)

  if (!user.isAdmin) {
    throw createError({
      statusCode: 403,
      message: 'Forbidden — admin access required',
    })
  }

  return user
}
