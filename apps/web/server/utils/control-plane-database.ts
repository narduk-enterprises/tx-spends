import type { H3Event } from 'h3'
import postgres from 'postgres'
import { useHyperdriveConnectionString } from '#layer/server/utils/hyperdrive'

type PgQueryParam = string | number | boolean | null

const SAFE_SQL_IDENT = /^[_a-z]\w*$/i

function assertSqlIdent(name: string): void {
  if (!name || !SAFE_SQL_IDENT.test(name)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid SQL identifier (use letters, numbers, underscore only).',
    })
  }
}

function quoteSqlIdent(name: string): string {
  assertSqlIdent(name)
  return `"${name.replaceAll('"', '""')}"`
}

function parseTableRef(
  value: string,
  fallbackSchema = 'public',
): { schema: string; table: string; displayName: string } {
  const trimmed = value.trim()
  if (!trimmed) {
    throw createError({ statusCode: 400, statusMessage: 'Missing table name.' })
  }

  const parts = trimmed.split('.').filter(Boolean)
  if (parts.length === 1) {
    assertSqlIdent(fallbackSchema)
    assertSqlIdent(parts[0] || '')
    return {
      schema: fallbackSchema,
      table: parts[0] || '',
      displayName: `${fallbackSchema}.${parts[0] || ''}`,
    }
  }

  if (parts.length === 2) {
    assertSqlIdent(parts[0] || '')
    assertSqlIdent(parts[1] || '')
    return {
      schema: parts[0] || '',
      table: parts[1] || '',
      displayName: `${parts[0] || ''}.${parts[1] || ''}`,
    }
  }

  throw createError({
    statusCode: 400,
    statusMessage: 'Invalid table name. Use "table" or "schema.table".',
  })
}

export function quoteQualifiedTableRef(
  value: string,
  fallbackSchema = 'public',
): { schema: string; table: string; displayName: string; quoted: string } {
  const parsed = parseTableRef(value, fallbackSchema)
  return {
    ...parsed,
    quoted: `${quoteSqlIdent(parsed.schema)}.${quoteSqlIdent(parsed.table)}`,
  }
}

export function formatPostgresTableName(schema: string, table: string): string {
  assertSqlIdent(schema)
  assertSqlIdent(table)
  return `${schema}.${table}`
}

function getColumnRowValue(row: Record<string, unknown>, key: string): unknown {
  const lower = key.toLowerCase()
  const match = Object.keys(row).find((candidate) => candidate.toLowerCase() === lower)
  return match ? row[match] : undefined
}

export function mapPostgresColumnRow(row: Record<string, unknown>) {
  return {
    cid: Number(getColumnRowValue(row, 'cid') ?? 0),
    name: String(getColumnRowValue(row, 'name') ?? ''),
    type: String(getColumnRowValue(row, 'type') ?? ''),
    notnull: Number(getColumnRowValue(row, 'notnull') ?? 0),
    dflt_value: getColumnRowValue(row, 'dflt_value') ?? null,
    pk: Number(getColumnRowValue(row, 'pk') ?? 0),
  }
}

function normalizePgValue(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString()
  if (value instanceof Date) return value.toISOString()
  if (value instanceof Uint8Array) return Buffer.from(value).toString('base64')
  return value
}

function normalizePgRow(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, normalizePgValue(value)]))
}

function buildPgMeta(result: Record<string, unknown>): Record<string, unknown> {
  const meta: Record<string, unknown> = {}

  if (typeof result.command === 'string' && result.command) {
    meta.command = result.command
  }
  if (typeof result.count === 'number') {
    meta.count = result.count
  }
  if (Array.isArray(result.columns)) {
    meta.columns = result.columns
      .map((column) => {
        if (column && typeof column === 'object' && 'name' in column) {
          return String((column as { name: unknown }).name)
        }
        return null
      })
      .filter((column): column is string => Boolean(column))
  }

  return meta
}

function parseDatabaseName(connectionString: string): string {
  try {
    const url = new URL(connectionString)
    const name = url.pathname.replace(/^\/+/, '').trim()
    if (name) return decodeURIComponent(name)
  } catch {
    // Fall through to default.
  }

  return 'postgres'
}

async function withPgClient<T>(
  event: H3Event,
  handler: (sql: ReturnType<typeof postgres>, databaseName: string) => Promise<T>,
): Promise<T> {
  const connectionString = useHyperdriveConnectionString(event)
  const sql = postgres(connectionString, {
    prepare: false,
    max: 1,
    fetch_types: false,
    idle_timeout: 5,
    connect_timeout: 15,
  })

  try {
    return await handler(sql, parseDatabaseName(connectionString))
  } finally {
    await sql.end({ timeout: 5 })
  }
}

function matchDollarTag(sql: string, index: number): string | null {
  const slice = sql.slice(index)
  const match = slice.match(/^\$(?:[a-z_]\w*)?\$/i)
  return match?.[0] ?? null
}

function splitSqlStatements(sql: string): string[] {
  const statements: string[] = []
  let current = ''
  let index = 0
  let mode: 'code' | 'single' | 'double' | 'line-comment' | 'block-comment' | 'dollar' = 'code'
  let blockDepth = 0
  let dollarTag = ''

  while (index < sql.length) {
    if (mode === 'code') {
      if (sql.startsWith('--', index)) {
        current += '--'
        index += 2
        mode = 'line-comment'
        continue
      }

      if (sql.startsWith('/*', index)) {
        current += '/*'
        index += 2
        mode = 'block-comment'
        blockDepth = 1
        continue
      }

      const tag = matchDollarTag(sql, index)
      if (tag) {
        current += tag
        index += tag.length
        mode = 'dollar'
        dollarTag = tag
        continue
      }

      const char = sql[index]
      if (char === "'") {
        current += char
        index += 1
        mode = 'single'
        continue
      }

      if (char === '"') {
        current += char
        index += 1
        mode = 'double'
        continue
      }

      if (char === ';') {
        const trimmed = current.trim()
        if (trimmed) statements.push(trimmed)
        current = ''
        index += 1
        continue
      }

      current += char
      index += 1
      continue
    }

    if (mode === 'single') {
      const char = sql[index]
      current += char
      index += 1

      if (char === "'" && sql[index] === "'") {
        current += sql[index]
        index += 1
        continue
      }

      if (char === "'") mode = 'code'
      continue
    }

    if (mode === 'double') {
      const char = sql[index]
      current += char
      index += 1

      if (char === '"' && sql[index] === '"') {
        current += sql[index]
        index += 1
        continue
      }

      if (char === '"') mode = 'code'
      continue
    }

    if (mode === 'line-comment') {
      const char = sql[index]
      current += char
      index += 1

      if (char === '\n') mode = 'code'
      continue
    }

    if (mode === 'block-comment') {
      if (sql.startsWith('/*', index)) {
        current += '/*'
        index += 2
        blockDepth += 1
        continue
      }

      if (sql.startsWith('*/', index)) {
        current += '*/'
        index += 2
        blockDepth -= 1
        if (blockDepth <= 0) mode = 'code'
        continue
      }

      current += sql[index]
      index += 1
      continue
    }

    if (sql.startsWith(dollarTag, index)) {
      current += dollarTag
      index += dollarTag.length
      dollarTag = ''
      mode = 'code'
      continue
    }

    current += sql[index]
    index += 1
  }

  const trimmed = current.trim()
  if (trimmed) statements.push(trimmed)

  return statements
}

function assertSingleStatement(sql: string): string {
  const statements = splitSqlStatements(sql)
  if (statements.length !== 1) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Parameterized Postgres queries must contain exactly one SQL statement.',
    })
  }
  return statements[0] || ''
}

export async function queryControlPlanePostgresRows(
  event: H3Event,
  options: { sql: string; params?: PgQueryParam[] },
): Promise<{ databaseName: string; rows: Record<string, unknown>[] }> {
  return withPgClient(event, async (client, databaseName) => {
    const rows = options.params?.length
      ? await client.unsafe<Record<string, unknown>[]>(options.sql, options.params)
      : await client.unsafe<Record<string, unknown>[]>(options.sql)

    return { databaseName, rows: rows.map(normalizePgRow) }
  })
}

export async function queryControlPlanePostgresScalar(
  event: H3Event,
  sql: string,
  params?: PgQueryParam[],
): Promise<number> {
  const { rows } = await queryControlPlanePostgresRows(event, { sql, params })
  const firstRow = rows[0]
  if (!firstRow) return 0

  const firstValue = Object.values(firstRow)[0]
  if (typeof firstValue === 'number' && Number.isFinite(firstValue)) return firstValue
  if (typeof firstValue === 'string' && firstValue.trim()) {
    const parsed = Number(firstValue)
    if (Number.isFinite(parsed)) return parsed
  }

  return 0
}

export async function executeControlPlanePostgresSql(
  event: H3Event,
  options: { sql: string; params?: PgQueryParam[] },
): Promise<{
  databaseName: string
  result: Array<{
    success: true
    results: Record<string, unknown>[]
    meta: Record<string, unknown>
  }>
}> {
  return withPgClient(event, async (client, databaseName) => {
    if (options.params && options.params.length > 0) {
      const statement = assertSingleStatement(options.sql)
      const rows = await client.unsafe<Record<string, unknown>[]>(statement, options.params)
      return {
        databaseName,
        result: [
          {
            success: true as const,
            results: rows.map(normalizePgRow),
            meta: buildPgMeta(rows as unknown as Record<string, unknown>),
          },
        ],
      }
    }

    const statements = splitSqlStatements(options.sql)
    if (statements.length === 0) {
      return { databaseName, result: [] }
    }

    const result: Array<{
      success: true
      results: Record<string, unknown>[]
      meta: Record<string, unknown>
    }> = []

    for (let index = 0; index < statements.length; index += 1) {
      const statement = statements[index]
      if (!statement) continue

      try {
        const rows = await client.unsafe<Record<string, unknown>[]>(statement).simple()
        result.push({
          success: true as const,
          results: rows.map(normalizePgRow),
          meta: buildPgMeta(rows as unknown as Record<string, unknown>),
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        throw createError({
          statusCode: 400,
          statusMessage: `Statement ${index + 1} failed: ${message}`,
        })
      }
    }

    return { databaseName, result }
  })
}
