import { z } from 'zod'
import { enforceRateLimit } from '#layer/server/utils/rateLimit'
import {
  formatPostgresTableName,
  queryControlPlanePostgresRows,
} from '#server/utils/control-plane-database'
import { requireControlPlaneApiKey } from '#server/utils/control-plane-auth'

const querySchema = z.object({
  schemaName: z.string().min(1).max(63).optional().default('public'),
})

export default defineEventHandler(async (event) => {
  requireControlPlaneApiKey(event)
  await enforceRateLimit(event, 'control-plane-database-tables', 60, 60_000)

  const query = await getValidatedQuery(event, querySchema.parse)
  const { databaseName, rows } = await queryControlPlanePostgresRows(event, {
    sql: `
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_type IN ('BASE TABLE', 'VIEW')
        AND table_schema = $1
      ORDER BY table_name
    `,
    params: [query.schemaName],
  })

  const tables = rows
    .map((row) =>
      formatPostgresTableName(
        String(row.table_schema ?? query.schemaName),
        String(row.table_name ?? ''),
      ),
    )
    .filter(Boolean)

  return {
    ok: true as const,
    backend: 'postgres' as const,
    databaseId: null,
    databaseName,
    schemaName: query.schemaName,
    tables,
    catalogTableCount: tables.length,
    internalTableCount: 0,
    hint:
      tables.length === 0
        ? `No tables or views were found in schema "${query.schemaName}".`
        : undefined,
  }
})
