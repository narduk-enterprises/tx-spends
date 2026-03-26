import { describe, expect, it } from 'vitest'
import { globalQuerySchema } from '../../server/utils/query'

describe('apps/web unit tests', () => {
  it('runs vitest for server-side checks', () => {
    expect(true).toBe(true)
  })
})

describe('globalQuerySchema vendor filters', () => {
  it('parses matched_vendor_only as boolean', () => {
    const result = globalQuerySchema.parse({ matched_vendor_only: 'true' })
    expect(result.matched_vendor_only).toBe(true)

    const falsy = globalQuerySchema.parse({ matched_vendor_only: 'false' })
    expect(falsy.matched_vendor_only).toBe(false)
  })

  it('parses hub_only as boolean', () => {
    const result = globalQuerySchema.parse({ hub_only: 'true' })
    expect(result.hub_only).toBe(true)

    const falsy = globalQuerySchema.parse({ hub_only: '0' })
    expect(falsy.hub_only).toBe(false)
  })

  it('parses small_business_only as boolean', () => {
    const result = globalQuerySchema.parse({ small_business_only: '1' })
    expect(result.small_business_only).toBe(true)
  })

  it('parses sdv_only as boolean', () => {
    const result = globalQuerySchema.parse({ sdv_only: 'true' })
    expect(result.sdv_only).toBe(true)
  })

  it('parses in_state_only as boolean', () => {
    const result = globalQuerySchema.parse({ in_state_only: '1' })
    expect(result.in_state_only).toBe(true)

    const absent = globalQuerySchema.parse({})
    expect(absent.in_state_only).toBe(false)
  })

  it('vendor filter defaults are all false', () => {
    const result = globalQuerySchema.parse({})
    expect(result.hub_only).toBe(false)
    expect(result.small_business_only).toBe(false)
    expect(result.sdv_only).toBe(false)
    expect(result.in_state_only).toBe(false)
    expect(result.matched_vendor_only).toBe(false)
  })

  it('rejects invalid vendor filter values', () => {
    expect(() => globalQuerySchema.parse({ hub_only: 'yes' })).toThrow()
    expect(() => globalQuerySchema.parse({ in_state_only: 'enabled' })).toThrow()
  })
})
