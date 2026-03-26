/**
 * Pure (side-effect-free) blog utilities.
 *
 * Exported separately so they can be unit-tested without requiring Nuxt path
 * alias resolution or a live database connection.
 */

/** Canonical IDs for all supported spotlight angles. */
export const BLOG_ANGLE_IDS = [
  'agency-spend-leaders',
  'category-trends',
  'payee-concentration',
  'confidentiality-patterns',
  'county-distribution',
  'object-code-breakdown',
  'fiscal-year-contrast',
  'agency-growth-movers',
] as const

export type BlogAngleId = (typeof BLOG_ANGLE_IDS)[number]

/**
 * Build a date-based slug from an angle ID.
 * Format: `{angle-id}-{YYYY-MM-DD}` e.g. `agency-spend-leaders-2026-03-26`
 *
 * If that slug already exists, the caller appends a unique suffix.
 */
export function buildPostSlug(angleId: string, date: Date = new Date()): string {
  const yyyy = date.getUTCFullYear()
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(date.getUTCDate()).padStart(2, '0')
  return `${angleId}-${yyyy}-${mm}-${dd}`
}

/**
 * Sort angle rows by rotation priority:
 *   1. Never-used angles (lastUsedAt === null) — lowest useCount wins among ties
 *   2. Oldest lastUsedAt — lowest useCount wins among ties
 */
export function sortAnglesByRotation<T extends { lastUsedAt: Date | null; useCount: number }>(
  rows: T[],
): T[] {
  return [...rows].sort((a, b) => {
    const aNull = a.lastUsedAt === null
    const bNull = b.lastUsedAt === null
    if (aNull && !bNull) return -1
    if (!aNull && bNull) return 1
    if (aNull && bNull) return a.useCount - b.useCount

    const timeDiff = (a.lastUsedAt as Date).getTime() - (b.lastUsedAt as Date).getTime()
    if (timeDiff !== 0) return timeDiff
    return a.useCount - b.useCount
  })
}
