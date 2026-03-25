<script setup lang="ts">
import { formatCount, formatDurationShort, formatFiscalYearCoverage } from '~/utils/explorer'

const props = withDefaults(
  defineProps<{
    title?: string
    description?: string
    sourceRowCount: number
    sourceFileCount: number
    fiscalYears: number[]
    activeRuntimeSeconds?: number | null
  }>(),
  {
    title: 'Payments backfill in progress',
    description:
      'The Texas Comptroller payment exports have been captured and the transaction-level load is still committing to the live explorer.',
    activeRuntimeSeconds: null,
  },
)

const statItems = computed(() => {
  const items = [
    {
      label: 'Exported rows',
      value: formatCount(props.sourceRowCount),
    },
    {
      label: 'Monthly exports',
      value: formatCount(props.sourceFileCount),
    },
    {
      label: 'Coverage',
      value: formatFiscalYearCoverage(props.fiscalYears),
    },
  ]

  if (props.activeRuntimeSeconds) {
    items.push({
      label: 'Current ingest',
      value: formatDurationShort(props.activeRuntimeSeconds),
    })
  }

  return items
})
</script>

<template>
  <div class="rounded-[1.5rem] border border-primary/15 bg-primary/5 p-5">
    <div class="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
      <div class="max-w-2xl space-y-3">
        <div class="flex items-center gap-3">
          <div
            class="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"
          >
            <UIcon name="i-lucide-database-zap" class="size-5" />
          </div>
          <div class="space-y-1">
            <p class="text-base font-semibold text-default">{{ title }}</p>
            <p class="text-sm leading-6 text-muted">{{ description }}</p>
          </div>
        </div>
      </div>

      <dl class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div
          v-for="item in statItems"
          :key="item.label"
          class="rounded-2xl border border-primary/10 bg-default/80 px-4 py-3 shadow-xs"
        >
          <dt class="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted">
            {{ item.label }}
          </dt>
          <dd class="mt-1 text-sm font-semibold text-default">
            {{ item.value }}
          </dd>
        </div>
      </dl>
    </div>

    <div v-if="$slots.actions" class="mt-4 flex flex-wrap items-center gap-2">
      <slot name="actions" />
    </div>
  </div>
</template>
