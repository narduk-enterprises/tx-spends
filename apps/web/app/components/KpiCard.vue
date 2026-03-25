<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  label: string
  value: string | number
  delta?: { value: number; direction: 'up' | 'down' | 'neutral' }
  helper?: string
}>()
</script>

<template>
  <UCard class="flex flex-col">
    <div class="text-sm font-medium text-gray-500 dark:text-gray-400">
      {{ label }}
    </div>
    <div class="mt-2 flex items-baseline gap-2">
      <span class="text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">
        {{ value }}
      </span>
      <span
        v-if="delta"
        :class="[
          'text-sm font-medium',
          delta.direction === 'up'
            ? 'text-green-600 dark:text-green-400'
            : delta.direction === 'down'
              ? 'text-red-600 dark:text-red-400'
              : 'text-gray-500 dark:text-gray-400',
        ]"
      >
        <UIcon
          v-if="delta.direction === 'up'"
          name="i-heroicons-arrow-up-right"
          class="w-4 h-4 inline"
        />
        <UIcon
          v-else-if="delta.direction === 'down'"
          name="i-heroicons-arrow-down-right"
          class="w-4 h-4 inline"
        />
        {{ delta.value }}%
      </span>
    </div>
    <div v-if="helper" class="mt-1 text-xs text-gray-500 dark:text-gray-400">
      {{ helper }}
    </div>
  </UCard>
</template>
