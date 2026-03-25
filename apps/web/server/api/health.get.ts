import { sql } from 'drizzle-orm'
import { useLogger } from '#layer/server/utils/logger'
import { useAppDatabase } from '#server/utils/database'

function hasAppDatabaseConfig(event: Parameters<typeof useAppDatabase>[0]) {
  const config = useRuntimeConfig(event)
  const directEnv = event.context.cloudflare?.env as
    | Record<string, string | { connectionString?: string } | undefined>
    | undefined

  if (typeof directEnv?.DATABASE_URL === 'string' && directEnv.DATABASE_URL.length > 0) {
    return true
  }

  const runtimeDatabaseUrl = (config as Record<string, string | undefined>).databaseUrl
  if (runtimeDatabaseUrl) {
    return true
  }

  const bindingName =
    (config as Record<string, string | undefined>).hyperdriveBinding || 'HYPERDRIVE'
  const hyperdriveBinding = directEnv?.[bindingName]
  return typeof hyperdriveBinding === 'object' && Boolean(hyperdriveBinding?.connectionString)
}

export default defineEventHandler(async (event) => {
  const log = useLogger(event).child('Health')
  let dbStatus: 'ok' | 'not_available' | 'error' = 'not_available'

  if (hasAppDatabaseConfig(event)) {
    try {
      const db = useAppDatabase(event)
      await db.execute(sql`SELECT 1`)
      dbStatus = 'ok'
    } catch {
      log.error('Health check DB probe failed')
      dbStatus = 'error'
    }
  }

  return {
    success: true as const,
    data: {
      status: 'ok' as const,
      timestamp: new Date().toISOString(),
      database: dbStatus,
    },
  }
})
