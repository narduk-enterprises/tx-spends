import { describe, expect, it } from 'vitest'
import { computePctChange, computeYoyMovers } from '../../server/utils/yoy'

describe('computePctChange', () => {
  it('returns positive percentage for an increase', () => {
    expect(computePctChange(120, 100)).toBe(20)
  })

  it('returns negative percentage for a decrease', () => {
    expect(computePctChange(80, 100)).toBe(-20)
  })

  it('returns null when prior is zero', () => {
    expect(computePctChange(100, 0)).toBeNull()
  })

  it('returns null when prior is negative', () => {
    expect(computePctChange(100, -50)).toBeNull()
  })

  it('rounds to one decimal place', () => {
    expect(computePctChange(133, 100)).toBe(33)
    expect(computePctChange(101, 300)).toBe(-66.3)
  })

  it('returns 0 when current equals prior', () => {
    expect(computePctChange(100, 100)).toBe(0)
  })
})

describe('computeYoyMovers', () => {
  const currentRows = [
    { id: 'a', name: 'Agency A', amount: 200 },
    { id: 'b', name: 'Agency B', amount: 80 },
    { id: 'c', name: 'Agency C', amount: 150 },
  ]
  const priorRows = [
    { id: 'a', amount: 100 },
    { id: 'b', amount: 100 },
    { id: 'c', amount: 100 },
  ]

  it('separates increases and decreases correctly', () => {
    const { increases, decreases } = computeYoyMovers(currentRows, priorRows)
    expect(increases).toHaveLength(2)
    expect(decreases).toHaveLength(1)
    expect(increases[0].id).toBe('a') // 100% increase
    expect(increases[1].id).toBe('c') // 50% increase
    expect(decreases[0].id).toBe('b') // -20% decrease
  })

  it('populates current_amount and prior_amount on each mover', () => {
    const { increases } = computeYoyMovers(currentRows, priorRows)
    const moverA = increases.find((m) => m.id === 'a')
    expect(moverA?.current_amount).toBe(200)
    expect(moverA?.prior_amount).toBe(100)
    expect(moverA?.pct_change).toBe(100)
  })

  it('excludes rows not present in the prior set', () => {
    const extended = [{ id: 'new', name: 'New Agency', amount: 500 }, ...currentRows]
    const { increases } = computeYoyMovers(extended, priorRows)
    expect(increases.every((m) => m.id !== 'new')).toBe(true)
  })

  it('excludes rows with zero prior amount', () => {
    const prior = [
      { id: 'a', amount: 0 },
      { id: 'b', amount: 100 },
      { id: 'c', amount: 100 },
    ]
    const { increases, decreases } = computeYoyMovers(currentRows, prior)
    expect([...increases, ...decreases].every((m) => m.id !== 'a')).toBe(true)
  })

  it('excludes rows with negative prior amount', () => {
    const prior = [
      { id: 'a', amount: -50 },
      { id: 'b', amount: 100 },
      { id: 'c', amount: 100 },
    ]
    const { increases, decreases } = computeYoyMovers(currentRows, prior)
    expect([...increases, ...decreases].every((m) => m.id !== 'a')).toBe(true)
  })

  it('respects the limit parameter', () => {
    const { increases } = computeYoyMovers(currentRows, priorRows, 1)
    expect(increases).toHaveLength(1)
    expect(increases[0].id).toBe('a') // largest increase first
  })

  it('returns empty arrays when there are no common rows', () => {
    const { increases, decreases } = computeYoyMovers(
      [{ id: 'x', name: 'X', amount: 100 }],
      [{ id: 'y', amount: 100 }],
    )
    expect(increases).toHaveLength(0)
    expect(decreases).toHaveLength(0)
  })

  it('returns empty arrays for empty inputs', () => {
    const { increases, decreases } = computeYoyMovers([], [])
    expect(increases).toHaveLength(0)
    expect(decreases).toHaveLength(0)
  })

  it('handles a zero limit by returning empty arrays', () => {
    const { increases, decreases } = computeYoyMovers(currentRows, priorRows, 0)
    expect(increases).toHaveLength(0)
    expect(decreases).toHaveLength(0)
  })

  it('handles a negative limit by returning empty arrays', () => {
    const { increases, decreases } = computeYoyMovers(currentRows, priorRows, -5)
    expect(increases).toHaveLength(0)
    expect(decreases).toHaveLength(0)
  })

  it('handles a non-integer limit by flooring it', () => {
    const { increases } = computeYoyMovers(currentRows, priorRows, 1.9)
    // floor(1.9) = 1 → only the top increase
    expect(increases).toHaveLength(1)
    expect(increases[0].id).toBe('a')
  })
})
