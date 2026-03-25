import { warmUpApp as layerWarmUpApp } from '../../../../layers/narduk-nuxt-layer/testing/e2e/fixtures.ts'

export {
  createUniqueEmail,
  expect,
  test,
  waitForHydration,
  registerAndLogin,
  loginAsAdmin,
  loginViaApi,
  logoutViaApi,
  createNotificationViaApi,
  fetchNotificationsViaApi,
  fetchUnreadCountViaApi,
  markAllNotificationsReadViaApi,
  updateProfileViaApi,
} from '../../../../layers/narduk-nuxt-layer/testing/e2e/fixtures.ts'

export async function warmUpApp(browser: Parameters<typeof layerWarmUpApp>[0], baseUrl: string) {
  // Avoid warming against `/` while large payment backfills are in-flight; `/counties`
  // exercises the app shell without blocking on transaction-level aggregates.
  await layerWarmUpApp(browser, baseUrl, '/counties')
}

export async function waitForBaseUrlReady(baseUrl: string, timeoutMs = 60_000) {
  const probeUrl = new URL('/counties', baseUrl).toString()
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    try {
      const headResponse = await fetch(probeUrl, { method: 'HEAD' })
      if (headResponse.ok) {
        return
      }

      const getResponse = await fetch(probeUrl)
      if (getResponse.ok) {
        return
      }
    } catch {
      // Server is still starting.
    }

    await new Promise((resolve) => setTimeout(resolve, 1_000))
  }

  throw new Error(`Server at ${probeUrl} did not become ready within ${timeoutMs}ms`)
}
