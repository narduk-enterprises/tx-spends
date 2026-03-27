<script setup lang="ts">
import { useCountyMap } from '~/composables/useCountyMap'
import {
  buildFetchKey,
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

const statewideMapQuery = computed(() => ({
  fiscal_year: fiscalYear.value,
  q: searchQuery.value,
}))

const countyListKey = computed(() => buildFetchKey('counties-list', requestQuery.value))
const countyMapKey = computed(() => buildFetchKey('counties-map', statewideMapQuery.value))

const [countiesState, countyMapState] = await Promise.all([
  useLazyFetch('/api/v1/counties', {
    key: countyListKey,
    query: requestQuery,
  }),
  useCountyMap(statewideMapQuery, {
    key: countyMapKey,
  }),
])
const { data, status } = countiesState
const { countyMetrics, countyMapStatus } = countyMapState

const counties = computed(() => data.value?.data || [])
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

const title = computed(() =>
  fiscalYear.value ? `Texas County Spending for FY ${fiscalYear.value}` : 'Texas County Spending',
)
const description = computed(
  () =>
    'Explore annual county-level state expenditure totals from the Texas Comptroller county reports.',
)

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
      :county-metrics="countyMetrics"
      :fiscal-year="fiscalYear || 'All years'"
      :loading="countyMapStatus === 'pending'"
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
      :sort-column="sort"
      :sort-order="order"
      @page="updatePage"
      @sort="updateSort"
    >
      <template #county_name-data="{ row }">
        <UButton
          :to="`/counties/${row.county_id}`"
          :prefetch="false"
          color="neutral"
          variant="link"
          class="h-auto min-h-0 px-0 py-0 text-sm leading-tight font-semibold text-primary"
        >
          {{ formatCountyLabel(row.county_name) }}
        </UButton>
      </template>
      <template #amount-data="{ row }">
        <p class="text-right text-sm tabular-nums whitespace-normal">
          <span class="font-semibold text-default">{{ formatUsd(row.amount) }}</span>
          <span class="text-xs text-muted"> · {{ formatUsdCompact(row.amount) }}</span>
        </p>
      </template>
    </DataTableCard>
  </UContainer>
</template>
