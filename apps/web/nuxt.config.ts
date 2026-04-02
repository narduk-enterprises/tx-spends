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

const appBackendPreset =
  process.env.APP_BACKEND_PRESET === 'managed-supabase' ? 'managed-supabase' : 'default'
const configuredAuthBackend = process.env.AUTH_BACKEND
const supabaseUrl = process.env.AUTH_AUTHORITY_URL || process.env.SUPABASE_URL || ''
const supabasePublishableKey =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_AUTH_ANON_KEY ||
  ''
const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_AUTH_SERVICE_ROLE_KEY || ''
const authBackend =
  configuredAuthBackend === 'supabase' || configuredAuthBackend === 'local'
    ? configuredAuthBackend
    : supabaseUrl && supabasePublishableKey
      ? 'supabase'
      : 'local'
const authAuthorityUrl = supabaseUrl
const appOrmTablesEntry =
  process.env.NUXT_DATABASE_BACKEND === 'postgres'
    ? './server/database/pg-app-schema.ts'
    : './server/database/app-schema.ts'

function parseAuthProviders(value: string | undefined) {
  return (value || 'apple,email')
    .split(',')
    .map((provider) => provider.trim().toLowerCase())
    .filter((provider, index, providers) => provider && providers.indexOf(provider) === index)
}

const authProviders =
  authBackend === 'supabase' ? parseAuthProviders(process.env.AUTH_PROVIDERS) : ['email']
// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  // Extend the published Narduk Nuxt Layer
  extends: [
    '@narduk-enterprises/narduk-nuxt-template-layer-core',
    '@narduk-enterprises/narduk-nuxt-template-layer-auth',
    '@narduk-enterprises/narduk-nuxt-template-layer-analytics',
  ],

  alias: {
    '#server/app-orm-tables': fileURLToPath(new URL(appOrmTablesEntry, import.meta.url)),
  },

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
    appBackendPreset,
    authBackend,
    authAuthorityUrl,
    authAnonKey: supabasePublishableKey,
    authServiceRoleKey: supabaseServiceRoleKey,
    authStorageKey: process.env.AUTH_STORAGE_KEY || 'web-auth',
    turnstileSecretKey: process.env.TURNSTILE_SECRET_KEY || '',
    supabaseUrl,
    supabasePublishableKey,
    supabaseServiceRoleKey,
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
      appBackendPreset,
      authBackend,
      authAuthorityUrl,
      authLoginPath: '/login',
      authRegisterPath: '/register',
      authCallbackPath: '/auth/callback',
      authConfirmPath: '/auth/confirm',
      authResetPath: '/reset-password',
      authLogoutPath: '/logout',
      authRedirectPath: '/dashboard/',
      authProviders,
      authPublicSignup: process.env.AUTH_PUBLIC_SIGNUP !== 'false',
      authRequireMfa: process.env.AUTH_REQUIRE_MFA === 'true',
      authTurnstileSiteKey: process.env.TURNSTILE_SITE_KEY || '',
      supabaseUrl,
      supabasePublishableKey,
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
