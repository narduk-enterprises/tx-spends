<script setup lang="ts">
type FilterValue = string | number | boolean | null

const props = defineProps<{
  availableFilters: {
    key: string
    label: string
    type: 'select' | 'input' | 'boolean'
    placeholder?: string
    options?: { label: string; value: string | number | boolean }[]
  }[]
  modelValue: Record<string, FilterValue>
}>()

const emit = defineEmits<{
  'update:modelValue': [value: Record<string, FilterValue>]
}>()

const filters = ref<Record<string, FilterValue>>({})

watch(
  () => props.modelValue,
  (value) => {
    filters.value = { ...value }
  },
  {
    immediate: true,
  },
)

function updateFilter(key: string, value: FilterValue) {
  const nextFilters = { ...filters.value, [key]: value }
  filters.value = nextFilters
  emit('update:modelValue', nextFilters)
}

function clearFilters() {
  const clearedFilters = Object.fromEntries(
    Object.keys(filters.value).map((key) => [key, null]),
  ) as Record<string, FilterValue>
  filters.value = clearedFilters
  emit('update:modelValue', clearedFilters)
}

function getFilterId(key: string) {
  return `explorer-filter-${key}`
}

function getSelectValue(key: string) {
  return filters.value[key] ?? 'all'
}
</script>

<template>
  <section
    class="sticky top-[5.25rem] z-20 rounded-[1.5rem] border border-default bg-default/90 p-4 shadow-card backdrop-blur-xl"
  >
    <div class="mb-4 flex items-center justify-between gap-3">
      <div class="flex items-center gap-2">
        <div
          class="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary"
        >
          <UIcon name="i-lucide-sliders-horizontal" class="size-4" />
        </div>
        <div>
          <p class="text-sm font-semibold text-default">Filters</p>
          <p class="text-xs text-muted">
            Apply fiscal year, entity, and amount filters for this view.
          </p>
        </div>
      </div>

      <div class="flex shrink-0 items-center gap-2">
        <UButton color="neutral" variant="ghost" class="rounded-full" @click="clearFilters">
          Reset
        </UButton>
        <slot name="actions" />
      </div>
    </div>

    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <div v-for="filter in availableFilters" :key="filter.key" class="min-w-0">
        <UFormField v-if="filter.type !== 'boolean'" :label="filter.label" class="w-full">
          <USelect
            v-if="filter.type === 'select'"
            :id="getFilterId(filter.key)"
            :name="filter.key"
            :model-value="getSelectValue(filter.key)"
            :items="filter.options || []"
            :placeholder="filter.placeholder || `Select ${filter.label.toLowerCase()}`"
            class="w-full"
            color="neutral"
            variant="outline"
            @update:model-value="
              updateFilter(filter.key, $event === 'all' ? null : ($event as FilterValue))
            "
          />

          <UInput
            v-else
            :id="getFilterId(filter.key)"
            :name="filter.key"
            :model-value="String(filters[filter.key] ?? '')"
            :placeholder="filter.placeholder || filter.label"
            class="w-full"
            color="neutral"
            variant="outline"
            @update:model-value="updateFilter(filter.key, $event || null)"
          />
        </UFormField>

        <UCheckbox
          v-else
          :id="getFilterId(filter.key)"
          :name="filter.key"
          :model-value="Boolean(filters[filter.key])"
          :label="filter.label"
          color="primary"
          class="pt-6"
          @update:model-value="updateFilter(filter.key, $event)"
        />
      </div>
    </div>
  </section>
</template>
