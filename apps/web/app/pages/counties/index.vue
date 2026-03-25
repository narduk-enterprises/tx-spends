<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSeoMeta, useAsyncData, useRoute, useRouter } from '#imports'

useSeoMeta({
  title: 'Texas County Spending - Texas State Spending Explorer',
  description:
    'Explore Texas state expenditures broken down by county destinations based on Comptroller county expenditure reports.',
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
  `counties-${page.value}-${sort.value.column}-${sort.value.direction}-${filters.value.fiscal_year}-${filters.value.search}`,
  () => {
    return Promise.resolve({
      data: [
        { county_id: '453', county_name: 'Travis', amount: 8000000000.0 },
        { county_id: '113', county_name: 'Dallas', amount: 4000000000.0 },
        { county_id: '201', county_name: 'Harris', amount: 3500000000.0 },
        { county_id: '029', county_name: 'Bexar', amount: 2500000000.0 },
        { county_id: '439', county_name: 'Tarrant', amount: 2000000000.0 },
      ],
      meta: {
        limit: 50,
        offset: (page.value - 1) * 50,
        total: 254,
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
        return row.county_name.toLowerCase().includes(filters.value.search.toLowerCase())
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
      title="State Spending by County"
      subtitle="Explore how state expenditures are distributed geographically."
      :breadcrumbs="[{ label: 'Home', to: '/' }, { label: 'Counties' }]"
    />

    <DisclaimerStrip variant="county" />

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
        { key: 'search', label: 'Search County Name', type: 'input' },
      ]"
    />

    <div v-if="pending" class="flex justify-center p-12">
      <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-primary-500" />
    </div>

    <template v-else>
      <CountyMapCard
        class="mb-4"
        :county-metrics="data?.data || []"
        :fy="filters.fiscal_year"
        @select-county="router.push(`/counties/${$event}`)"
      />

      <UCard>
        <DataTableCard
          :columns="[
            { key: 'county_name', label: 'County Name', sortable: true },
            { key: 'county_id', label: 'FIPS Code', sortable: true },
            { key: 'amount', label: 'Total Spend', sortable: true },
          ]"
          :rows="displayRows"
          :meta="data?.meta"
          @page="page = $event"
          @sort="sort = $event"
        >
          <template #county_name-data="{ row }">
            <ULink
              :to="`/counties/${row.county_id}`"
              class="text-primary-600 dark:text-primary-400 font-medium hover:underline"
            >
              {{ row.county_name }} County
            </ULink>
          </template>
          <template #county_id-data="{ row }">
            <UBadge color="neutral" variant="subtle">48{{ row.county_id.padStart(3, '0') }}</UBadge>
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
    </template>
  </div>
</template>
