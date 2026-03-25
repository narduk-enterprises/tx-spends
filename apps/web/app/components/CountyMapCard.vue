<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  countyMetrics: any[]
  fy?: number | string
}>()

const emit = defineEmits<{
  selectCounty: [countyId: string]
}>()

// We'll use RankedBarCard to represent the county list until a GeoJSON renderer is set up.
const topCounties = computed(() => {
  return (props.countyMetrics || []).slice(0, 10)
})
</script>

<template>
  <UCard class="w-full">
    <template #header>
      <div class="flex items-center justify-between">
        <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">
          State Spending by County
        </h3>
        <UBadge v-if="fy" color="neutral" variant="subtle">FY {{ fy }}</UBadge>
      </div>
    </template>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <!-- Map Placeholder -->
      <div
        class="bg-gray-50 dark:bg-gray-800/50 rounded-lg flex flex-col items-center justify-center p-8 border border-dashed border-gray-300 dark:border-gray-700 aspect-square lg:aspect-auto min-h-[300px]"
      >
        <UIcon name="i-heroicons-map" class="w-12 h-12 text-gray-400 mb-4" />
        <p class="text-sm text-gray-500 font-medium">Map Visualization Placeholder</p>
        <p class="text-xs text-gray-400 mt-1 max-w-xs text-center">
          County choropleth will appear here. Requires FIPS code mapped to Cartographic Boundaries.
        </p>
      </div>

      <!-- Ranked List Fallback -->
      <div class="flex flex-col gap-2 relative">
        <h4
          class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 border-b border-gray-100 dark:border-gray-800 pb-2"
        >
          Top Counties
        </h4>
        <div
          v-for="county in topCounties"
          :key="county.county_id"
          class="flex items-center justify-between group cursor-pointer p-2 -mx-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
          @click="emit('selectCounty', county.county_id)"
        >
          <span
            class="text-sm font-medium text-primary-600 dark:text-primary-400 group-hover:underline"
          >
            {{ county.county_name }}
          </span>
          <span class="text-sm text-gray-600 dark:text-gray-400 tabular-nums">
            {{
              new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                maximumFractionDigits: 0,
              }).format(county.amount)
            }}
          </span>
        </div>
        <div v-if="!topCounties.length" class="text-sm text-gray-500 py-4 text-center">
          No county data available
        </div>
      </div>
    </div>
  </UCard>
</template>
