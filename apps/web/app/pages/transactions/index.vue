<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSeoMeta, useAsyncData, useRoute, useRouter } from '#imports'

useSeoMeta({
  title: 'Texas State Transactions - Spending Explorer',
  description:
    'Explore individual payment transactions made by Texas state agencies. Transactions may be masked or aggregated for confidentiality.',
  robots: 'noindex', // Specific requirement per SPEC.md
})

const route = useRoute()
const router = useRouter()

const page = ref(Number(route.query.page) || 1)
const sort = ref<{ column: string; direction: 'asc' | 'desc' }>({
  column: String(route.query.sort || 'payment_date'),
  direction: (route.query.dir as 'asc' | 'desc') || 'desc',
})

const filters = ref({
  fiscal_year: route.query.fy ? Number(route.query.fy) : 2025,
  search: route.query.q ? String(route.query.q) : null,
  agency: route.query.agency ? String(route.query.agency) : null,
  category: route.query.category ? String(route.query.category) : null,
  amount_min: route.query.min ? Number(route.query.min) : null,
  amount_max: route.query.max ? Number(route.query.max) : null,
})

// eslint-disable-next-line narduk/prefer-shallow-watch -- Exception: Deep watch required to observe nested filter object properties
watch(
  [page, sort, filters],
  () => {
    router.replace({
      query: {
        ...route.query,
        page: page.value > 1 ? page.value : undefined,
        sort: sort.value.column !== 'payment_date' ? sort.value.column : undefined,
        dir: sort.value.direction !== 'desc' ? sort.value.direction : undefined,
        fy: filters.value.fiscal_year !== 2025 ? filters.value.fiscal_year : undefined,
        q: filters.value.search || undefined,
        agency: filters.value.agency || undefined,
        category: filters.value.category || undefined,
        min: filters.value.amount_min || undefined,
        max: filters.value.amount_max || undefined,
      },
    })
  },
  { deep: true },
)

const { data, pending } = await useAsyncData(
  `transactions-${page.value}-${sort.value.column}-${sort.value.direction}-${JSON.stringify(filters.value)}`,
  () => {
    return Promise.resolve({
      data: [
        {
          transaction_id: 'tx-101',
          payment_date: '2025-01-15',
          agency_name: 'Health and Human Services Commission',
          payee_name: 'Mock Vendor A',
          amount: 500000.0,
          formatted_object_title: 'Medical Services',
        },
        {
          transaction_id: 'tx-102',
          payment_date: '2025-01-14',
          agency_name: 'Texas Education Agency',
          payee_name: 'Mock School District',
          amount: 150000.0,
          formatted_object_title: 'Grants',
        },
        {
          transaction_id: 'tx-103',
          payment_date: '2025-01-12',
          agency_name: 'Department of Transportation',
          payee_name: 'Mock Construction Co',
          amount: 2500000.0,
          formatted_object_title: 'Construction',
        },
        {
          transaction_id: 'tx-104',
          payment_date: '2025-01-10',
          agency_name: 'Department of Public Safety',
          payee_name: 'Mock IT Provider',
          amount: 75000.5,
          formatted_object_title: 'Software Services',
        },
        {
          transaction_id: 'tx-105',
          payment_date: '2025-01-09',
          agency_name: 'Health and Human Services Commission',
          payee_name: 'Mock Vendor B',
          amount: 35000.0,
          formatted_object_title: 'Salaries and Wages',
        },
      ],
      meta: {
        limit: 50,
        offset: (page.value - 1) * 50,
        total: 5120530,
      },
    })
  },
  { watch: [page, sort, filters] },
)
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 h-full flex flex-col gap-6">
    <PageHeader
      title="Transaction Explorer"
      subtitle="Examine individual state payments."
      :breadcrumbs="[{ label: 'Home', to: '/' }, { label: 'Transactions' }]"
    />

    <DisclaimerStrip variant="transactions" />

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
        { key: 'search', label: 'Search Payee or Transaction', type: 'input' },
        { key: 'agency', label: 'Agency Filter', type: 'input' },
        { key: 'category', label: 'Category Filter', type: 'input' },
      ]"
    />

    <UCard>
      <div v-if="pending" class="flex justify-center p-12">
        <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-primary-500" />
      </div>

      <DataTableCard
        v-else
        :columns="[
          { key: 'payment_date', label: 'Date', sortable: true },
          { key: 'agency_name', label: 'Agency', sortable: true },
          { key: 'payee_name', label: 'Payee', sortable: true },
          { key: 'formatted_object_title', label: 'Category', sortable: true },
          { key: 'amount', label: 'Amount', sortable: true },
        ]"
        :rows="data?.data || []"
        :meta="data?.meta"
        @page="page = $event"
        @sort="sort = $event"
      >
        <template #amount-data="{ row }">
          {{
            new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
              row.amount,
            )
          }}
        </template>
        <template #payment_date-data="{ row }">
          <UBadge color="neutral" variant="subtle">{{ row.payment_date }}</UBadge>
        </template>
      </DataTableCard>
    </UCard>
  </div>
</template>
