<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSeoMeta, useAsyncData, useRoute, useRouter } from '#imports'

useSeoMeta({
  title: 'Texas State Agencies - Spending Explorer',
  description: 'Browse all Texas state agencies and view their total expenditures.',
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

// Sync URL
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
  `agencies-${page.value}-${sort.value.column}-${sort.value.direction}-${filters.value.fiscal_year}-${filters.value.search}`,
  () => {
    // Mock API for prototype
    return Promise.resolve({
      data: [
        {
          agency_id: '1',
          agency_name: 'Health and Human Services Commission',
          amount: 123456789.12,
        },
        { agency_id: '2', agency_name: 'Texas Education Agency', amount: 98000000.0 },
        { agency_id: '3', agency_name: 'Department of Transportation', amount: 75000000.0 },
        { agency_id: '4', agency_name: 'Department of Criminal Justice', amount: 45000000.0 },
        { agency_id: '5', agency_name: 'University of Texas at Austin', amount: 35000000.0 },
      ],
      meta: {
        limit: 50,
        offset: (page.value - 1) * 50,
        total: 142,
      },
    })
  },
  { watch: [page, sort, filters] },
)

const displayRows = computed(() => {
  if (!data.value) return []
  return data.value.data
    .filter((row) => {
      if (filters.value.search) {
        return row.agency_name.toLowerCase().includes(filters.value.search.toLowerCase())
      }
      return true
    })
    .sort((a, b) => {
      const valA = (a as any)[sort.value.column]
      const valB = (b as any)[sort.value.column]
      if (sort.value.direction === 'asc') return valA > valB ? 1 : -1
      return valA < valB ? 1 : -1
    })
})
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 h-full flex flex-col gap-6">
    <PageHeader
      title="State Agencies"
      subtitle="Browse expenditures by Texas state agencies and universities."
      :breadcrumbs="[{ label: 'Home', to: '/' }, { label: 'Agencies' }]"
    />

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
        { key: 'search', label: 'Search Agencies', type: 'input' },
      ]"
    />

    <UCard>
      <div v-if="pending" class="flex justify-center p-12">
        <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-primary-500" />
      </div>

      <DataTableCard
        v-else
        :columns="[
          { key: 'agency_id', label: 'ID', sortable: true },
          { key: 'agency_name', label: 'Agency Name', sortable: true },
          { key: 'amount', label: 'Total Spend', sortable: true },
        ]"
        :rows="displayRows"
        :meta="data?.meta"
        @page="page = $event"
        @sort="sort = $event"
      >
        <template #agency_name-data="{ row }">
          <ULink
            :to="`/agencies/${row.agency_id}`"
            class="text-primary-600 dark:text-primary-400 font-medium hover:underline"
          >
            {{ row.agency_name }}
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
