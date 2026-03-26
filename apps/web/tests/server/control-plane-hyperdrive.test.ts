import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveControlPlaneHyperdriveConnectionString } from '../../server/utils/control-plane-hyperdrive-shared'

describe('resolveControlPlaneHyperdriveConnectionString', () => {
  const defaultConnectionString = 'postgres://default-binding'

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('prefers the dedicated control-plane binding when present', () => {
    const result = resolveControlPlaneHyperdriveConnectionString({
      cloudflareEnv: {
        HYPERDRIVE: { connectionString: defaultConnectionString },
        HYPERDRIVE_CONTROL_PLANE: { connectionString: 'postgres://control-plane-binding' },
      },
      runtimeConfig: {
        hyperdriveBinding: 'HYPERDRIVE',
        controlPlaneHyperdriveBinding: 'HYPERDRIVE_CONTROL_PLANE',
      },
      defaultConnectionString,
      isDev: false,
    })

    expect(result).toBe('postgres://control-plane-binding')
  })

  it('falls back to the default binding during local development', () => {
    const result = resolveControlPlaneHyperdriveConnectionString({
      cloudflareEnv: {
        HYPERDRIVE: { connectionString: defaultConnectionString },
      },
      runtimeConfig: {
        hyperdriveBinding: 'HYPERDRIVE',
        controlPlaneHyperdriveBinding: 'HYPERDRIVE_CONTROL_PLANE',
      },
      defaultConnectionString,
      isDev: true,
    })

    expect(result).toBe(defaultConnectionString)
  })

  it('returns null in production when the dedicated binding is missing', () => {
    const result = resolveControlPlaneHyperdriveConnectionString({
      cloudflareEnv: {
        HYPERDRIVE: { connectionString: defaultConnectionString },
      },
      runtimeConfig: {
        hyperdriveBinding: 'HYPERDRIVE',
        controlPlaneHyperdriveBinding: 'HYPERDRIVE_CONTROL_PLANE',
      },
      defaultConnectionString,
      isDev: false,
    })

    expect(result).toBeNull()
  })
})
