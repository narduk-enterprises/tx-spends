import type { H3Event } from 'h3'
import { drizzle as drizzleNeonHttp, type NeonHttpDatabase } from 'drizzle-orm/neon-http'
import { neon } from '@neondatabase/serverless'
import * as appSchema from '#server/database/schema'
import { useLogger } from '#layer/server/utils/logger'

function makeLogger(event: H3Event, label: string) {
  return import.meta.dev
    ? {
        logQuery(query: string, params: unknown) {
          useLogger(event).child(label).debug('sql', { query, params })
        },
      }
    : undefined
}

function getHyperdriveConnectionString(event: H3Event): string {
  // Try to use the binding if available
  const config = useRuntimeConfig(event)
  const bindingName = (config as Record<string, unknown>).hyperdriveBinding || 'HYPERDRIVE'
  const env = event.context.cloudflare?.env as
    | Record<string, { connectionString?: string }>
    | undefined
  const hd = env?.[bindingName as string]
  if (hd?.connectionString) {
    return hd.connectionString
  }

  // Fallback to direct environment variable (useful for local tools or un-bound environments)
  const directEnv = event.context.cloudflare?.env as Record<string, string | undefined> | undefined
  if (directEnv?.DATABASE_URL) {
    return directEnv.DATABASE_URL
  }
  const configDbUrl = (config as Record<string, string | undefined>).databaseUrl
  if (configDbUrl) {
    return configDbUrl
  }

  throw createError({
    statusCode: 500,
    message: `Database connection string not found. Ensure HYPERDRIVE binding or DATABASE_URL is configured.`,
  })
}

export function useAppDatabase(event: H3Event): NeonHttpDatabase<typeof appSchema> {
  if (event.context._appDb) {
    return event.context._appDb as NeonHttpDatabase<typeof appSchema>
  }

  const connectionString = getHyperdriveConnectionString(event)
  const sql = neon(connectionString)
  const db = drizzleNeonHttp(sql, {
    schema: appSchema,
    logger: makeLogger(event, 'AppPG'),
  })
  event.context._appDb = db
  return db
}
