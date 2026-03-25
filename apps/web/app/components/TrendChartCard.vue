<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  series: any[]
  xKey: string
  yKey: string
  title?: string
  valueFormatter?: (val: number) => string
}>()

const width = 600
const height = 200
const padding = 40

const maxVal = computed(() => {
  if (!props.series?.length) return 0
  return Math.max(...props.series.map((s) => Number(s[props.yKey]) || 0))
})

const points = computed(() => {
  if (!props.series || props.series.length === 0) return ''
  const xStep = (width - padding * 2) / Math.max(1, props.series.length - 1)

  return props.series
    .map((point, i) => {
      const x = padding + i * xStep
      const val = Number(point[props.yKey]) || 0
      const y =
        maxVal.value > 0
          ? height - padding - (val / maxVal.value) * (height - padding * 2)
          : height - padding
      return `${x},${y}`
    })
    .join(' ')
})

function formatValue(val: number) {
  if (props.valueFormatter) return props.valueFormatter(val)
  return new Intl.NumberFormat('en-US', { notation: 'compact', compactDisplay: 'short' }).format(
    val,
  )
}
</script>

<template>
  <UCard class="w-full">
    <template v-if="title" #header>
      <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">
        {{ title }}
      </h3>
    </template>

    <div class="relative w-full overflow-hidden" style="aspect-ratio: 3/1; min-height: 200px">
      <!-- eslint-disable-next-line narduk/no-inline-svg -- Exception: Data visualization chart, not an icon -->
      <svg
        v-if="series?.length"
        viewBox="0 0 600 200"
        preserveAspectRatio="none"
        class="w-full h-full stroke-primary-500 fill-none"
      >
        <polyline
          :points="points"
          stroke-width="3"
          stroke-linecap="round"
          stroke-linejoin="round"
        />

        <!-- Points -->
        <circle
          v-for="(point, i) in series"
          :key="i"
          :cx="padding + i * ((width - padding * 2) / Math.max(1, series.length - 1))"
          :cy="
            maxVal > 0
              ? height - padding - (Number(point[yKey]) / maxVal) * (height - padding * 2)
              : height - padding
          "
          r="4"
          class="fill-white dark:fill-gray-900 stroke-[3px]"
        />
      </svg>
      <div v-else class="absolute inset-0 flex items-center justify-center text-sm text-gray-500">
        No trend data available
      </div>
    </div>

    <!-- X Axis labels (crude) -->
    <div v-if="series?.length" class="flex justify-between px-[40px] mt-2 text-xs text-gray-500">
      <span
        v-for="(point, i) in series"
        :key="i"
        class="hidden sm:block"
        :class="{
          'sm:hidden': i % Math.ceil(series.length / 5) !== 0 && i !== 0 && i !== series.length - 1,
        }"
      >
        {{ point[xKey] }}
      </span>
    </div>
  </UCard>
</template>
