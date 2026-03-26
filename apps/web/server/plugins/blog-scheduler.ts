/**
 * Cloudflare scheduled event handler — daily blog spotlight.
 *
 * When Cloudflare fires the "0 10 * * *" cron trigger, this plugin
 * intercepts the `cloudflare:scheduled` hook and calls the cron publish
 * route via an internal HTTP request.
 *
 * The Bearer token is read from runtime config so the route's cron auth
 * guard still validates correctly even for internal calls.
 */
export default defineNitroPlugin((nitro) => {
  // @ts-expect-error — the `cloudflare:scheduled` hook is typed in Nitro's
  // Cloudflare preset but not exposed in the public type declarations.
  nitro.hooks.hook('cloudflare:scheduled', async (event: { cron: string }) => {
    const config = useRuntimeConfig()
    const cronSecret = (config as Record<string, string>).cronSecret ?? ''
    const siteUrl =
      ((config.public as Record<string, unknown>).appUrl as string) ?? 'http://localhost:3000'

    try {
      await $fetch(`${siteUrl}/api/cron/blog/publish`, {
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
