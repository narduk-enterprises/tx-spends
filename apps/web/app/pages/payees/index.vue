<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSeoMeta, useAsyncData, useRoute, useRouter } from '#imports'

useSeoMeta({
  title: 'Texas State Payees - Spending Explorer',
  description: 'Search state payments to vendors and payees.',
  robots: 'noindex', // Large raw list
})

const route = useRoute()
const router = useRouter()

const page = ref(Number(route.query.page) || 1)
const sort = ref<{ column: string; direction: 'asc' | 'desc' }>({
  column: String(route.query.sort || 'amount'),
  direction: (route.query.dir as 'asc' | 'desc') || 'desc',
})

const filters = ref({
  fiscal_year: route.query.fy ? Number(route.query.fy) : 2025,
  search: route.query.q ? String(route.query.q) : null,
})

// eslint-disable-next-line narduk/prefer-shallow-watch -- Exception: Deep watch required to observe nested filter object properties
watch(
  [page, sort, filters],
  () => {
    router.replace({
      query: {
        ...route.query,
        page: page.value > 1 ? page.value : undefined,
        sort: sort.value.column !== 'amount' ? sort.value.column : undefined,
        dir: sort.value.direction !== 'desc' ? sort.value.direction : undefined,
        fy: filters.value.fiscal_year !== 2025 ? filters.value.fiscal_year : undefined,
        q: filters.value.search || undefined,
      },
    })
  },
  { deep: true },
)

const { data, pending } = await useAsyncData(
  `payees-${page.value}-${sort.value.column}-${sort.value.direction}-${filters.value.fiscal_year}-${filters.value.search}`,
  () => {
    return Promise.resolve({
      data: [
        {
          payee_id: 'p-1',
          payee_name_normalized: 'MOCK VENDOR A',
          amount: 500000.0,
          hub_status: true,
        },
        {
          payee_id: 'p-2',
          payee_name_normalized: 'MOCK SCHOOL DISTRICT',
          amount: 150000.0,
          hub_status: false,
        },
        {
          payee_id: 'p-3',
          payee_name_normalized: 'MOCK CONSTRUCTION CO',
          amount: 2500000.0,
          hub_status: true,
        },
      ],
      meta: {
        limit: 50,
        offset: (page.value - 1) * 50,
        total: 58231,
      },
    })
  },
  { watch: [page, sort, filters] },
)
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 h-full flex flex-col gap-6">
    <PageHeader
      title="State Payees & Vendors"
      subtitle="Search aggregated state payments to individuals and organizations."
      :breadcrumbs="[{ label: 'Home', to: '/' }, { label: 'Payees' }]"
    />

    <DisclaimerStrip variant="payee" />

    <FilterBar
      v-model="filters"
      :available-filters="[
        {
          key: 'fiscal_year',
          label: 'Fiscal Year',
          type: 'select',
          options: [
            { label: 'FY 2025', value: 2025 },
            { label: 'FY 2024', value: 2024 },
            { label: 'FY 2023', value: 2023 },
          ],
        },
        { key: 'search', label: 'Search Payee Name', type: 'input' },
      ]"
    />

    <UCard>
      <div v-if="pending" class="flex justify-center p-12">
        <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-primary-500" />
      </div>

      <DataTableCard
        v-else
        :columns="[
          { key: 'payee_name_normalized', label: 'Payee Name', sortable: true },
          { key: 'amount', label: 'Total Received', sortable: true },
        ]"
        :rows="data?.data || []"
        :meta="data?.meta"
        @page="page = $event"
        @sort="sort = $event"
      >
        <template #payee_name_normalized-data="{ row }">
          <ULink
            :to="`/payees/${row.payee_id}`"
            class="text-primary-600 dark:text-primary-400 font-medium hover:underline flex items-center gap-2"
          >
            {{ row.payee_name_normalized }}
            <UIcon
              v-if="row.hub_status"
              name="i-heroicons-check-badge"
              class="w-4 h-4 text-primary-500 shrink-0"
            />
          </ULink>
        </template>
        <template #amount-data="{ row }">
          {{
            new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
              maximumFractionDigits: 0,
            }).format(row.amount)
          }}
        </template>
      </DataTableCard>
    </UCard>
  </div>
</template>
