<script setup lang="ts">
import { geoPath, geoMercator } from 'd3-geo'
import texasCountyCollection from '~/utils/texas-counties.geo.json'
import { formatCountyLabel, formatUsdCompact, normalizeCountyKey } from '~/utils/explorer'

type CountyMetric = {
  county_id: string
  county_name: string | null
  amount: number
}

type TexasCountyFeature = {
  type: 'Feature'
  id: string
  properties: {
    COUNTY: string
    GEO_ID: string
    LSAD: string
    NAME: string
    STATE: string
  }
  geometry: unknown
}

const props = defineProps<{
  countyMetrics: CountyMetric[]
  fy?: number | string
}>()

const emit = defineEmits<{
  selectCounty: [countyId: string]
}>()

const MAP_WIDTH = 700
const MAP_HEIGHT = 460
const legendStops = [
  'rgb(226 232 240)',
  'rgb(253 230 138)',
  'rgb(251 191 36)',
  'rgb(245 158 11)',
  'rgb(217 119 6)',
]

const texasCounties = texasCountyCollection as {
  type: 'FeatureCollection'
  features: TexasCountyFeature[]
}

const texasProjection = geoMercator().fitExtent(
  [
    [16, 16],
    [MAP_WIDTH - 16, MAP_HEIGHT - 16],
  ],
  texasCounties as never,
)
const texasPath = geoPath(texasProjection)

const leaderboard = computed(() => props.countyMetrics.slice(0, 12))
const peakAmount = computed(() =>
  Math.max(...props.countyMetrics.map((county) => Number(county.amount || 0)), 0),
)
const metricByCountyKey = computed(() => {
  return new Map(
    props.countyMetrics.map((county) => [normalizeCountyKey(county.county_name), county] as const),
  )
})
const mapFeatures = computed(() =>
  texasCounties.features
    .map((feature) => {
      const countyKey = normalizeCountyKey(feature.properties.NAME)

      return {
        countyKey,
        countyName: feature.properties.NAME,
        metric: metricByCountyKey.value.get(countyKey) || null,
        path: texasPath(feature as never) || '',
      }
    })
    .filter((feature) => feature.path.length > 0),
)
const mappedCountyCount = computed(() =>
  mapFeatures.value.reduce((count, feature) => count + (feature.metric ? 1 : 0), 0),
)

const fyLabel = computed(() => {
  if (!props.fy) {
    return ''
  }

  if (typeof props.fy === 'number') {
    return `FY ${props.fy}`
  }

  if (props.fy.toLowerCase() === 'all years') {
    return 'All years'
  }

  return props.fy.startsWith('FY ') ? props.fy : `FY ${props.fy}`
})

const activeCountyKey = ref<string | null>(null)

const featuredCounty = computed(() => {
  if (activeCountyKey.value) {
    return mapFeatures.value.find((feature) => feature.countyKey === activeCountyKey.value) || null
  }

  return mapFeatures.value.find((feature) => feature.metric) || mapFeatures.value[0] || null
})

function countyFill(amount: number | null | undefined) {
  const numericAmount = Number(amount || 0)
  if (!numericAmount || !peakAmount.value) {
    return 'rgb(226 232 240)'
  }

  const ratio = numericAmount / peakAmount.value

  if (ratio >= 0.82) {
    return 'rgb(180 83 9)'
  }

  if (ratio >= 0.58) {
    return 'rgb(217 119 6)'
  }

  if (ratio >= 0.32) {
    return 'rgb(245 158 11)'
  }

  if (ratio > 0) {
    return 'rgb(253 230 138)'
  }

  return 'rgb(226 232 240)'
}

function countyOpacity(amount: number | null | undefined) {
  const numericAmount = Number(amount || 0)
  if (!numericAmount || !peakAmount.value) {
    return 0.8
  }

  return 0.72 + (numericAmount / peakAmount.value) * 0.28
}

function focusCounty(countyKey: string) {
  activeCountyKey.value = countyKey
}

function clearCountyFocus() {
  activeCountyKey.value = null
}

function openCounty(metric: CountyMetric | null) {
  if (!metric) {
    return
  }

  emit('selectCounty', metric.county_id)
}
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
          <UBadge v-if="fyLabel" color="neutral" variant="soft" class="rounded-full px-3 py-1">
            {{ fyLabel }}
          </UBadge>
          <UBadge color="primary" variant="subtle" class="rounded-full px-3 py-1">
            {{ mappedCountyCount }} counties matched
          </UBadge>
        </div>
      </div>
    </template>

    <div
      v-if="leaderboard.length"
      class="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.9fr)]"
    >
      <div
        class="relative overflow-hidden rounded-[1.5rem] border border-default bg-[var(--gradient-hero)] p-5"
      >
        <div class="pointer-events-none absolute inset-0 tx-grid opacity-30" />

        <div class="relative space-y-4">
          <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div class="space-y-2">
              <p class="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                Statewide choropleth
              </p>
              <p class="max-w-2xl text-sm text-muted">
                Hover or focus a county to inspect its annual total, then open the county detail
                page for agencies, expenditure types, and trends.
              </p>
            </div>

            <div class="rounded-[1.25rem] border border-primary/15 bg-default/85 px-4 py-3">
              <p class="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                County in focus
              </p>
              <p class="mt-2 text-lg font-semibold text-default">
                {{ formatCountyLabel(featuredCounty?.countyName, 'Unknown') }}
              </p>
              <p class="mt-1 text-sm font-semibold text-primary">
                {{
                  featuredCounty?.metric
                    ? formatUsdCompact(featuredCounty.metric.amount)
                    : 'No public county total'
                }}
              </p>
              <p class="mt-2 text-xs text-muted">
                {{
                  featuredCounty?.metric
                    ? 'Click the county shape to open the detailed view.'
                    : 'Slate counties do not have a matched county-layer total under the active filters.'
                }}
              </p>
            </div>
          </div>

          <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_12rem]">
            <div class="rounded-[1.5rem] border border-default bg-default/88 p-3 shadow-card">
              <!-- eslint-disable-next-line narduk/no-inline-svg -- Inline SVG is the choropleth renderer -->
              <svg
                :viewBox="`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`"
                class="h-[23rem] w-full"
                aria-label="Texas county spending choropleth"
                role="img"
              >
                <g v-for="feature in mapFeatures" :key="feature.countyKey">
                  <path
                    :d="feature.path"
                    :fill="countyFill(feature.metric?.amount)"
                    :fill-opacity="countyOpacity(feature.metric?.amount)"
                    :stroke="
                      activeCountyKey === feature.countyKey
                        ? 'rgb(15 23 42 / 0.95)'
                        : 'rgb(148 163 184 / 0.7)'
                    "
                    :stroke-width="activeCountyKey === feature.countyKey ? 1.6 : 0.85"
                    :class="[
                      'transition-base focus:outline-none',
                      feature.metric ? 'cursor-pointer' : 'cursor-default',
                    ]"
                    tabindex="0"
                    role="button"
                    @mouseenter="focusCounty(feature.countyKey)"
                    @mouseleave="clearCountyFocus"
                    @focus="focusCounty(feature.countyKey)"
                    @blur="clearCountyFocus"
                    @click="openCounty(feature.metric)"
                    @keyup.enter="openCounty(feature.metric)"
                    @keyup.space.prevent="openCounty(feature.metric)"
                  >
                    <title>
                      {{
                        `${formatCountyLabel(feature.countyName, 'Unknown')}: ${
                          feature.metric
                            ? formatUsdCompact(feature.metric.amount)
                            : 'No public county total'
                        }`
                      }}
                    </title>
                  </path>
                </g>
              </svg>
            </div>

            <div class="space-y-3">
              <div class="rounded-[1.25rem] border border-default bg-default/88 p-4 shadow-card">
                <div class="flex items-center justify-between text-xs font-semibold text-muted">
                  <span>Lower</span>
                  <span>Higher</span>
                </div>
                <div class="mt-3 grid grid-cols-5 gap-1">
                  <span
                    v-for="color in legendStops"
                    :key="color"
                    class="h-3 rounded-full"
                    :style="{ backgroundColor: color }"
                  />
                </div>
                <p class="mt-3 text-xs text-muted">
                  Counties without a matched annual total remain slate.
                </p>
              </div>

              <div class="rounded-[1.25rem] border border-default bg-default/88 p-4 shadow-card">
                <p class="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                  Explorer note
                </p>
                <p class="mt-2 text-sm text-muted">
                  This map reflects the annual county expenditure layer. It is not derived from
                  geocoded payment transactions.
                </p>
              </div>
            </div>
          </div>
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
            @mouseenter="focusCounty(normalizeCountyKey(county.county_name))"
            @mouseleave="clearCountyFocus"
            @focus="focusCounty(normalizeCountyKey(county.county_name))"
            @blur="clearCountyFocus"
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
