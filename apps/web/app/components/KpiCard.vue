<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    label: string
    value: string | number
    icon?: string
    helper?: string
    delta?: { value: number; direction: 'up' | 'down' | 'neutral' }
  }>(),
  {
    icon: 'i-lucide-chart-column-big',
    helper: '',
    delta: undefined,
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
          <p class="text-3xl font-semibold tracking-tight text-default sm:text-4xl">
            {{ value }}
          </p>
          <div v-if="helper || delta" class="flex flex-wrap items-center gap-3 text-sm">
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
