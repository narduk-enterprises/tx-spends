/**
 * Cloudflare scheduled event handler — weekday blog spotlight.
 *
 * When Cloudflare fires the "0 10 * * 1-5" cron trigger, this plugin
 * intercepts the `cloudflare:scheduled` hook and calls the cron publish
 * route via an internal HTTP request.
 *
 * The Bearer token is read from runtime config so the route's cron auth
 * guard still validates correctly even for internal calls.
 */

const BLOG_CRON_PATTERN = '0 10 * * 1-5'

export default defineNitroPlugin((nitro) => {
  // Type augmentation to avoid @ts-expect-error suppression — the
  // `cloudflare:scheduled` hook exists in Nitro's Cloudflare preset but is
  // not yet part of the public type declarations.
  const hooks = nitro.hooks as typeof nitro.hooks & {
    hook(name: 'cloudflare:scheduled', fn: (event: { cron: string }) => void | Promise<void>): void
  }

  hooks.hook('cloudflare:scheduled', async (event) => {
    // Guard: only handle the blog cron pattern to avoid unintentional triggers
    // if additional cron entries are added in the future.
    if (event.cron !== BLOG_CRON_PATTERN) return

    const config = useRuntimeConfig()
    // cronSecret is an app/layer runtime config key; cast required
    const appConfig = config as Record<string, unknown>
    const cronSecret = (appConfig.cronSecret as string | undefined) ?? ''

    // Fail closed if cronSecret is not configured — sending an empty bearer
    // token would trigger a 401 from the route and waste the request.
    if (!cronSecret) {
      console.error(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'error',
          message: 'Blog scheduler: cronSecret is not configured — skipping publish',
          data: { cron: event.cron },
        }),
      )
      return
    }

    try {
      // Use a relative path to ensure Nitro routes the request internally.
      // This avoids Cloudflare 'loop detected' errors when fetching our own custom domain.
      await $fetch('/api/cron/blog/publish', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cronSecret}`,
          'Content-Type': 'application/json',
          'X-Cron-Event': event.cron,
        },
      })
    } catch (err) {
      console.error(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'error',
          message: 'Scheduled blog publish failed',
          data: { cron: event.cron, error: err instanceof Error ? err.message : String(err) },
        }),
      )
    }
  })
})
