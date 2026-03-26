import { z } from 'zod'
import { enforceRateLimit } from '#layer/server/utils/rateLimit'
import {
  mapPostgresColumnRow,
  queryControlPlanePostgresRows,
  queryControlPlanePostgresScalar,
  quoteQualifiedTableRef,
} from '#server/utils/control-plane-database'
import { requireControlPlaneApiKey } from '#server/utils/control-plane-auth'

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).max(10_000_000).optional().default(0),
  schemaName: z.string().min(1).max(63).optional().default('public'),
})

export default defineEventHandler(async (event) => {
  requireControlPlaneApiKey(event)
  await enforceRateLimit(event, 'control-plane-database-table-rows', 120, 60_000)

  const table = getRouterParam(event, 'table')
  if (!table) throw createError({ statusCode: 400, statusMessage: 'Missing table name.' })

  const decodedTable = decodeURIComponent(table)
  const query = await getValidatedQuery(event, querySchema.parse)
  const tableRef = quoteQualifiedTableRef(decodedTable, query.schemaName)

  const { databaseName, rows: columnRows } = await queryControlPlanePostgresRows(event, {
    sql: `
      WITH pk AS (
        SELECT
          a.attname AS column_name,
          row_number() OVER (ORDER BY ord.ordinality) AS pk_position
        FROM pg_class t
        JOIN pg_namespace n ON n.oid = t.relnamespace
        JOIN pg_index i ON i.indrelid = t.oid AND i.indisprimary
        JOIN unnest(i.indkey) WITH ORDINALITY ord(attnum, ordinality) ON true
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ord.attnum
        WHERE n.nspname = $1
          AND t.relname = $2
      )
      SELECT
        a.attnum - 1 AS cid,
        a.attname AS name,
        pg_catalog.format_type(a.atttypid, a.atttypmod) AS type,
        CASE WHEN a.attnotnull THEN 1 ELSE 0 END AS notnull,
        pg_get_expr(ad.adbin, ad.adrelid) AS dflt_value,
        COALESCE(pk.pk_position, 0) AS pk
      FROM pg_class t
      JOIN pg_namespace n ON n.oid = t.relnamespace
      JOIN pg_attribute a ON a.attrelid = t.oid
      LEFT JOIN pg_attrdef ad ON ad.adrelid = t.oid AND ad.adnum = a.attnum
      LEFT JOIN pk ON pk.column_name = a.attname
      WHERE n.nspname = $1
        AND t.relname = $2
        AND a.attnum > 0
        AND NOT a.attisdropped
      ORDER BY a.attnum
    `,
    params: [tableRef.schema, tableRef.table],
  })

  const columns = columnRows.map(mapPostgresColumnRow)
  if (columns.length === 0) {
    throw createError({
      statusCode: 404,
      statusMessage: `Table or view '${tableRef.displayName}' not found.`,
    })
  }

  const total = await queryControlPlanePostgresScalar(
    event,
    `SELECT COUNT(*) AS c FROM ${tableRef.quoted}`,
  )
  const { rows } = await queryControlPlanePostgresRows(event, {
    sql: `SELECT * FROM ${tableRef.quoted} LIMIT ${query.limit} OFFSET ${query.offset}`,
  })

  return {
    ok: true as const,
    backend: 'postgres' as const,
    databaseId: null,
    databaseName,
    schemaName: tableRef.schema,
    table: tableRef.displayName,
    columns,
    rows,
    total,
    limit: query.limit,
    offset: query.offset,
  }
})
