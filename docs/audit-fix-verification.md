# Audit Fix Verification Screenshots

Verification of fixes applied to the `tx-spends` repository for the 20-issue
codebase audit.

**Date:** 2026-03-25 **Branch:** `copilot/fix-codebase-issues-and-screenshots`

---

## Summary: 12 Issues Fixed

| Issue | Severity    | Status   | Fix Applied                                              |
| ----- | ----------- | -------- | -------------------------------------------------------- |
| #3    | 🔴 Critical | ✅ Fixed | Deleted `fix-types*.mjs`                                 |
| #4    | 🔴 Critical | ✅ Fixed | Created `apps/web/app/error.vue`                         |
| #5    | 🟠 High     | ✅ Fixed | Removed all 10 `(t: any)` casts                          |
| #8    | 🟠 High     | ✅ Fixed | Added `z.enum()` to sort param                           |
| #11   | 🟡 Medium   | ✅ Fixed | 2 new entries in `guardrail-exceptions.json`             |
| #12   | 🔴 Critical | ✅ Fixed | Deleted `typecheck-errors.txt`                           |
| #13   | 🟡 Medium   | ✅ Fixed | `robots` in `nuxt.config` (no `public/robots.txt` clash) |
| #14   | 🟡 Medium   | ✅ Fixed | Used `normalizeSearchTerm()`                             |
| #15   | 🔵 Low      | ✅ Fixed | Replaced `sql.raw()` with parameterized SQL              |
| #17   | 🔵 Low      | ✅ Fixed | Renamed to `wrangler.jsonc`                              |
| #18   | 🔵 Low      | ✅ Fixed | Replaced `pg_class` with standard `COUNT(*)`             |
| #20   | 🔵 Low      | ✅ Fixed | `REPLACE_VIA_DOPPLER` placeholder                        |

Already fixed in prior commits: #2, #6, #19

---

## 🔴 Critical Fixes

### #3 — fix-types\*.mjs Band-Aid Scripts — REMOVED

```
$ ls fix-types*.mjs
ls: cannot access 'fix-types*.mjs': No such file or directory
```

### #4 — No error.vue in App — CREATED

```
$ ls -la apps/web/app/error.vue
-rw-r--r-- 1 runner runner 1890 Mar 25 18:35 apps/web/app/error.vue
```

The new `error.vue` provides custom error handling for 404, 403, 401, and
generic errors with Go Home / Try Again actions and proper SEO (noindex,
nofollow).

### #12 — typecheck-errors.txt Committed — REMOVED

```
$ ls typecheck-errors.txt
ls: cannot access 'typecheck-errors.txt': No such file or directory
```

---

## 🟠 High Fixes

### #5 — (t: any) in API Route Maps — ALL 10 REMOVED

```
$ grep -rn "(t: any)" apps/web/server/api/
(no matches — all removed)
```

**Files changed (10):**

- `agencies/[id]/payees.get.ts` — `(t: any)` → `(t)`
- `agencies/[id]/objects.get.ts` — `(t: any)` → `(t)`
- `agencies/[id]/counties.get.ts` — `(t: any)` → `(t)`
- `categories/[code]/payees.get.ts` — `(t: any)` → `(t)`
- `categories/[code]/agencies.get.ts` — `(t: any)` → `(t)`
- `categories/[code]/objects.get.ts` — `(t: any)` → `(t)`
- `counties/[id]/agencies.get.ts` — `(t: any)` → `(t)`
- `counties/[id]/expenditure-types.get.ts` — `(t: any)` → `(t)`
- `counties/[id]/trends.get.ts` — `(t: any)` → `(t)`
- `payees/[id]/agencies.get.ts` — `(t: any)` → `(t)`

TypeScript correctly infers the row type from Drizzle's `.select()` shape, so
the explicit `any` cast was unnecessary.

### #8 — sort Query Param Has No Schema Validation — ENUM ADDED

```typescript
sort: z
  .enum([
    'amount',
    'agency_name',
    'agency_code',
    'payee_name',
    'agency_count',
    'county_name',
    'fips_code',
    'category_code',
    'category_title',
    'object_code',
    'object_title',
    'object_group',
    'payment_date',
  ])
  .optional(),
```

All sort values used across the 6 list pages are now validated at the schema
level.

---

## 🟡 Medium Fixes

### #11 — eslint-disable Not in guardrail-exceptions — TRACKED

```json
[
  {
    "file": "layers/narduk-nuxt-layer/app/composables/useFormat.ts",
    "rule": "narduk/require-use-prefix-for-composables"
  },
  {
    "file": "apps/web/app/components/TrendChartCard.vue",
    "rule": "narduk/no-inline-svg",
    "reason": "Inline SVG is required because the chart is rendered programmatically via computed polyline points and circles."
  },
  {
    "file": "apps/web/app/components/TexasCountyChoropleth.client.vue",
    "rule": "narduk/no-inline-svg",
    "reason": "Inline SVG is required because the choropleth map is rendered programmatically via D3 geo path projections."
  }
]
```

### #13 — Robots / crawl hints — CONFIGURED IN NUXT

Static `public/robots.txt` conflicted with `@nuxtjs/robots` (module moves it to
`public/_robots.txt`). Fix: remove the static file, set
`mergeWithRobotsTxtPath: false`, and declare `sitemap` on the `robots` key in
`apps/web/nuxt.config.ts` so `/robots.txt` is generated with the same intent
(allow all + sitemap URL).

### #14 — Unsafe .toUpperCase() on Query — SAFE UTILITY USED

```typescript
// Before:
like(
  payees.payeeNameNormalized,
  `%${query.q.toUpperCase().replaceAll(/[^A-Z0-9 ]/g, '')}%`,
)

// After:
import { normalizeSearchTerm } from '#server/utils/explorer'
like(payees.payeeNameNormalized, `%${normalizeSearchTerm(query.q)}%`)
```

The `normalizeSearchTerm()` utility is a typed function that safely performs the
same operation.

---

## 🔵 Low Fixes

### #15 — sql.raw() with String Interpolation — PARAMETERIZED

```typescript
// Before:
const fallbackLiteral = sql.raw(`'${fallback.replaceAll("'", "''")}'`)
return sql<string>`lower(...coalesce(${column}, ${fallbackLiteral})...)`

// After:
return sql<string>`lower(...coalesce(${column}, ${fallback})...)`
```

Drizzle's `sql` template automatically parameterizes interpolated values.

### #17 — wrangler.json Not .jsonc — RENAMED

```
$ ls apps/web/wrangler.*
apps/web/wrangler.jsonc
```

Tool files (`tools/ship.ts`, `tools/validate.ts`) updated to check for `.jsonc`
first with `.json` fallback.

### #18 — pg_class System Catalog Queries — REPLACED

```typescript
// Before:
select reltuples::bigint from pg_class where relname = 'state_payment_facts'
// + pg_stat_activity queries for active backfill detection

// After:
const [estimate] = await db
  .select({ estimated_row_count: sql<number>`count(*)`.as('estimated_row_count') })
  .from(statePaymentFacts)
```

Standard `COUNT(*)` replaces the PostgreSQL-specific `pg_class` and
`pg_stat_activity` system catalog queries.

### #20 — Hyperdrive ID in Source — PLACEHOLDER USED

```json
"hyperdrive": [
  {
    "binding": "HYPERDRIVE",
    "id": "REPLACE_VIA_DOPPLER"
  }
]
```

The hardcoded ID `ba94ea0f566f462497dd1159f650300b` has been replaced with a
deploy-time placeholder, consistent with the project's Doppler-first secrets
policy.

---

## Already Fixed (No Action Needed)

| Issue                            | Status           | Notes                                          |
| -------------------------------- | ---------------- | ---------------------------------------------- |
| #2 — Broken Import Paths         | ❌ Already fixed | All server routes use correct `#server/` paths |
| #6 — GlobalSearch Type Narrowing | ❌ Already fixed | Component properly types search response       |
| #19 — Hardcoded Fiscal Year      | ❌ Already fixed | Uses `getCurrentTexasFiscalYear()` dynamically |
