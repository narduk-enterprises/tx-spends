<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  availableFilters: {
    key: string
    label: string
    type: 'select' | 'input' | 'boolean'
    options?: { label: string; value: string | number | boolean }[]
  }[]
  modelValue: Record<string, string | number | boolean | null>
}>()

const emit = defineEmits<{
  'update:modelValue': [value: Record<string, string | number | boolean | null>]
}>()

const filters = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

function updateFilter(key: string, value: string | number | boolean | null) {
  filters.value = { ...filters.value, [key]: value }
}

function clearFilters() {
  const cleared = Object.keys(filters.value).reduce(
    (acc, key) => {
      acc[key] = null
      return acc
    },
    {} as Record<string, string | number | boolean | null>,
  )
  emit('update:modelValue', cleared)
}
</script>

<template>
  <div
    class="sticky top-0 z-10 bg-white/90 dark:bg-gray-900/90 backdrop-blur border-b border-gray-200 dark:border-gray-800 p-4 mb-6 flex flex-col md:flex-row gap-4 items-end md:items-center justify-between"
  >
    <div class="flex flex-wrap gap-4 items-center flex-1">
      <div v-for="filter in availableFilters" :key="filter.key" class="min-w-[200px]">
        <UFormField v-if="filter.type !== 'boolean'" :label="filter.label" class="w-full">
          <USelect
            v-if="filter.type === 'select'"
            :model-value="String(filters[filter.key] ?? '')"
            @update:model-value="updateFilter(filter.key, $event as any)"
            :options="filter.options"
            class="w-full"
            color="neutral"
            variant="outline"
          />

          <UInput
            v-else-if="filter.type === 'input'"
            :model-value="String(filters[filter.key] ?? '')"
            @update:model-value="updateFilter(filter.key, $event)"
            class="w-full"
            color="neutral"
            variant="outline"
          />
        </UFormField>

        <UCheckbox
          v-else-if="filter.type === 'boolean'"
          :model-value="Boolean(filters[filter.key])"
          @update:model-value="updateFilter(filter.key, $event)"
          :label="filter.label"
          color="primary"
          class="mt-6"
        />
      </div>
    </div>

    <div class="flex gap-2 shrink-0">
      <UButton variant="ghost" color="neutral" @click="clearFilters"> Clear Filters </UButton>
      <slot name="actions" />
    </div>
  </div>
</template>
