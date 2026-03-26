import { z } from 'zod'
import { definePublicMutation, readValidatedMutationBody } from '#layer/server/utils/mutation'
import { executeControlPlanePostgresSql } from '#server/utils/control-plane-database'
import { requireControlPlaneApiKey } from '#server/utils/control-plane-auth'

const MAX_SQL_CHARS = 500_000

const bodySchema = z.object({
  sql: z.string().min(1).max(MAX_SQL_CHARS),
  params: z
    .array(z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .max(100)
    .optional(),
})

export default definePublicMutation(
  {
    rateLimit: { namespace: 'control-plane-database-query', maxRequests: 30, windowMs: 60_000 },
    parseBody: async (event) => readValidatedMutationBody(event, bodySchema.parse),
  },
  async ({ event, body }) => {
    requireControlPlaneApiKey(event)

    const out = await executeControlPlanePostgresSql(event, {
      sql: body.sql,
      params: body.params,
    })

    return {
      ok: true as const,
      backend: 'postgres' as const,
      databaseId: null,
      databaseName: out.databaseName,
      schemaName: 'public',
      result: out.result,
    }
  },
)
