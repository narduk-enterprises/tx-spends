import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const localNuxtPort = Number(process.env.NUXT_PORT || 3000)
const localSiteUrl = `http://localhost:${Number.isFinite(localNuxtPort) ? localNuxtPort : 3000}`
const canonicalSiteUrl = process.env.SITE_URL || 'https://tx-spends.org'
const enableRouteCacheRules =
  process.env.NODE_ENV === 'production' || process.env.NUXT_ENABLE_ROUTE_CACHE === 'true'
const cachedRouteRules = {
  '/': { swr: 60 * 60 },
  '/agencies': { swr: 60 * 60 },
  '/agencies/**': { swr: 60 * 60 },
  '/payees': { swr: 60 * 60 },
  '/payees/**': { swr: 60 * 60 },
  '/categories': { swr: 60 * 60 },
  '/categories/**': { swr: 60 * 60 },
  '/objects': { swr: 60 * 60 },
  '/objects/**': { swr: 60 * 60 },
  '/counties': { swr: 60 * 60 * 24 },
  '/counties/**': { swr: 60 * 60 * 24 },
  '/transactions': { swr: 15 * 60 },
  '/search': { swr: 5 * 60 },
  '/blog': { swr: 15 * 60 },
  '/blog/**': { swr: 60 * 60 },
  '/api/v1/overview': { swr: 60 * 60 },
  '/api/v1/agencies': { swr: 60 * 60 },
  '/api/v1/agencies/**': { swr: 60 * 60 },
  '/api/v1/payees': { swr: 60 * 60 },
  '/api/v1/payees/**': { swr: 60 * 60 },
  '/api/v1/categories': { swr: 60 * 60 },
  '/api/v1/categories/**': { swr: 60 * 60 },
  '/api/v1/objects': { swr: 60 * 60 },
  '/api/v1/objects/**': { swr: 60 * 60 },
  '/api/v1/counties': { swr: 60 * 60 * 24 },
  '/api/v1/counties/**': { swr: 60 * 60 * 24 },
  '/api/v1/transactions': { swr: 15 * 60 },
  '/api/v1/transactions/**': { swr: 15 * 60 },
  '/api/v1/search': { swr: 5 * 60 },
  '/api/blog': { swr: 15 * 60 },
  '/api/blog/preview': { swr: false },
  '/api/blog/**': { swr: 60 * 60 },
  '/api/v1/data-health': { swr: 5 * 60 },
}

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  // Extend the published Narduk Nuxt Layer
  extends: ['@narduk-enterprises/narduk-nuxt-template-layer'],

  // nitro-cloudflare-dev proxies D1 bindings to the local dev server
  modules: ['nitro-cloudflare-dev'],

  css: ['~/assets/css/main.css'],

  future: {
    compatibilityVersion: 4,
  },

  devServer: {
    port: Number.isFinite(localNuxtPort) ? localNuxtPort : 3000,
  },

  runtimeConfig: {
    databaseUrl: process.env.DATABASE_URL || '',
    hyperdriveBinding: process.env.NUXT_HYPERDRIVE_BINDING || 'HYPERDRIVE',
    controlPlaneHyperdriveBinding:
      process.env.NUXT_CONTROL_PLANE_HYPERDRIVE_BINDING || 'HYPERDRIVE_CONTROL_PLANE',
    controlPlaneApiKey: process.env.CONTROL_PLANE_API_KEY || process.env.FLEET_API_KEY || '',
    posthogOwnerDistinctId: process.env.POSTHOG_OWNER_DISTINCT_ID || '',
    xaiApiKey: process.env.XAI_API_KEY || '',
    // Server-only (admin API routes)
    googleServiceAccountKey: process.env.GSC_SERVICE_ACCOUNT_JSON || '',
    posthogApiKey: process.env.POSTHOG_PERSONAL_API_KEY || '',
    gaPropertyId: process.env.GA_PROPERTY_ID || '',
    posthogProjectId: process.env.POSTHOG_PROJECT_ID || '',
    public: {
      appUrl: process.env.SITE_URL || localSiteUrl,
      appName: process.env.APP_NAME || 'Texas State Spending Explorer',
      // Analytics (client-side tracking)
      posthogPublicKey: process.env.POSTHOG_PUBLIC_KEY || '',
      posthogHost: process.env.POSTHOG_HOST || 'https://us.i.posthog.com',
      gaMeasurementId: process.env.GA_MEASUREMENT_ID || '',
      // IndexNow
      indexNowKey: process.env.INDEXNOW_KEY || '',
    },
  },

  site: {
    url: canonicalSiteUrl,
    name: 'Texas State Spending Explorer',
    description:
      'Explore Texas state agency spending, payees, categories, transactions, and county-level distributions.',
    defaultLocale: 'en',
  },

  // Avoid public/robots.txt vs generated route conflict (@nuxt/robots renames to _robots.txt).
  robots: {
    mergeWithRobotsTxtPath: false,
    sitemap: [`${canonicalSiteUrl}/sitemap.xml`],
  },

  schemaOrg: {
    identity: {
      type: 'Organization',
      name: 'Texas State Spending Explorer',
      url: canonicalSiteUrl,
      logo: '/favicon.svg',
    },
  },

  image: {
    cloudflare: {
      baseURL: canonicalSiteUrl,
    },
  },

  routeRules: enableRouteCacheRules ? cachedRouteRules : undefined,
})
