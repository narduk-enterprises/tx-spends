<script setup lang="ts">
import type { CountyMapMetric } from '~/utils/county-map'
import { formatCountyLabel, formatUsdCompact } from '~/utils/explorer'

const props = withDefaults(
  defineProps<{
    countyMetrics: CountyMapMetric[]
    fiscalYear?: number | string | null
    loading?: boolean
  }>(),
  {
    fiscalYear: null,
    loading: false,
  },
)

const emit = defineEmits<{
  selectCounty: [countyId: string]
}>()

const countyCount = computed(() => props.countyMetrics.length)
const leaderboard = computed(() => props.countyMetrics.slice(0, 12))

const fiscalYearLabel = computed(() => {
  if (!props.fiscalYear) {
    return ''
  }

  if (typeof props.fiscalYear === 'number') {
    return `FY ${props.fiscalYear}`
  }

  if (props.fiscalYear.toLowerCase() === 'all years') {
    return 'All years'
  }

  return props.fiscalYear.startsWith('FY ') ? props.fiscalYear : `FY ${props.fiscalYear}`
})
</script>

<template>
  <UCard class="card-base overflow-hidden">
    <template #header>
      <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div class="space-y-1">
          <p class="text-lg font-semibold text-default">County spending landscape</p>
          <p class="text-sm text-muted">
            A geographic view of annual county-level state expenditures from the Comptroller county
            reports.
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <UBadge
            v-if="fiscalYearLabel"
            color="neutral"
            variant="soft"
            class="rounded-full px-3 py-1"
          >
            {{ fiscalYearLabel }}
          </UBadge>
          <UBadge color="primary" variant="subtle" class="rounded-full px-3 py-1">
            {{ countyCount }} counties matched
          </UBadge>
        </div>
      </div>
    </template>

    <div v-if="props.loading" class="flex min-h-[23rem] items-center justify-center py-12">
      <UIcon name="i-lucide-loader-circle" class="size-10 animate-spin text-primary" />
    </div>

    <div
      v-else-if="leaderboard.length"
      class="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.9fr)]"
    >
      <div
        class="relative overflow-hidden rounded-[1.5rem] border border-default bg-[var(--gradient-hero)] p-5"
      >
        <div class="pointer-events-none absolute inset-0 tx-grid opacity-30" />

        <div class="relative space-y-4">
          <div class="space-y-2">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Statewide choropleth
            </p>
            <p class="max-w-2xl text-sm text-muted">
              Hover or focus a county to inspect its annual total, then open the county detail page
              for agencies, expenditure types, and trends.
            </p>
          </div>

          <ClientOnly>
            <LazyTexasCountyChoropleth
              :county-metrics="props.countyMetrics"
              @select-county="emit('selectCounty', $event)"
            />

            <template #fallback>
              <div
                class="flex min-h-[23rem] items-center justify-center rounded-[1.5rem] border border-default bg-default/88 p-6 shadow-card"
              >
                <div class="space-y-2 text-center">
                  <div
                    class="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary"
                  >
                    <UIcon name="i-lucide-map" class="size-5" />
                  </div>
                  <p class="text-sm font-semibold text-default">Loading county map</p>
                  <p class="text-sm text-muted">
                    The geographic county layer hydrates after the first paint.
                  </p>
                </div>
              </div>
            </template>
          </ClientOnly>
        </div>
      </div>

      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <p class="text-sm font-semibold uppercase tracking-[0.14em] text-muted">Top counties</p>
          <p class="text-xs text-muted">Ranked statewide</p>
        </div>

        <div class="space-y-2">
          <UButton
            v-for="(county, index) in leaderboard"
            :key="county.county_id"
            color="neutral"
            variant="ghost"
            class="w-full justify-between rounded-2xl border border-default px-4 py-3 text-left hover:border-primary/20 hover:bg-primary/5"
            @click="emit('selectCounty', county.county_id)"
          >
            <div class="flex min-w-0 items-center gap-3">
              <span class="text-xs font-semibold text-muted">{{
                String(index + 1).padStart(2, '0')
              }}</span>
              <div class="min-w-0">
                <p class="truncate text-sm font-semibold text-default">
                  {{ formatCountyLabel(county.county_name, 'Unknown') }}
                </p>
                <p class="text-xs text-muted">Open county view</p>
              </div>
            </div>
            <span class="shrink-0 text-sm font-semibold text-primary">
              {{ formatUsdCompact(county.amount) }}
            </span>
          </UButton>
        </div>
      </div>
    </div>

    <EmptyState
      v-else
      title="No county spending data"
      description="Try another fiscal year or broaden the active filters."
      icon="i-lucide-map"
    />
  </UCard>
</template>
