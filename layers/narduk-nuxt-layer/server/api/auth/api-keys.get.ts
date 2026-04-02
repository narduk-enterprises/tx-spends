import { requireAuth } from '#layer/server/utils/auth'
import { apiKeys } from '#layer/orm-tables'
import { eq } from 'drizzle-orm'

/**
 * GET /api/auth/api-keys
 * List the current user's API keys (never returns the full key).
 */
export default defineEventHandler(async (event) => {
  const log = useLogger(event).child('Auth')
  const user = await requireAuth(event)
  const db = useDatabase(event)

  const keys = await db.select().from(apiKeys).where(eq(apiKeys.userId, user.id))

  log.debug('API keys listed', { count: keys.length, userId: user.id })
  return keys
    .map((key) => ({
      id: key.id,
      name: key.name,
      keyPrefix: key.keyPrefix,
      lastUsedAt: key.lastUsedAt,
      expiresAt: key.expiresAt,
      createdAt: key.createdAt,
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
})
