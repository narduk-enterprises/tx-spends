import { describe, expect, it } from 'vitest'
import {
  buildTrendSummary,
  computeCagr,
  computeConcentrationMetrics,
  computeVolatility,
  describeConcentration,
} from '../../server/utils/analysis-metrics'
import { analysisQuerySchema } from '../../server/utils/analysis-query'

describe('analysisQuerySchema', () => {
  it('defaults to the payments dataset and system subject', () => {
    const result = analysisQuerySchema.parse({})

    expect(result.dataset).toBe('payments')
    expect(result.subject).toBe('system')
    expect(result.relationship).toBe('agency_payee')
    expect(result.min_change_amount).toBe(1_000_000)
    expect(result.min_change_pct).toBe(25)
  })

  it('rejects county analysis with a payee subject', () => {
    expect(() =>
      analysisQuerySchema.parse({
        dataset: 'counties',
        subject: 'payee',
      }),
    ).toThrow(/County analysis does not support payee subjects/i)
  })

  it('rejects county analysis with payment-only filters', () => {
    expect(() =>
      analysisQuerySchema.parse({
        dataset: 'counties',
        payee_id: '00000000-0000-0000-0000-000000000001',
      }),
    ).toThrow(/cannot filter by payee_id/i)

    expect(() =>
      analysisQuerySchema.parse({
        dataset: 'counties',
        object_code: '7211',
      }),
    ).toThrow(/cannot filter by object_code/i)
  })

  it('rejects county as a transaction-level payments subject', () => {
    expect(() =>
      analysisQuerySchema.parse({
        dataset: 'payments',
        subject: 'county',
      }),
    ).toThrow(/cannot use county as a transaction-level subject/i)
  })
})

describe('analysis metrics', () => {
  it('computes CAGR across a multi-year range', () => {
    expect(
      computeCagr([
        { fiscal_year: 2022, amount: 100 },
        { fiscal_year: 2024, amount: 225 },
      ]),
    ).toBeCloseTo(50, 5)
  })

  it('returns null CAGR when the range is not meaningful', () => {
    expect(computeCagr([{ fiscal_year: 2024, amount: 100 }])).toBeNull()
    expect(
      computeCagr([
        { fiscal_year: 2024, amount: 0 },
        { fiscal_year: 2025, amount: 100 },
      ]),
    ).toBeNull()
  })

  it('computes volatility from year-over-year changes', () => {
    expect(
      computeVolatility([
        { fiscal_year: 2022, amount: 100 },
        { fiscal_year: 2023, amount: 150 },
        { fiscal_year: 2024, amount: 120 },
        { fiscal_year: 2025, amount: 180 },
      ]),
    ).toBeGreaterThan(0)

    expect(
      computeVolatility([
        { fiscal_year: 2024, amount: 100 },
        { fiscal_year: 2025, amount: 125 },
      ]),
    ).toBeNull()
  })

  it('computes concentration metrics for a ranked slice', () => {
    const result = computeConcentrationMetrics([
      { amount: 50, share: 0 },
      { amount: 30, share: 0 },
      { amount: 20, share: 0 },
    ])

    expect(result.total_amount).toBe(100)
    expect(result.top_5_share).toBeCloseTo(1, 5)
    expect(result.top_10_share).toBeCloseTo(1, 5)
    expect(result.hhi).toBeCloseTo(0.38, 5)
    expect(result.interpretation).toBe(describeConcentration(result.hhi))
  })

  it('builds a concrete trend summary from computed metrics', () => {
    const summary = buildTrendSummary('Agency X', [
      { fiscal_year: 2023, amount: 100 },
      { fiscal_year: 2024, amount: 150 },
      { fiscal_year: 2025, amount: 225 },
    ])

    expect(summary).toContain('Agency X increased')
    expect(summary).toContain('FY 2025')
    expect(summary).toContain('50.0% year over year')
    expect(summary).toContain('50.0% CAGR')
  })
})
