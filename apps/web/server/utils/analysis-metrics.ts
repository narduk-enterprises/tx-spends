export interface TimeSeriesPoint {
  fiscal_year: number
  amount: number
}

export function numberValue(value: number | string | null | undefined) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}

export function computePercentChange(current: number, prior: number) {
  if (!Number.isFinite(current) || !Number.isFinite(prior) || prior <= 0) {
    return null
  }

  return ((current - prior) / prior) * 100
}

export function computeCagr(series: TimeSeriesPoint[]) {
  if (series.length < 2) {
    return null
  }

  const sorted = [...series].sort((left, right) => left.fiscal_year - right.fiscal_year)
  const first = sorted[0]
  const last = sorted.at(-1)

  if (!first || !last || first.amount <= 0 || last.amount <= 0) {
    return null
  }

  const periods = last.fiscal_year - first.fiscal_year
  if (periods <= 0) {
    return null
  }

  return (Math.pow(last.amount / first.amount, 1 / periods) - 1) * 100
}

export function computeVolatility(series: TimeSeriesPoint[]) {
  if (series.length < 3) {
    return null
  }

  const sorted = [...series].sort((left, right) => left.fiscal_year - right.fiscal_year)
  const pctChanges = sorted
    .slice(1)
    .map((point, index) => computePercentChange(point.amount, sorted[index]!.amount))
    .filter((value): value is number => value !== null)

  if (pctChanges.length < 2) {
    return null
  }

  const mean = pctChanges.reduce((sum, value) => sum + value, 0) / pctChanges.length
  const variance =
    pctChanges.reduce((sum, value) => sum + (value - mean) ** 2, 0) / pctChanges.length

  return Math.sqrt(variance)
}

export interface ShareRow {
  amount: number
  share: number
}

export interface ConcentrationMetrics {
  total_amount: number
  top_5_share: number
  top_10_share: number
  top_25_share: number
  hhi: number
  interpretation: string
}

export function describeConcentration(hhi: number) {
  if (hhi >= 0.25) {
    return 'Highly concentrated. A small set of entities accounts for most of the observed amount.'
  }

  if (hhi >= 0.15) {
    return 'Moderately concentrated. A clear leading group exists, but the long tail still matters.'
  }

  return 'Broadly distributed. No single small group dominates the observed amount.'
}

export function computeConcentrationMetrics(rows: ShareRow[]): ConcentrationMetrics {
  const sorted = [...rows].sort((left, right) => right.amount - left.amount)
  const totalAmount = sorted.reduce((sum, row) => sum + row.amount, 0)
  const shares = sorted.map((row) => (totalAmount > 0 ? row.amount / totalAmount : 0))
  const cumulativeShares = shares.reduce<number[]>((acc, share, index) => {
    const previous = index > 0 ? acc[index - 1] || 0 : 0
    acc.push(previous + share)
    return acc
  }, [])
  const hhi = shares.reduce((sum, share) => sum + share ** 2, 0)

  return {
    total_amount: totalAmount,
    top_5_share: cumulativeShares[Math.min(4, cumulativeShares.length - 1)] || 0,
    top_10_share: cumulativeShares[Math.min(9, cumulativeShares.length - 1)] || 0,
    top_25_share: cumulativeShares[Math.min(24, cumulativeShares.length - 1)] || 0,
    hhi,
    interpretation: describeConcentration(hhi),
  }
}

export function buildTrendSummary(label: string, series: TimeSeriesPoint[]) {
  if (series.length === 0) {
    return `No fiscal-year series is available for ${label}.`
  }

  if (series.length === 1) {
    return `${label} currently has one loaded fiscal-year point, so trend direction is not yet meaningful.`
  }

  const sorted = [...series].sort((left, right) => left.fiscal_year - right.fiscal_year)
  const latest = sorted.at(-1)!
  const prior = sorted.at(-2)!
  const pctChange = computePercentChange(latest.amount, prior.amount)
  const cagr = computeCagr(sorted)

  const direction =
    latest.amount > prior.amount
      ? 'increased'
      : latest.amount < prior.amount
        ? 'decreased'
        : 'held flat'
  const pctText =
    pctChange === null
      ? 'from a minimal or zero prior base'
      : `${pctChange.toFixed(1)}% year over year`
  const cagrText =
    cagr === null
      ? 'without a stable multi-year growth rate yet'
      : `with a ${cagr.toFixed(1)}% CAGR across the visible range`

  return `${label} ${direction} to ${latest.amount.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} in FY ${latest.fiscal_year}, ${pctText} and ${cagrText}.`
}
