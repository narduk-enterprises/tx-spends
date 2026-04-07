<script setup lang="ts">
import {
  buildFetchKey,
  cleanQueryObject,
  DEFAULT_PAGE_SIZE,
  FISCAL_YEAR_OPTIONS,
  formatUsd,
  getNumberQueryValue,
  getStringQueryValue,
  pageToOffset,
} from '~/utils/explorer'

const route = useRoute()
const router = useRouter()

const currentPage = computed(() => getNumberQueryValue(route.query.page) || 1)
const fiscalYear = computed(() => getNumberQueryValue(route.query.fy))
const searchQuery = computed(() => getStringQueryValue(route.query.q))
const sort = computed(() => getStringQueryValue(route.query.sort) || 'payment_date')
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

const requestKey = computed(() => buildFetchKey('it-contracts-list', requestQuery.value))

const { data, status } = await useLazyFetch('/api/v1/it-contracts', {
  key: requestKey,
  query: requestQuery,
})

const contracts = computed(() => data.value?.data || [])
const meta = computed(() => data.value?.meta)

useSeo({
  title: 'Texas State IT Contracts',
  description:
    'Explore granular line-item records of state IT procurement, staffing, and services.',
})

useWebPageSchema({
  name: 'Texas State IT Contracts',
  description:
    'Explore granular line-item records of state IT procurement, staffing, and services.',
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
      sort: value.column === 'payment_date' ? undefined : value.column,
      order: value.direction === 'desc' ? undefined : value.direction,
    }),
  })
}
</script>

<template>
  <UContainer class="space-y-8 py-8">
    <PageHeader
      eyebrow="IT Contracts"
      title="DIR Cooperative Contracts Explorer"
      subtitle="Examine granular IT procurement invoices matched to transparent vendor records."
      :breadcrumbs="[{ label: 'Home', to: '/' }, { label: 'IT Contracts' }]"
    />

    <DisclaimerStrip variant="transactions" />

    <FilterBar
      v-model="filters"
      :available-filters="[
        { key: 'fiscal_year', label: 'Fiscal year', type: 'select', options: FISCAL_YEAR_OPTIONS },
        { key: 'q', label: 'Search', type: 'input', placeholder: 'Vendor or Description' },
      ]"
    />

    <DataTableCard
      title="IT Procurement Invoices"
      description="Detailed invoices sourced from Socrata DIR mappings."
      :columns="[
        { key: 'payment_date', label: 'Date', sortable: true },
        { key: 'agency_name', label: 'Agency', sortable: true },
        { key: 'payee_name', label: 'Vendor', sortable: true },
        { key: 'contract', label: 'Contract Details' },
        { key: 'amount', label: 'Amount', sortable: true },
      ]"
      :rows="contracts"
      :meta="meta"
      :loading="status === 'pending'"
      empty-title="No contracts found"
      empty-description="Try adjusting your filters or search terms."
      :sort-column="sort"
      :sort-order="order"
      @page="updatePage"
      @sort="updateSort"
    >
      <template #payment_date-data="{ row }">
        <UBadge color="neutral" variant="soft">{{ row.shipped_date || 'Unknown' }}</UBadge>
      </template>
      <template #agency_name-data="{ row }">
        <UButton
          :to="row.agency_id ? `/agencies/${row.agency_id}` : undefined"
          :prefetch="false"
          color="neutral"
          variant="link"
          class="px-0 font-semibold text-primary"
        >
          {{ row.agency_name || 'Unmapped Agency' }}
        </UButton>
      </template>
      <template #payee_name-data="{ row }">
        <div class="flex flex-col items-start">
          <span class="font-semibold text-primary">{{ row.vendor_name || 'Unknown payee' }}</span>
          <span v-if="row.staffing_contractor_name" class="text-xs text-muted">
            Staff: {{ row.staffing_contractor_name }}
          </span>
        </div>
      </template>
      <template #contract-data="{ row }">
        <div class="flex flex-col items-start justify-center">
          <span class="font-semibold text-default leading-tight whitespace-normal">{{
            row.contract_number
          }}</span>
          <span class="mt-0.5 text-xs text-muted line-clamp-2">
            {{ row.rfo_description }}
          </span>
        </div>
      </template>
      <template #amount-data="{ row }">
        <span class="font-semibold text-default">{{ formatUsd(row.purchase_amount, 2) }}</span>
      </template>
    </DataTableCard>
  </UContainer>
</template>
