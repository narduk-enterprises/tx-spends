import { sql, type SQL, type AnyColumn } from 'drizzle-orm'

type SqlValue = AnyColumn | SQL<unknown>
const specialCountyDisplayNames: Record<string, string> = {
  DEWITT: 'DeWitt',
  INTEX: 'In Texas',
  INTEXAS: 'In Texas',
  LASALLE: 'La Salle',
  MCCULLOCH: 'McCulloch',
  MCLENNAN: 'McLennan',
  MCMULLEN: 'McMullen',
  RAINES: 'Rains',
}

export function normalizeSearchTerm(value: string) {
  return value.toUpperCase().replaceAll(/[^A-Z0-9 ]/g, '')
}

export function toDisplayName(value: string | null | undefined, fallback = 'Unknown') {
  if (!value) {
    return fallback
  }

  return value.toLowerCase().replaceAll(/\b\w/g, (letter) => letter.toUpperCase())
}

export function formatCountyDisplayName(value: string | null | undefined, fallback = 'Unknown') {
  if (!value) {
    return fallback
  }

  const compactKey = value.toUpperCase().replaceAll(/\s+/g, '')
  return specialCountyDisplayNames[compactKey] || toDisplayName(value, fallback)
}

export function formatAgencyDisplayName(
  value: string | null | undefined,
  fallback = 'Unknown agency',
) {
  return toDisplayName(value, fallback)
}

export function slugifyCategory(value: string | null | undefined, fallback = 'uncategorized') {
  const source = value?.trim() || fallback
  return source
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/(^-|-$)/g, '')
}

function categoryCodeSql(column: SqlValue, fallback: string) {
  const fallbackLiteral = sql.raw(`'${fallback.replaceAll("'", "''")}'`)
  return sql<string>`lower(regexp_replace(regexp_replace(coalesce(${column}, ${fallbackLiteral}), '[^A-Za-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g'))`
}

function categoryTitleSql(column: SqlValue, fallback: string) {
  const fallbackLiteral = sql.raw(`'${fallback.replaceAll("'", "''")}'`)
  return sql<string>`coalesce(${column}, ${fallbackLiteral})`
}

export function paymentCategoryCodeSql(column: SqlValue) {
  return categoryCodeSql(column, 'Uncategorized')
}

export function paymentCategoryTitleSql(column: SqlValue) {
  return categoryTitleSql(column, 'Uncategorized')
}

export function countyCategoryCodeSql(column: SqlValue) {
  return categoryCodeSql(column, 'Uncategorized')
}

export function countyCategoryTitleSql(column: SqlValue) {
  return categoryTitleSql(column, 'Uncategorized')
}
