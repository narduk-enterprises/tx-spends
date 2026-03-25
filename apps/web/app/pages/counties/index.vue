<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const page = computed(() => Number(route.query.page) || 1)
const { data, status } = await useFetch('/api/v1/counties', {
  query: computed(() => ({
    ...route.query,
    limit: 50,
    offset: (page.value - 1) * 50,
  })),
})

useSeoMeta({
  title: 'Counties | Texas Spends',
  description: 'Explore the flow of state funds to the 254 counties in Texas.',
})

const columns: any[] = [
  { key: 'county_id', label: 'County ID' },
  { key: 'county_name', label: 'County Name' },
  { key: 'total_spend', label: 'Total Local Expend.' },
  { key: 'actions', label: '' },
]
</script>

<template>
  <div>
    <FilterBar />
    <UContainer class="py-8">
      <div class="mb-6">
        <h1 class="text-3xl font-bold">Texas Counties</h1>
        <p class="text-[var(--ui-text-muted)] mt-1">
          Explore local county spending and geographic distribution.
        </p>
      </div>

      <UCard>
        <UTable :rows="data?.data || []" :columns="columns" :loading="status === 'pending'">
          <template #total_spend-data="{ row }">
            <span class="font-medium"
              >${{ Number((row as any).total_spend || 0).toLocaleString() }}</span
            >
          </template>
          <template #actions-data="{ row }">
            <UButton
              :to="`/counties/${(row as any).county_id}`"
              color="neutral"
              variant="ghost"
              icon="i-heroicons-arrow-right"
            />
          </template>
        </UTable>

        <div class="flex justify-between items-center mt-4 border-t border-[var(--ui-border)] pt-4">
          <UButton
            :disabled="page <= 1"
            :to="{ query: { ...route.query, page: page - 1 } }"
            icon="i-heroicons-chevron-left"
            label="Previous"
            color="neutral"
            variant="ghost"
          />
          <span class="text-sm text-[var(--ui-text-muted)]">Page {{ page }}</span>
          <UButton
            :to="{ query: { ...route.query, page: page + 1 } }"
            :disabled="!data?.data || data.data.length < 50"
            icon-trailing="i-heroicons-chevron-right"
            label="Next"
            color="neutral"
            variant="ghost"
          />
        </div>
      </UCard>
    </UContainer>
  </div>
</template>
