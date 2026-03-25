import { defineConfig, devices } from '@playwright/test'

const nuxtPort = Number(process.env.NUXT_PORT || 3000)
const localBaseURL = `http://localhost:${Number.isFinite(nuxtPort) ? nuxtPort : 3000}`
const baseURL = process.env.PLAYWRIGHT_BASE_URL || localBaseURL
const localNuxtPort = Number.isFinite(nuxtPort) ? nuxtPort : 3000

/**
 * Derived-app baseline for Playwright config.
 * Downstream apps can customize this file, but this version is the template
 * reference for a single-app monorepo with tests under apps/web/tests/e2e.
 */
export default defineConfig({
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  maxFailures: process.env.CI ? undefined : 1,
  reporter: 'list',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    trace: 'on-first-retry',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: `NUXT_PORT=${localNuxtPort} pnpm run dev:kill && NUXT_PORT=${localNuxtPort} pnpm run dev -- --port ${localNuxtPort} --host 127.0.0.1`,
        url: baseURL,
        reuseExistingServer: true,
        timeout: 60_000,
      },
  projects: [
    {
      name: 'web',
      testDir: 'apps/web/tests/e2e',
      use: { ...devices['Desktop Chrome'], baseURL },
    },
  ],
})
