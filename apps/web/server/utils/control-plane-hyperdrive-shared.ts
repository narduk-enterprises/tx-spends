type HyperdriveBinding = {
  readonly connectionString: string
}

export type HyperdriveRuntimeConfig = {
  hyperdriveBinding?: string
  controlPlaneHyperdriveBinding?: string
}

function resolveBindingNames(runtimeConfig?: HyperdriveRuntimeConfig): {
  defaultBindingName: string
  controlPlaneBindingName: string
} {
  return {
    defaultBindingName: runtimeConfig?.hyperdriveBinding || 'HYPERDRIVE',
    controlPlaneBindingName:
      runtimeConfig?.controlPlaneHyperdriveBinding || 'HYPERDRIVE_CONTROL_PLANE',
  }
}

export function readHyperdriveConnectionString(
  env: Record<string, unknown> | undefined,
  bindingName: string,
): string | null {
  const binding = env?.[bindingName] as HyperdriveBinding | undefined
  return typeof binding?.connectionString === 'string' && binding.connectionString
    ? binding.connectionString
    : null
}

export function resolveControlPlaneHyperdriveConnectionString(options: {
  cloudflareEnv?: Record<string, unknown>
  runtimeConfig?: HyperdriveRuntimeConfig
  defaultConnectionString?: string
  isDev?: boolean
}): string | null {
  const { defaultBindingName, controlPlaneBindingName } = resolveBindingNames(options.runtimeConfig)
  const controlPlaneConnectionString = readHyperdriveConnectionString(
    options.cloudflareEnv,
    controlPlaneBindingName,
  )

  if (controlPlaneConnectionString) {
    return controlPlaneConnectionString
  }

  if (
    options.defaultConnectionString &&
    (options.isDev || controlPlaneBindingName === defaultBindingName)
  ) {
    return options.defaultConnectionString
  }

  return null
}

export function resolveControlPlaneBindingNames(runtimeConfig?: HyperdriveRuntimeConfig): {
  defaultBindingName: string
  controlPlaneBindingName: string
} {
  return resolveBindingNames(runtimeConfig)
}
