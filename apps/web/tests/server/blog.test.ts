/**
 * Unit tests for blog spotlight pure utilities.
 * Imports the real exported functions from server/utils/blog/pure.ts
 * using relative paths (no Nuxt alias resolution needed).
 */
import { describe, it, expect } from 'vitest'
import {
  BLOG_ANGLE_IDS,
  buildPostSlug,
  sortAnglesByRotation,
  formatUsdBig,
  signedPct,
} from '../../server/utils/blog/pure'

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
    const sorted = sortAnglesByRotation(rows)
    expect(sorted[0]!.id).toBe('b') // never used
    expect(sorted[1]!.id).toBe('c') // oldest lastUsedAt
    expect(sorted[2]!.id).toBe('a')
  })

  it('uses useCount as tiebreaker when both lastUsedAt are null', () => {
    const rows = [
      { id: 'a', lastUsedAt: null, useCount: 3 },
      { id: 'b', lastUsedAt: null, useCount: 1 },
    ]
    const sorted = sortAnglesByRotation(rows)
    expect(sorted[0]!.id).toBe('b') // lower useCount wins
  })

  it('picks oldest lastUsedAt when neither is null', () => {
    const rows = [
      { id: 'a', lastUsedAt: new Date('2026-03-25'), useCount: 0 },
      { id: 'b', lastUsedAt: new Date('2026-03-10'), useCount: 10 },
    ]
    const sorted = sortAnglesByRotation(rows)
    expect(sorted[0]!.id).toBe('b') // older date wins despite higher useCount
  })

  it('handles a single row', () => {
    const rows = [{ id: 'a', lastUsedAt: null, useCount: 0 }]
    const sorted = sortAnglesByRotation(rows)
    expect(sorted[0]!.id).toBe('a')
  })
})

describe('formatUsdBig', () => {
  it('abbreviates billions', () => {
    expect(formatUsdBig(2_500_000_000)).toBe('$2.50B')
  })

  it('abbreviates millions', () => {
    expect(formatUsdBig(1_234_567)).toBe('$1.2M')
  })

  it('abbreviates thousands', () => {
    expect(formatUsdBig(45_678)).toBe('$46K')
  })

  it('formats small amounts without abbreviation', () => {
    expect(formatUsdBig(99.5)).toBe('$99.50')
  })

  it('preserves sign for negative millions', () => {
    expect(formatUsdBig(-1_234_567)).toBe('-$1.2M')
  })

  it('preserves sign for negative billions', () => {
    expect(formatUsdBig(-2_500_000_000)).toBe('-$2.50B')
  })

  it('preserves sign for negative thousands', () => {
    expect(formatUsdBig(-45_678)).toBe('-$46K')
  })

  it('formats negative small amounts correctly', () => {
    expect(formatUsdBig(-99.5)).toBe('-$99.50')
  })

  it('formats zero', () => {
    expect(formatUsdBig(0)).toBe('$0.00')
  })
})

describe('signedPct', () => {
  it('returns +N.n% for a positive delta', () => {
    expect(signedPct(300, 1000)).toBe('+30.0%')
  })

  it('returns -N.n% for a negative delta', () => {
    expect(signedPct(-150, 1000)).toBe('-15.0%')
  })

  it('returns +0.0% for zero delta with non-zero base', () => {
    expect(signedPct(0, 1000)).toBe('+0.0%')
  })

  it('returns 0.0% when base is zero', () => {
    expect(signedPct(100, 0)).toBe('0.0%')
  })

  it('rounds to one decimal place', () => {
    expect(signedPct(1, 3)).toBe('+33.3%')
  })
})
