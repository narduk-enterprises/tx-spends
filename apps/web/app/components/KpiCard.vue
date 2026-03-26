<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    label: string
    value: string | number
    icon?: string
    helper?: string
    delta?: { value: number; direction: 'up' | 'down' | 'neutral' }
    /** When true, value/helper render as skeletons (e.g. filter refetch). */
    loading?: boolean
  }>(),
  {
    icon: 'i-lucide-chart-column-big',
    helper: '',
    delta: undefined,
    loading: false,
  },
)

const deltaIcon = computed(() => {
  if (!props.delta) {
    return ''
  }

  if (props.delta.direction === 'up') {
    return 'i-lucide-trending-up'
  }

  if (props.delta.direction === 'down') {
    return 'i-lucide-trending-down'
  }

  return 'i-lucide-minus'
})

const deltaClass = computed(() => {
  if (!props.delta) {
    return ''
  }

  if (props.delta.direction === 'up') {
    return 'text-success'
  }

  if (props.delta.direction === 'down') {
    return 'text-error'
  }

  return 'text-muted'
})
</script>

<template>
  <UCard class="card-base overflow-hidden">
    <div class="flex items-start justify-between gap-4">
      <div class="space-y-3">
        <p class="text-xs font-semibold uppercase tracking-[0.16em] text-muted">{{ label }}</p>
        <div class="space-y-2">
          <USkeleton v-if="loading" class="h-10 w-36 rounded-lg sm:h-12 sm:w-44" />
          <p v-else class="text-3xl font-semibold tracking-tight text-default sm:text-4xl">
            {{ value }}
          </p>
          <div v-if="loading" class="flex flex-wrap items-center gap-3 text-sm">
            <USkeleton class="h-4 w-28 rounded-md" />
          </div>
          <div v-else-if="helper || delta" class="flex flex-wrap items-center gap-3 text-sm">
            <span
              v-if="delta"
              :class="['inline-flex items-center gap-1.5 font-medium', deltaClass]"
            >
              <UIcon :name="deltaIcon" class="size-4" />
              {{ delta.value }}%
            </span>
            <span v-if="helper" class="text-muted">{{ helper }}</span>
          </div>
        </div>
      </div>

      <div
        class="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"
      >
        <UIcon :name="icon" class="size-5" />
      </div>
    </div>
  </UCard>
</template>
