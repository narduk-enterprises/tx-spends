<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  items: any[]
  labelKey: string
  valueKey: string
  title?: string
  valueFormatter?: (val: number) => string
}>()

const maxVal = computed(() => {
  if (!props.items?.length) return 0
  return Math.max(...props.items.map((i) => Number(i[props.valueKey]) || 0))
})

function formatValue(val: number) {
  if (props.valueFormatter) return props.valueFormatter(val)
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(val)
}
</script>

<template>
  <UCard class="w-full">
    <template v-if="title" #header>
      <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">
        {{ title }}
      </h3>
    </template>

    <div class="flex flex-col gap-4">
      <div v-for="(item, index) in items" :key="index" class="flex flex-col gap-1">
        <div class="flex justify-between text-sm">
          <span class="font-medium text-gray-700 dark:text-gray-300 truncate pr-4">{{
            item[labelKey]
          }}</span>
          <span class="text-gray-500 dark:text-gray-400 tabular-nums shrink-0">{{
            formatValue(Number(item[valueKey]))
          }}</span>
        </div>
        <div class="h-2 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
          <div
            class="h-full bg-primary-500 dark:bg-primary-400 rounded-full transition-all duration-500"
            :style="{ width: `${maxVal > 0 ? (Number(item[valueKey]) / maxVal) * 100 : 0}%` }"
          />
        </div>
      </div>

      <div v-if="!items?.length" class="text-sm text-gray-500 py-4 text-center">
        No data available
      </div>
    </div>
  </UCard>
</template>
