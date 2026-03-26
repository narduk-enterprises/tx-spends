/**
 * Computes the percentage change between two values, rounded to one decimal place.
 * Returns null when the prior value is zero or negative (undefined change).
 */
export function computePctChange(current: number, prior: number): number | null {
  if (prior <= 0) {
    return null
  }

  return Math.round(((current - prior) / prior) * 1000) / 10
}

export interface YoyMoverRow {
  id: string | null
  name: string
  current_amount: number
  prior_amount: number
  pct_change: number
}

/**
 * Computes year-over-year movers by joining current and prior year rows on id.
 * Only includes rows present in both sets with a positive prior amount.
 * Returns top `limit` increases (sorted desc) and top `limit` decreases (sorted asc).
 */
export function computeYoyMovers(
  currentRows: Array<{ id: string | null; name: string; amount: number }>,
  priorRows: Array<{ id: string | null; amount: number }>,
  limit = 5,
): { increases: YoyMoverRow[]; decreases: YoyMoverRow[] } {
  const priorMap = new Map<string, number>()
  for (const row of priorRows) {
    if (row.id) {
      priorMap.set(row.id, Number(row.amount))
    }
  }

  const movers: YoyMoverRow[] = []
  for (const row of currentRows) {
    if (!row.id) continue
    const prior = priorMap.get(row.id)
    if (prior === undefined || prior <= 0) continue
    const pct = computePctChange(row.amount, prior)
    if (pct === null) continue
    movers.push({
      id: row.id,
      name: row.name,
      current_amount: row.amount,
      prior_amount: prior,
      pct_change: pct,
    })
  }

  const increases = movers
    .filter((m) => m.pct_change > 0)
    .sort((a, b) => b.pct_change - a.pct_change)
    .slice(0, limit)

  const decreases = movers
    .filter((m) => m.pct_change < 0)
    .sort((a, b) => a.pct_change - b.pct_change)
    .slice(0, limit)

  return { increases, decreases }
}
