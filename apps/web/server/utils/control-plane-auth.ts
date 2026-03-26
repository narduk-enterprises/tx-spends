import type { H3Event } from 'h3'

function readBearerToken(event: H3Event): string {
  const header = getHeader(event, 'authorization')
  if (!header?.startsWith('Bearer ')) return ''
  return header.slice(7).trim()
}

export function requireControlPlaneApiKey(event: H3Event): void {
  const config = useRuntimeConfig(event) as Record<string, unknown>
  const expected = String(config.controlPlaneApiKey || '').trim()
  const provided = readBearerToken(event)

  if (!expected) {
    throw createError({
      statusCode: 503,
      statusMessage: 'CONTROL_PLANE_API_KEY is not configured.',
    })
  }

  if (!provided || provided !== expected) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }
}
