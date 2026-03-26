<script setup lang="ts">
import { formatUsdCompact } from '~/utils/explorer'

const props = withDefaults(
  defineProps<{
    series: Array<Record<string, string | number | null>>
    xKey: string
    yKey: string
    title?: string
    description?: string
    valueFormatter?: (value: number) => string
    loading?: boolean
  }>(),
  {
    title: '',
    description: '',
    valueFormatter: undefined,
    loading: false,
  },
)

const width = 720
const height = 240
const paddingX = 48
const paddingY = 24

const maxVal = computed(() =>
  Math.max(...props.series.map((point) => Number(point[props.yKey]) || 0), 0),
)

const points = computed(() => {
  if (!props.series.length) {
    return ''
  }

  const xStep = (width - paddingX * 2) / Math.max(1, props.series.length - 1)

  return props.series
    .map((point, index) => {
      const x = paddingX + index * xStep
      const value = Number(point[props.yKey]) || 0
      const y =
        maxVal.value > 0
          ? height - paddingY - (value / maxVal.value) * (height - paddingY * 2)
          : height - paddingY
      return `${x},${y}`
    })
    .join(' ')
})

function formatValue(value: number) {
  if (props.valueFormatter) {
    return props.valueFormatter(value)
  }

  return formatUsdCompact(value)
}
</script>

<template>
  <UCard class="card-base overflow-hidden">
    <template #header>
      <div class="space-y-1">
        <p class="text-lg font-semibold text-default">{{ title }}</p>
        <p v-if="description" class="text-sm text-muted">{{ description }}</p>
      </div>
    </template>

    <div v-if="loading" class="space-y-4">
      <div class="overflow-hidden rounded-[1.5rem] border border-default bg-elevated/80 p-4">
        <USkeleton class="h-64 w-full rounded-xl" />
      </div>
      <div class="grid gap-3 sm:grid-cols-4">
        <div v-for="i in 4" :key="i" class="rounded-2xl border border-default bg-default px-4 py-3">
          <USkeleton class="h-3 w-12 rounded-md" />
          <USkeleton class="mt-3 h-5 w-24 rounded-md" />
        </div>
      </div>
    </div>

    <div v-else-if="series.length > 1" class="space-y-4">
      <div class="overflow-hidden rounded-[1.5rem] border border-default bg-elevated/80 p-4">
        <!-- eslint-disable-next-line narduk/no-inline-svg -- Inline SVG is the chart renderer -->
        <svg viewBox="0 0 720 240" preserveAspectRatio="none" class="h-64 w-full">
          <defs>
            <linearGradient id="trend-stroke" x1="0%" x2="100%" y1="0%" y2="0%">
              <stop offset="0%" stop-color="rgb(245 158 11)" />
              <stop offset="100%" stop-color="rgb(14 165 233)" />
            </linearGradient>
          </defs>

          <polyline
            :points="points"
            fill="none"
            stroke="url(#trend-stroke)"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="4"
          />

          <circle
            v-for="(point, index) in series"
            :key="`${point[xKey]}-${index}`"
            :cx="paddingX + index * ((width - paddingX * 2) / Math.max(1, series.length - 1))"
            :cy="
              maxVal > 0
                ? height - paddingY - (Number(point[yKey]) / maxVal) * (height - paddingY * 2)
                : height - paddingY
            "
            r="5"
            fill="rgb(255 255 255)"
            stroke="rgb(245 158 11)"
            stroke-width="3"
          />
        </svg>
      </div>

      <div class="grid gap-3 sm:grid-cols-4">
        <div
          v-for="point in series.slice(Math.max(0, series.length - 4))"
          :key="String(point[xKey])"
          class="rounded-2xl border border-default bg-default px-4 py-3"
        >
          <p class="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
            {{ point[xKey] }}
          </p>
          <p class="mt-2 text-sm font-semibold text-default">
            {{ formatValue(Number(point[yKey])) }}
          </p>
        </div>
      </div>
    </div>

    <div
      v-else-if="!loading && series.length === 1"
      class="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]"
    >
      <div
        class="overflow-hidden rounded-[1.5rem] border border-default bg-[var(--gradient-hero)] p-6"
      >
        <div class="space-y-4">
          <div
            class="inline-flex rounded-full border border-primary/20 bg-default/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-primary"
          >
            Limited timeline
          </div>
          <div class="space-y-2">
            <p class="text-sm font-medium text-muted">
              Only one reporting period is currently loaded for this view.
            </p>
            <p class="text-4xl font-semibold tracking-tight text-default">
              {{ formatValue(Number(series[0]?.[yKey])) }}
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-3 text-sm text-muted">
            <span
              class="inline-flex items-center gap-2 rounded-full border border-default bg-default/80 px-3 py-1"
            >
              <span class="size-2 rounded-full bg-primary" />
              {{ series[0]?.[xKey] }}
            </span>
            <span>Additional periods will appear here as more historical batches are loaded.</span>
          </div>
        </div>
      </div>

      <div class="rounded-[1.5rem] border border-default bg-default p-5">
        <p class="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Current period</p>
        <p class="mt-3 text-2xl font-semibold text-default">
          {{ String(series[0]?.[xKey] ?? 'Current period') }}
        </p>
        <p class="mt-2 text-sm text-muted">
          The explorer is rendering a summary state instead of an empty line chart while only one
          data point is available.
        </p>
      </div>
    </div>

    <EmptyState
      v-else
      title="No trend data"
      description="This view does not currently have enough data points to render a time series."
      icon="i-lucide-chart-no-axes-combined"
    />
  </UCard>
</template>
