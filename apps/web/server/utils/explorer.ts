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
const titleCaseStopWords = new Set([
  'a',
  'an',
  'and',
  'as',
  'at',
  'by',
  'for',
  'from',
  'in',
  'of',
  'on',
  'or',
  'the',
  'to',
  'vs',
  'via',
])

export function normalizeSearchTerm(value: string) {
  return value.toUpperCase().replaceAll(/[^A-Z0-9 ]/g, '')
}

function capitalizeCompoundWord(value: string) {
  return value.replaceAll(/(^|[-/])([a-z])/g, (_, separator: string, character: string) => {
    return `${separator}${character.toUpperCase()}`
  })
}

export function toHumanTitleCase(value: string | null | undefined, fallback = 'Unknown') {
  if (!value) {
    return fallback
  }

  const normalizedValue = value.toLowerCase().replaceAll(/\s+/g, ' ').trim()
  const words = normalizedValue.split(' ')

  return words
    .map((word, index) => {
      if (!word) {
        return word
      }

      const isBoundaryWord = index === 0 || index === words.length - 1
      const plainWord = word.replaceAll(/[^a-z]/g, '')

      if (!isBoundaryWord && titleCaseStopWords.has(plainWord)) {
        return word
      }

      return capitalizeCompoundWord(word)
    })
    .join(' ')
}

export function toDisplayName(value: string | null | undefined, fallback = 'Unknown') {
  return toHumanTitleCase(value, fallback)
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

export function formatCategoryDisplayName(
  value: string | null | undefined,
  fallback = 'Uncategorized',
) {
  return toHumanTitleCase(value, fallback)
}

export function slugifyCategory(value: string | null | undefined, fallback = 'uncategorized') {
  const source = value?.trim() || fallback
  return source
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/(^-|-$)/g, '')
}

function sqlStringLiteral(value: string) {
  return sql.raw(`'${value.replaceAll("'", "''")}'`)
}

function categoryCodeSql(column: SqlValue, fallback: string) {
  const fallbackLiteral = sqlStringLiteral(fallback)
  return sql<string>`lower(regexp_replace(regexp_replace(coalesce(${column}, ${fallbackLiteral}), '[^A-Za-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g'))`
}

function categoryTitleSql(column: SqlValue, fallback: string) {
  const fallbackLiteral = sqlStringLiteral(fallback)
  return sql<string>`initcap(lower(coalesce(${column}, ${fallbackLiteral})))`
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
