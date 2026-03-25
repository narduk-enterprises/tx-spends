<script setup lang="ts">
import {
  buildFiscalYearOptions,
  cleanQueryObject,
  DEFAULT_PAGE_SIZE,
  formatCountyLabel,
  formatUsd,
  formatUsdCompact,
  getNumberQueryValue,
  getStringQueryValue,
  pageToOffset,
} from '~/utils/explorer'

const route = useRoute()
const router = useRouter()

const currentPage = computed(() => getNumberQueryValue(route.query.page) || 1)
const fiscalYear = computed(() => getNumberQueryValue(route.query.fy))
const searchQuery = computed(() => getStringQueryValue(route.query.q))
const sort = computed(() => getStringQueryValue(route.query.sort) || 'amount')
const order = computed(() => (getStringQueryValue(route.query.order) === 'asc' ? 'asc' : 'desc'))

const requestQuery = computed(() =>
  cleanQueryObject({
    fiscal_year: fiscalYear.value,
    q: searchQuery.value,
    limit: DEFAULT_PAGE_SIZE,
    offset: pageToOffset(currentPage.value, DEFAULT_PAGE_SIZE),
    sort: sort.value,
    order: order.value,
  }),
)

const statewideMapQuery = computed(() =>
  cleanQueryObject({
    fiscal_year: fiscalYear.value,
    q: searchQuery.value,
    sort: 'amount',
    order: 'desc',
  }),
)

const countyListKey = computed(() => `counties:list:${JSON.stringify(requestQuery.value)}`)
const countyMapKey = computed(() => `counties:map:${JSON.stringify(statewideMapQuery.value)}`)

const { data, status } = await useFetch('/api/v1/counties', {
  key: countyListKey,
  query: requestQuery,
})
const { data: mapData } = await useFetch('/api/v1/county-map', {
  key: countyMapKey,
  query: statewideMapQuery,
})

const counties = computed(() => data.value?.data || [])
const countyMapMetrics = computed(() => mapData.value?.data || [])
const meta = computed(() => data.value?.meta)
const countyFiscalYearOptions = computed(() => {
  const availableFiscalYears = [...(meta.value?.available_fiscal_years || [])]

  if (
    fiscalYear.value &&
    Number.isFinite(fiscalYear.value) &&
    !availableFiscalYears.includes(fiscalYear.value)
  ) {
    availableFiscalYears.push(fiscalYear.value)
  }

  return buildFiscalYearOptions(availableFiscalYears)
})

const title = fiscalYear.value
  ? `Texas County Spending for FY ${fiscalYear.value}`
  : 'Texas County Spending'
const description =
  'Explore annual county-level state expenditure totals from the Texas Comptroller county reports.'

useSeo({
  title,
  description,
  ogImage: {
    title,
    description,
    icon: 'i-lucide-map-pinned',
  },
})

useWebPageSchema({
  name: title,
  description,
  type: 'CollectionPage',
})

const filters = computed({
  get: () => ({
    fiscal_year: fiscalYear.value ? String(fiscalYear.value) : null,
    q: searchQuery.value || null,
  }),
  set: (value: { fiscal_year: string | null; q: string | null }) => {
    router.replace({
      query: cleanQueryObject({
        ...route.query,
        page: undefined,
        fy:
          value.fiscal_year && value.fiscal_year !== 'all' ? String(value.fiscal_year) : undefined,
        q: value.q || undefined,
      }),
    })
  },
})

function updatePage(page: number) {
  router.replace({
    query: cleanQueryObject({
      ...route.query,
      page: page > 1 ? String(page) : undefined,
    }),
  })
}

function updateSort(value: { column: string; direction: 'asc' | 'desc' }) {
  router.replace({
    query: cleanQueryObject({
      ...route.query,
      sort: value.column === 'amount' ? undefined : value.column,
      order: value.direction === 'desc' ? undefined : value.direction,
    }),
  })
}
</script>

<template>
  <UContainer class="space-y-8 py-8">
    <PageHeader
      eyebrow="County layer"
      title="County Spending Map"
      subtitle="Annual county-level distribution of Texas state expenditures."
      :breadcrumbs="[{ label: 'Home', to: '/' }, { label: 'Counties' }]"
    />

    <DisclaimerStrip variant="county" />

    <FilterBar
      v-model="filters"
      :available-filters="[
        {
          key: 'fiscal_year',
          label: 'Fiscal year',
          type: 'select',
          options: countyFiscalYearOptions,
        },
        {
          key: 'q',
          label: 'Search counties',
          type: 'input',
          placeholder: 'Travis, Harris, Dallas…',
        },
      ]"
    />

    <CountyMapCard
      :county-metrics="countyMapMetrics"
      :fy="fiscalYear || 'All years'"
      @select-county="router.push(`/counties/${$event}`)"
    />

    <DataTableCard
      title="County ranking"
      description="Statewide county totals from the county expenditure reports."
      :columns="[
        { key: 'county_name', label: 'County', sortable: true },
        { key: 'amount', label: 'Amount', sortable: true },
      ]"
      :rows="counties"
      :meta="meta"
      :loading="status === 'pending'"
      @page="updatePage"
      @sort="updateSort"
    >
      <template #county_name-data="{ row }">
        <UButton
          :to="`/counties/${row.county_id}`"
          :prefetch="false"
          color="neutral"
          variant="link"
          class="px-0 font-semibold text-primary"
        >
          {{ formatCountyLabel(row.county_name) }}
        </UButton>
      </template>
      <template #amount-data="{ row }">
        <div class="space-y-1 text-right">
          <p class="font-semibold text-default">{{ formatUsd(row.amount) }}</p>
          <p class="text-xs text-muted">{{ formatUsdCompact(row.amount) }}</p>
        </div>
      </template>
    </DataTableCard>
  </UContainer>
</template>
