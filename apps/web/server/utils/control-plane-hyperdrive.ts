import type { H3Event } from 'h3'
import { useHyperdriveConnectionString } from '#layer/server/utils/hyperdrive'
import {
  resolveControlPlaneBindingNames,
  resolveControlPlaneHyperdriveConnectionString,
  type HyperdriveRuntimeConfig,
} from './control-plane-hyperdrive-shared'

function cloudflareEnv(event: H3Event): Record<string, unknown> | undefined {
  return event.context.cloudflare?.env as Record<string, unknown> | undefined
}

export function useControlPlaneHyperdriveConnectionString(event: H3Event): string {
  const runtimeConfig = useRuntimeConfig() as HyperdriveRuntimeConfig
  const defaultConnectionString = useHyperdriveConnectionString(event)
  const connectionString = resolveControlPlaneHyperdriveConnectionString({
    cloudflareEnv: cloudflareEnv(event),
    runtimeConfig,
    defaultConnectionString,
    isDev: import.meta.dev,
  })

  if (connectionString) {
    return connectionString
  }

  const { controlPlaneBindingName } = resolveControlPlaneBindingNames(runtimeConfig)
  throw createError({
    statusCode: 500,
    message: `Hyperdrive binding "${controlPlaneBindingName}" is missing or has no connectionString. Add it to wrangler for production. For local dev, either set NUXT_CONTROL_PLANE_HYPERDRIVE_BINDING=${runtimeConfig.hyperdriveBinding || 'HYPERDRIVE'} or provide CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_${controlPlaneBindingName}.`,
  })
}
