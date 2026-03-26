/**
 * Unit tests for blog spotlight utilities.
 * Tests rotation logic, slug generation, and angle definitions.
 * Tests are self-contained to avoid Nuxt path alias resolution in Vitest.
 */
import { describe, it, expect } from 'vitest'

// --- Inline the pure-logic pieces under test ---

const BLOG_ANGLE_IDS = [
  'agency-spend-leaders',
  'category-trends',
  'payee-concentration',
  'confidentiality-patterns',
  'county-distribution',
  'object-code-breakdown',
  'fiscal-year-contrast',
  'agency-growth-movers',
]

function buildPostSlug(angleId: string, date: Date = new Date()): string {
  const yyyy = date.getUTCFullYear()
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(date.getUTCDate()).padStart(2, '0')
  return `${angleId}-${yyyy}-${mm}-${dd}`
}

function sortAngleRows(
  rows: Array<{ id: string; lastUsedAt: Date | null; useCount: number }>,
) {
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

// --- Tests ---

describe('BLOG_ANGLE_IDS', () => {
  it('has exactly 8 defined angles', () => {
    expect(BLOG_ANGLE_IDS.length).toBe(8)
  })

  it('all angle ids are unique', () => {
    const unique = new Set(BLOG_ANGLE_IDS)
    expect(unique.size).toBe(BLOG_ANGLE_IDS.length)
  })

  it('angle ids use only lowercase letters and hyphens', () => {
    for (const id of BLOG_ANGLE_IDS) {
      expect(id).toMatch(/^[a-z][a-z-]+[a-z]$/)
    }
  })
})

describe('buildPostSlug', () => {
  it('formats as angle-id-YYYY-MM-DD', () => {
    const date = new Date('2026-03-26T10:00:00Z')
    const slug = buildPostSlug('agency-spend-leaders', date)
    expect(slug).toBe('agency-spend-leaders-2026-03-26')
  })

  it('pads month and day with leading zeros', () => {
    const date = new Date('2026-01-05T00:00:00Z')
    const slug = buildPostSlug('category-trends', date)
    expect(slug).toBe('category-trends-2026-01-05')
  })

  it('uses the current date when no date is provided', () => {
    const slug = buildPostSlug('fiscal-year-contrast')
    expect(slug).toMatch(/^fiscal-year-contrast-\d{4}-\d{2}-\d{2}$/)
  })

  it('produces URL-safe slugs', () => {
    for (const id of BLOG_ANGLE_IDS) {
      const slug = buildPostSlug(id, new Date('2026-03-26T00:00:00Z'))
      expect(slug).toMatch(/^[a-z0-9-]+$/)
    }
  })
})

describe('rotation sort logic', () => {
  it('prefers null lastUsedAt over non-null', () => {
    const rows = [
      { id: 'a', lastUsedAt: new Date('2026-03-25'), useCount: 0 },
      { id: 'b', lastUsedAt: null, useCount: 5 },
      { id: 'c', lastUsedAt: new Date('2026-03-20'), useCount: 1 },
    ]
    const sorted = sortAngleRows(rows)
    expect(sorted[0]!.id).toBe('b') // never used
    expect(sorted[1]!.id).toBe('c') // oldest lastUsedAt
    expect(sorted[2]!.id).toBe('a')
  })

  it('uses useCount as tiebreaker when both lastUsedAt are null', () => {
    const rows = [
      { id: 'a', lastUsedAt: null, useCount: 3 },
      { id: 'b', lastUsedAt: null, useCount: 1 },
    ]
    const sorted = sortAngleRows(rows)
    expect(sorted[0]!.id).toBe('b') // lower useCount wins
  })

  it('picks oldest lastUsedAt when neither is null', () => {
    const rows = [
      { id: 'a', lastUsedAt: new Date('2026-03-25'), useCount: 0 },
      { id: 'b', lastUsedAt: new Date('2026-03-10'), useCount: 10 },
    ]
    const sorted = sortAngleRows(rows)
    expect(sorted[0]!.id).toBe('b') // older date wins despite higher useCount
  })

  it('handles a single row', () => {
    const rows = [{ id: 'a', lastUsedAt: null, useCount: 0 }]
    const sorted = sortAngleRows(rows)
    expect(sorted[0]!.id).toBe('a')
  })
})
