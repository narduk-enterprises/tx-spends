/**
 * Pure (side-effect-free) blog utilities.
 *
 * Exported separately so they can be unit-tested without requiring Nuxt path
 * alias resolution or a live database connection.
 */

/**
 * Format a dollar amount with magnitude abbreviations, preserving sign.
 * Negative values render as e.g. `-$1.23M` rather than `$-1.23M`.
 */
export function formatUsdBig(value: number): string {
  const abs = Math.abs(value)
  const prefix = value < 0 ? '-$' : '$'
  if (abs >= 1_000_000_000) return `${prefix}${(abs / 1_000_000_000).toFixed(2)}B`
  if (abs >= 1_000_000) return `${prefix}${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${prefix}${(abs / 1_000).toFixed(0)}K`
  return `${prefix}${abs.toFixed(2)}`
}

/**
 * Format a signed percentage string for a delta value relative to a base.
 * e.g. `+3.5%` for an increase, `-2.1%` for a decrease, `+0.0%` for zero delta.
 * Returns `'N/A'` when the base (`total`) is zero to avoid misleading output.
 */
export function signedPct(value: number, total: number): string {
  if (total === 0) return 'N/A'
  const sign = value >= 0 ? '+' : '-'
  return `${sign}${((Math.abs(value) / total) * 100).toFixed(1)}%`
}

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
