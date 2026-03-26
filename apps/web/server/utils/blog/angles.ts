/**
 * Blog spotlight angle definitions and rotation strategy.
 *
 * Each angle represents a distinct editorial perspective on Texas state
 * spending data. The rotation strategy ensures daily variety by picking
 * the angle that has been idle the longest, with use-count as a tiebreaker.
 */
import type { H3Event } from 'h3'
import { eq, sql } from 'drizzle-orm'
import { useAppDatabase } from '#server/utils/database'
import { blogAngles } from '#server/database/schema'

export interface BlogAngleDefinition {
  id: string
  name: string
  description: string
}

/**
 * All supported spotlight angles.
 * These are seeded into the `blog_angles` table on first use.
 */
export const BLOG_ANGLE_DEFINITIONS: BlogAngleDefinition[] = [
  {
    id: 'agency-spend-leaders',
    name: 'Agency Spending Leaders',
    description:
      'Top state agencies by total spending in the most recent fiscal year, with context on scale and concentration.',
  },
  {
    id: 'category-trends',
    name: 'Expenditure Category Trends',
    description:
      'Year-over-year spending changes across major expenditure categories, highlighting where the budget is shifting.',
  },
  {
    id: 'payee-concentration',
    name: 'Payee Spending Concentration',
    description:
      'How concentrated Texas state spending is across the top payees — what share flows to the largest recipients.',
  },
  {
    id: 'confidentiality-patterns',
    name: 'Confidential Payment Patterns',
    description:
      'Scale and distribution of payments marked confidential, examining which agencies account for this spending.',
  },
  {
    id: 'county-distribution',
    name: 'County Expenditure Distribution',
    description:
      'How county-level state expenditures are distributed across Texas, spotlighting geographic patterns.',
  },
  {
    id: 'object-code-breakdown',
    name: 'Comptroller Object Code Breakdown',
    description:
      'Spending patterns by comptroller object code, showing what categories of expenditure dominate the ledger.',
  },
  {
    id: 'fiscal-year-contrast',
    name: 'Fiscal Year Spending Contrast',
    description:
      'Side-by-side comparison of the two most recent fiscal years, measuring overall budget trajectory.',
  },
  {
    id: 'agency-growth-movers',
    name: 'Biggest Agency Spending Movers',
    description:
      'State agencies with the largest year-over-year spending changes — both increases and reductions.',
  },
]

/**
 * Ensure all angle definitions exist in the database.
 * No-op if they are already present (idempotent seed).
 */
export async function seedBlogAngles(event: H3Event): Promise<void> {
  const db = useAppDatabase(event)

  for (const angle of BLOG_ANGLE_DEFINITIONS) {
    await db
      .insert(blogAngles)
      .values({
        id: angle.id,
        name: angle.name,
        description: angle.description,
      })
      .onConflictDoNothing()
  }
}

/**
 * Pick the next angle to spotlight.
 *
 * Strategy: among active angles, prefer the one that has never been used
 * (lastUsedAt IS NULL), then the one with the oldest lastUsedAt, with
 * useCount as a tiebreaker (lower count wins).
 *
 * Falls back to the first defined angle if the table is empty.
 */
export async function pickNextAngle(event: H3Event): Promise<string> {
  const db = useAppDatabase(event)

  await seedBlogAngles(event)

  const rows = await db
    .select({
      id: blogAngles.id,
      lastUsedAt: blogAngles.lastUsedAt,
      useCount: blogAngles.useCount,
    })
    .from(blogAngles)
    .where(eq(blogAngles.isActive, true))
    .limit(50)

  if (rows.length === 0) {
    return BLOG_ANGLE_DEFINITIONS[0]!.id
  }

  // Sort: never-used (null) first, then oldest lastUsedAt, then lowest useCount
  const sorted = [...rows].sort((a, b) => {
    const aNull = a.lastUsedAt === null
    const bNull = b.lastUsedAt === null
    if (aNull && !bNull) return -1
    if (!aNull && bNull) return 1
    if (aNull && bNull) return a.useCount - b.useCount

    const timeDiff = (a.lastUsedAt as Date).getTime() - (b.lastUsedAt as Date).getTime()
    if (timeDiff !== 0) return timeDiff
    return a.useCount - b.useCount
  })

  return sorted[0]!.id
}

/**
 * Mark an angle as used, updating its lastUsedAt and incrementing useCount.
 */
export async function markAngleUsed(event: H3Event, angleId: string): Promise<void> {
  const db = useAppDatabase(event)
  await db
    .update(blogAngles)
    .set({
      lastUsedAt: new Date(),
      useCount: sql`${blogAngles.useCount} + 1`,
    })
    .where(eq(blogAngles.id, angleId))
}
