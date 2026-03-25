<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const page = computed(() => Number(route.query.page) || 1)
const { data, status } = await useFetch('/api/v1/categories', {
  query: computed(() => ({
    ...route.query,
    limit: 100,
    offset: (page.value - 1) * 100,
  })),
})

useSeoMeta({
  title: 'Expenditure Categories | Texas Spends',
  description: 'Analyze state spending by expenditure purpose and category.',
})

const columns: any[] = [
  { key: 'category_code', label: 'Code' },
  { key: 'category_title', label: 'Category Title' },
  { key: 'total_spend', label: 'Total Spend' },
  { key: 'actions', label: '' },
]
</script>

<template>
  <div>
    <FilterBar />
    <UContainer class="py-8">
      <div class="mb-6">
        <h1 class="text-3xl font-bold">Expenditure Categories</h1>
        <p class="text-[var(--ui-text-muted)] mt-1">
          High-level buckets and specific Comptroller objects for state spending.
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
              :to="`/categories/${(row as any).category_code}`"
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
            :disabled="!data?.data || data.data.length < 100"
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
