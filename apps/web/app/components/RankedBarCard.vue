<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    items: Array<Record<string, string | number | null>>
    labelKey: string
    valueKey: string
    title?: string
    description?: string
    valueFormatter?: (value: number) => string
    loading?: boolean
    emptyTitle?: string
    emptyDescription?: string
  }>(),
  {
    title: '',
    description: '',
    valueFormatter: undefined,
    loading: false,
    emptyTitle: 'No ranked data',
    emptyDescription: 'There are no rows available for this breakdown under the current filters.',
  },
)

const maxVal = computed(() =>
  Math.max(...props.items.map((item) => Number(item[props.valueKey]) || 0), 0),
)

function formatValue(value: number) {
  if (props.valueFormatter) {
    return props.valueFormatter(value)
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
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

    <div v-if="loading" class="flex min-h-48 items-center justify-center">
      <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin text-primary" />
    </div>

    <div v-else-if="items.length" class="space-y-4">
      <div
        v-for="(item, index) in items"
        :key="`${String(item[labelKey])}-${index}`"
        class="space-y-2"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="truncate text-sm font-semibold text-default">{{ item[labelKey] }}</p>
            <p class="text-xs text-muted">Rank {{ index + 1 }}</p>
          </div>
          <span class="shrink-0 text-sm font-semibold text-primary">
            {{ formatValue(Number(item[valueKey])) }}
          </span>
        </div>
        <div class="h-2.5 overflow-hidden rounded-full bg-elevated">
          <div
            class="h-full rounded-full bg-linear-to-r from-primary to-secondary transition-slow"
            :style="{ width: `${maxVal > 0 ? (Number(item[valueKey]) / maxVal) * 100 : 0}%` }"
          />
        </div>
      </div>
    </div>

    <EmptyState
      v-else
      :title="emptyTitle"
      :description="emptyDescription"
      icon="i-lucide-bar-chart-3"
    />
  </UCard>
</template>
