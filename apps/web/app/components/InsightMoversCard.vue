<script setup lang="ts">
import { formatPct, formatUsdCompact } from '~/utils/explorer'

const props = defineProps<{
  movers: {
    current_year: number
    prior_year: number
    total_change_pct: number | null
    top_increases: Array<{
      id: string | null
      name: string
      current_amount: number
      prior_amount: number
      pct_change: number
    }>
    top_decreases: Array<{
      id: string | null
      name: string
      current_amount: number
      prior_amount: number
      pct_change: number
    }>
  }
}>()

const hasMoverData = computed(
  () => props.movers.top_increases.length > 0 || props.movers.top_decreases.length > 0,
)
</script>

<template>
  <UCard class="card-base overflow-hidden">
    <template #header>
      <div class="flex items-center justify-between gap-3">
        <div class="space-y-1">
          <p class="text-lg font-semibold text-default">Year-over-year standouts</p>
          <p class="text-sm text-muted">
            FY {{ movers.prior_year }} → FY {{ movers.current_year }} · Among top agencies<template
              v-if="movers.total_change_pct !== null"
            >
              · Total spend
              <span
                :class="
                  movers.total_change_pct > 0
                    ? 'font-medium text-success'
                    : movers.total_change_pct < 0
                      ? 'font-medium text-error'
                      : 'font-medium text-muted'
                "
                >{{ formatPct(movers.total_change_pct) }}</span
              >
            </template>
          </p>
        </div>
        <div
          class="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"
        >
          <UIcon name="i-lucide-arrow-left-right" class="size-5" />
        </div>
      </div>
    </template>

    <div v-if="hasMoverData" class="grid gap-6 sm:grid-cols-2">
      <div class="space-y-3">
        <p class="text-xs font-semibold uppercase tracking-[0.16em] text-success">
          Largest increases
        </p>
        <ul v-if="movers.top_increases.length > 0" class="space-y-2">
          <li
            v-for="item in movers.top_increases"
            :key="item.id || item.name"
            class="flex items-center justify-between gap-2"
          >
            <UButton
              :to="item.id ? `/agencies/${item.id}` : undefined"
              color="neutral"
              variant="link"
              class="min-w-0 flex-1 truncate px-0 text-left text-sm font-medium text-default"
            >
              {{ item.name }}
            </UButton>
            <div class="flex shrink-0 items-center gap-2">
              <span class="text-xs text-muted">{{ formatUsdCompact(item.current_amount) }}</span>
              <UBadge color="success" variant="soft" size="sm">
                {{ formatPct(item.pct_change) }}
              </UBadge>
            </div>
          </li>
        </ul>
        <p v-else class="text-sm text-muted">
          No significant increases among the top agencies.
        </p>
      </div>

      <div class="space-y-3">
        <p class="text-xs font-semibold uppercase tracking-[0.16em] text-error">
          Largest decreases
        </p>
        <ul v-if="movers.top_decreases.length > 0" class="space-y-2">
          <li
            v-for="item in movers.top_decreases"
            :key="item.id || item.name"
            class="flex items-center justify-between gap-2"
          >
            <UButton
              :to="item.id ? `/agencies/${item.id}` : undefined"
              color="neutral"
              variant="link"
              class="min-w-0 flex-1 truncate px-0 text-left text-sm font-medium text-default"
            >
              {{ item.name }}
            </UButton>
            <div class="flex shrink-0 items-center gap-2">
              <span class="text-xs text-muted">{{ formatUsdCompact(item.current_amount) }}</span>
              <UBadge color="error" variant="soft" size="sm">
                {{ formatPct(item.pct_change) }}
              </UBadge>
            </div>
          </li>
        </ul>
        <p v-else class="text-sm text-muted">
          No significant decreases among the top agencies.
        </p>
      </div>
    </div>

    <EmptyState
      v-else
      title="Not enough history"
      description="Year-over-year comparison requires at least two fiscal years of payment data."
      icon="i-lucide-calendar-x"
    />
  </UCard>
</template>
