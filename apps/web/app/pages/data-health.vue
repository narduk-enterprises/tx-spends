<script setup lang="ts">
import { formatCount } from '~/utils/explorer'

const title = 'Data Health'
const description =
  'Live coverage and freshness metrics for Texas State Spending Explorer — payment rows, county facts, vendor match rates, and recent data loads.'

useSeo({
  title,
  description,
  ogImage: {
    title,
    description,
    icon: 'i-lucide-activity',
  },
})

useWebPageSchema({
  name: title,
  description,
})

const { data, status } = await useLazyFetch('/api/v1/data-health', {
  key: 'data-health',
})

const health = computed(() => data.value)

function formatPct(n: number | null | undefined): string {
  if (n == null) return '—'
  return `${n.toFixed(1)}%`
}

function formatTs(ts: Date | string | null | undefined): string {
  if (!ts) return '—'
  const d = ts instanceof Date ? ts : new Date(ts)
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
    timeZone: 'UTC',
  }).format(d)
}

function statusColor(
  s: string | null | undefined,
): 'success' | 'error' | 'warning' | 'neutral' {
  if (!s) return 'neutral'
  if (s === 'success') return 'success'
  if (s === 'failed' || s === 'error') return 'error'
  if (s === 'running' || s === 'partial') return 'warning'
  return 'neutral'
}
</script>

<template>
  <UContainer class="space-y-8 py-8">
    <PageHeader
      eyebrow="Data Health"
      :title="title"
      :subtitle="description"
      badge="Live metrics"
      :breadcrumbs="[{ label: 'Home', to: '/' }, { label: 'Data Sources', to: '/data-sources' }, { label: 'Data Health' }]"
    />

    <div v-if="status === 'pending'" class="flex justify-center py-16">
      <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin text-muted" />
    </div>

    <template v-else-if="health">
      <!-- Payment facts -->
      <section class="space-y-4">
        <div class="space-y-1">
          <h2 class="text-2xl font-semibold tracking-tight text-default">Payment facts</h2>
          <p class="max-w-3xl text-sm leading-7 text-muted">
            Transaction-level state payment records sourced from the Texas Comptroller transparency
            portal. Row counts below reflect what is currently loaded in the database.
          </p>
        </div>

        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <UCard class="card-base">
            <p class="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Rows loaded</p>
            <p class="mt-2 text-2xl font-bold tabular-nums text-default">
              {{ formatCount(health.payments.row_count) }}
            </p>
            <p class="mt-1 text-xs text-muted">
              of {{ formatCount(health.payments.source_row_count) }} expected
            </p>
          </UCard>

          <UCard class="card-base">
            <p class="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
              Backfill active
            </p>
            <p class="mt-2 text-2xl font-bold text-default">
              {{ health.payments.backfill_active ? 'Yes' : 'No' }}
            </p>
            <p class="mt-1 text-xs text-muted">
              {{
                health.payments.backfill_active
                  ? 'Load in progress — counts are incomplete'
                  : 'Load complete'
              }}
            </p>
          </UCard>

          <UCard class="card-base">
            <p class="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
              Public / confidential
            </p>
            <p class="mt-2 text-2xl font-bold tabular-nums text-default">
              {{ formatCount(health.payments.public_count) }}
              <span class="text-base font-normal text-muted">pub</span>
            </p>
            <p class="mt-1 text-xs text-muted">
              {{ formatCount(health.payments.confidential_count) }} confidential rows
            </p>
          </UCard>

          <UCard class="card-base">
            <p class="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
              Latest source load
            </p>
            <p class="mt-2 text-sm font-semibold text-default">
              {{ formatTs(health.payments.latest_source_loaded_at) }}
            </p>
          </UCard>
        </div>

        <UCard class="card-base">
          <template #header>
            <p class="text-sm font-semibold text-default">Available fiscal years (payment layer)</p>
          </template>
          <div class="flex flex-wrap gap-2">
            <UBadge
              v-for="fy in health.payments.fiscal_years"
              :key="fy"
              color="primary"
              variant="soft"
              class="rounded-full px-3 py-1 tabular-nums"
            >
              FY {{ fy }}
            </UBadge>
            <span v-if="!health.payments.fiscal_years.length" class="text-sm text-muted">
              No fiscal years loaded yet
            </span>
          </div>
          <p class="mt-3 text-xs leading-6 text-muted">{{ health.payments.note }}</p>
        </UCard>
      </section>

      <!-- County facts -->
      <section class="space-y-4">
        <div class="space-y-1">
          <h2 class="text-2xl font-semibold tracking-tight text-default">County expenditure facts</h2>
          <p class="max-w-3xl text-sm leading-7 text-muted">
            Annual aggregate expenditures by county. This is a separate fact table — county pages
            are not a geocoded rollup of individual payment rows.
          </p>
        </div>

        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <UCard class="card-base">
            <p class="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
              Aggregate rows loaded
            </p>
            <p class="mt-2 text-2xl font-bold tabular-nums text-default">
              {{ formatCount(health.county_facts.row_count) }}
            </p>
          </UCard>

          <UCard class="card-base">
            <p class="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
              Latest source load
            </p>
            <p class="mt-2 text-sm font-semibold text-default">
              {{ formatTs(health.county_facts.latest_source_loaded_at) }}
            </p>
          </UCard>

          <UCard class="card-base overflow-hidden">
            <template #header>
              <p class="text-sm font-semibold text-default">
                Available fiscal years (county layer)
              </p>
            </template>
            <div class="flex flex-wrap gap-2">
              <UBadge
                v-for="fy in health.county_facts.fiscal_years"
                :key="fy"
                color="neutral"
                variant="soft"
                class="rounded-full px-3 py-1 tabular-nums"
              >
                FY {{ fy }}
              </UBadge>
              <span v-if="!health.county_facts.fiscal_years.length" class="text-sm text-muted">
                No fiscal years loaded yet
              </span>
            </div>
          </UCard>
        </div>

        <div class="rounded-[1.25rem] border border-default bg-elevated/40 px-4 py-3 text-sm leading-7 text-muted">
          {{ health.county_facts.note }}
        </div>
      </section>

      <!-- Vendor matching -->
      <section class="space-y-4">
        <div class="space-y-1">
          <h2 class="text-2xl font-semibold tracking-tight text-default">Vendor match coverage</h2>
          <p class="max-w-3xl text-sm leading-7 text-muted">
            Share of public payees that have a linked vendor enrichment record. Matches are
            approximate by design.
          </p>
        </div>

        <div class="grid gap-4 sm:grid-cols-3">
          <UCard class="card-base">
            <p class="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
              Public payees
            </p>
            <p class="mt-2 text-2xl font-bold tabular-nums text-default">
              {{ formatCount(health.vendor_matching.public_payee_count) }}
            </p>
          </UCard>

          <UCard class="card-base">
            <p class="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
              Matched payees
            </p>
            <p class="mt-2 text-2xl font-bold tabular-nums text-default">
              {{ formatCount(health.vendor_matching.matched_payee_count) }}
            </p>
          </UCard>

          <UCard class="card-base">
            <p class="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
              Match coverage
            </p>
            <p class="mt-2 text-2xl font-bold tabular-nums text-default">
              {{ formatPct(health.vendor_matching.coverage_pct) }}
            </p>
            <p class="mt-1 text-xs text-muted">approximate — name-based matching only</p>
          </UCard>
        </div>

        <div class="rounded-[1.25rem] border border-default bg-elevated/40 px-4 py-3 text-sm leading-7 text-muted">
          {{ health.vendor_matching.note }}
        </div>
      </section>

      <!-- Recent ingestion runs -->
      <section v-if="health.recent_ingestion_runs.length" class="space-y-4">
        <div class="space-y-1">
          <h2 class="text-2xl font-semibold tracking-tight text-default">Recent data loads</h2>
          <p class="max-w-3xl text-sm leading-7 text-muted">
            The five most recent ingestion runs recorded in the database.
          </p>
        </div>

        <UCard class="card-base overflow-hidden">
          <div class="divide-y divide-default">
            <div
              v-for="run in health.recent_ingestion_runs"
              :key="`${run.job_name}-${run.started_at}`"
              class="flex flex-wrap items-start justify-between gap-3 py-4 first:pt-0 last:pb-0"
            >
              <div class="min-w-0 space-y-0.5">
                <p class="truncate text-sm font-semibold text-default">{{ run.source_name }}</p>
                <p class="text-xs text-muted">{{ run.job_name }}</p>
              </div>
              <div class="flex shrink-0 flex-wrap items-center gap-3 text-right">
                <UBadge :color="statusColor(run.status)" variant="soft" class="rounded-full px-3 py-1">
                  {{ run.status }}
                </UBadge>
                <div>
                  <p class="text-xs tabular-nums text-muted">
                    {{ run.rows_inserted != null ? `${formatCount(run.rows_inserted)} rows` : '—' }}
                  </p>
                  <p class="text-xs text-muted">{{ formatTs(run.started_at) }}</p>
                </div>
              </div>
            </div>
          </div>
        </UCard>
      </section>

      <div class="rounded-[1.25rem] border border-default bg-elevated/40 px-4 py-3 text-xs leading-6 text-muted">
        Metrics generated at {{ formatTs(health.generated_at) }}. This page has a short cache and
        reflects the live database state within a few minutes.
      </div>
    </template>

    <div v-else class="py-16 text-center text-sm text-muted">
      Could not load data health metrics.
    </div>
  </UContainer>
</template>
