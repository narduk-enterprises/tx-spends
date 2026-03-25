<script setup lang="ts">
import {
  cleanQueryObject,
  DEFAULT_PAGE_SIZE,
  FISCAL_YEAR_OPTIONS,
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

const { data, status } = await useFetch('/api/v1/objects', {
  query: requestQuery,
})

const objects = computed(() => data.value?.data || [])
const meta = computed(() => data.value?.meta)
const paymentsBackfillActive = computed(() => Boolean(meta.value?.payments_backfill_active))
const tableDescription = computed(() =>
  paymentsBackfillActive.value
    ? 'Object codes remain searchable while the payment backfill runs. Amount totals will populate after the transaction feed commits.'
    : 'Use object detail pages to inspect totals and jump into filtered transaction views.',
)

const title = fiscalYear.value
  ? `Texas Comptroller Objects for FY ${fiscalYear.value}`
  : 'Texas Comptroller Objects'
const description =
  'Browse Comptroller object codes and titles tied to public Texas state payment rows.'

useSeo({
  title,
  description,
  ogImage: {
    title,
    description,
    icon: 'i-lucide-badge-dollar-sign',
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
      eyebrow="Objects"
      title="Comptroller Object Explorer"
      subtitle="Browse the fine-grained accounting objects attached to public Texas state payment rows."
      :breadcrumbs="[{ label: 'Home', to: '/' }, { label: 'Objects' }]"
    />

    <UAlert
      v-if="paymentsBackfillActive"
      title="Object totals are temporarily syncing."
      description="Object codes remain available, but spend totals stay at zero until the transaction-level payment feed finishes loading."
      icon="i-lucide-database-zap"
      color="warning"
      variant="soft"
      class="rounded-[1.25rem]"
    />

    <FilterBar
      v-model="filters"
      :available-filters="[
        { key: 'fiscal_year', label: 'Fiscal year', type: 'select', options: FISCAL_YEAR_OPTIONS },
        {
          key: 'q',
          label: 'Search objects',
          type: 'input',
          placeholder: '7211 or professional services',
        },
      ]"
    />

    <DataTableCard
      title="Comptroller objects"
      :description="tableDescription"
      :columns="[
        { key: 'object_code', label: 'Code', sortable: true },
        { key: 'object_title', label: 'Title', sortable: true },
        { key: 'object_group', label: 'Group' },
        { key: 'amount', label: 'Amount', sortable: true },
      ]"
      :rows="objects"
      :meta="meta"
      :loading="status === 'pending'"
      @page="updatePage"
      @sort="updateSort"
    >
      <template #object_code-data="{ row }">
        <UBadge color="neutral" variant="soft">{{ row.object_code }}</UBadge>
      </template>
      <template #object_title-data="{ row }">
        <UButton
          :to="`/objects/${row.object_code}`"
          color="neutral"
          variant="link"
          class="px-0 font-semibold text-primary"
        >
          {{ row.object_title }}
        </UButton>
      </template>
      <template #object_group-data="{ row }">
        <span class="text-sm text-muted">{{ row.object_group || 'Unlisted' }}</span>
      </template>
      <template #amount-data="{ row }">
        <div class="space-y-1 text-right">
          <p class="font-semibold text-default">
            {{ paymentsBackfillActive ? 'Syncing' : formatUsd(row.amount) }}
          </p>
          <p class="text-xs text-muted">
            {{ paymentsBackfillActive ? 'Amount totals pending' : formatUsdCompact(row.amount) }}
          </p>
        </div>
      </template>
    </DataTableCard>
  </UContainer>
</template>
