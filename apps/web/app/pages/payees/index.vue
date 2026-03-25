<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const page = computed(() => Number(route.query.page) || 1)
const { data, status } = await useFetch('/api/v1/payees', {
  query: computed(() => ({
    ...route.query,
    limit: 20,
    offset: (page.value - 1) * 20,
  })),
})

useSeoMeta({
  title: 'State Vendors & Payees | Texas Spends',
  description: 'Browse total expenditures for entities and vendors doing business with Texas.',
})

const columns: any[] = [
  { key: 'payee_id', label: 'Payee ID' },
  { key: 'payee_name', label: 'Payee Name' },
  { key: 'total_spend', label: 'Total Spend' },
  { key: 'actions', label: '' },
]
</script>

<template>
  <div>
    <FilterBar />
    <UContainer class="py-8">
      <div class="mb-6">
        <h1 class="text-3xl font-bold">Vendors & Payees</h1>
        <p class="text-[var(--ui-text-muted)] mt-1">
          Explore entities receiving payments from the state.
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
              v-if="(row as any).payee_id"
              :to="`/payees/${(row as any).payee_id}`"
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
            :disabled="!data?.data || data.data.length < 20"
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
