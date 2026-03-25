<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const getQuery = (q: any) => new URLSearchParams(q).toString()
const page = computed(() => Number(route.query.page) || 1)
const { data, status } = await useFetch('/api/v1/transactions', {
  query: computed(() => ({
    ...route.query,
    limit: 50,
    offset: (page.value - 1) * 50,
  })),
})

// Transaction ledger is heavy and non-canonical, enforce noindex.
useSeoMeta({
  title: 'Payment Transactions | Texas Spends',
  description: 'Search granular payment transactions and state expenditures.',
  robots: 'noindex, nofollow',
})

const columns: any[] = [
  { key: 'payment_date', label: 'Date' },
  { key: 'agency_name', label: 'Agency' },
  { key: 'payee_name', label: 'Payee' },
  { key: 'object_title', label: 'Category' },
  { key: 'amount', label: 'Amount' },
  { key: 'actions', label: '' },
]
</script>

<template>
  <div>
    <FilterBar />
    <UContainer class="py-8">
      <div class="mb-6 flex justify-between items-end">
        <div>
          <h1 class="text-3xl font-bold">Transactions Ledger</h1>
          <p class="text-[var(--ui-text-muted)] mt-1">
            Granular payment log for all state expenditures.
          </p>
        </div>
        <UButton
          :to="`/api/v1/transactions?${getQuery(route.query)}`"
          target="_blank"
          icon="i-heroicons-arrow-down-tray"
          color="neutral"
          variant="outline"
          >Export JSON</UButton
        >
      </div>

      <UCard>
        <UTable :rows="data?.data || []" :columns="columns" :loading="status === 'pending'">
          <template #payment_date-data="{ row }">
            <span class="whitespace-nowrap">{{
              new Date((row as any).payment_date).toLocaleDateString()
            }}</span>
          </template>
          <template #agency_name-data="{ row }">
            <NuxtLink
              :to="`/agencies/${(row as any).agency_id}`"
              class="text-[var(--ui-primary)] hover:underline truncate block max-w-xs"
              :title="(row as any).agency_name"
            >
              {{ (row as any).agency_name }}
            </NuxtLink>
          </template>
          <template #payee_name-data="{ row }">
            <NuxtLink
              v-if="(row as any).payee_id"
              :to="`/payees/${(row as any).payee_id}`"
              class="text-[var(--ui-primary)] hover:underline truncate block max-w-xs"
              :title="(row as any).payee_name"
            >
              {{ (row as any).payee_name }}
            </NuxtLink>
            <span v-else class="italic text-[var(--ui-text-muted)]">{{
              (row as any).payee_name
            }}</span>
          </template>
          <template #object_title-data="{ row }">
            <span class="truncate block max-w-[200px]" :title="(row as any).object_title">{{
              (row as any).object_title || (row as any).object_code
            }}</span>
          </template>
          <template #amount-data="{ row }">
            <span class="font-medium whitespace-nowrap"
              >${{ Number((row as any).amount || 0).toLocaleString() }}</span
            >
          </template>
          <template #actions-data="{ row }">
            <!-- Optional detail view link if a modal/page exists for transaction details -->
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
