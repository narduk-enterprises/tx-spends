<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSeoMeta, useAsyncData, useRoute, useRouter } from '#imports'

useSeoMeta({
  title: 'Texas State Spending Categories',
  description:
    'Browse Texas state expenditures by comptroller object codes and spending categories.',
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
  `categories-${page.value}-${sort.value.column}-${sort.value.direction}-${filters.value.fiscal_year}-${filters.value.search}`,
  () => {
    return Promise.resolve({
      data: [
        { category_code: '7901', category_title: 'Medical Services', amount: 800000000.0 },
        { category_code: '7001', category_title: 'Salaries and Wages', amount: 400000000.0 },
        { category_code: '7256', category_title: 'Construction', amount: 350000000.0 },
      ],
      meta: {
        limit: 50,
        offset: (page.value - 1) * 50,
        total: 120,
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
        return (
          row.category_title.toLowerCase().includes(filters.value.search.toLowerCase()) ||
          row.category_code.includes(filters.value.search)
        )
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
      title="Spending Categories"
      subtitle="Browse expenditures grouped by Comptroller object codes."
      :breadcrumbs="[{ label: 'Home', to: '/' }, { label: 'Categories' }]"
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
        { key: 'search', label: 'Search by Code or Name', type: 'input' },
      ]"
    />

    <UCard>
      <div v-if="pending" class="flex justify-center p-12">
        <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-primary-500" />
      </div>

      <DataTableCard
        v-else
        :columns="[
          { key: 'category_code', label: 'Object Code', sortable: true },
          { key: 'category_title', label: 'Category Name', sortable: true },
          { key: 'amount', label: 'Total Spend', sortable: true },
        ]"
        :rows="displayRows"
        :meta="data?.meta"
        @page="page = $event"
        @sort="sort = $event"
      >
        <template #category_title-data="{ row }">
          <ULink
            :to="`/categories/${row.category_code}`"
            class="text-primary-600 dark:text-primary-400 font-medium hover:underline"
          >
            {{ row.category_title }}
          </ULink>
        </template>
        <template #category_code-data="{ row }">
          <UBadge color="neutral" variant="subtle">{{ row.category_code }}</UBadge>
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
