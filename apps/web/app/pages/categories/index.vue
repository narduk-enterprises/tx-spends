<script setup lang="ts">
import {
  buildFetchKey,
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

const requestKey = computed(() => buildFetchKey('categories-list', requestQuery.value))

const { data, status } = await useFetch('/api/v1/categories', {
  key: requestKey,
  query: requestQuery,
})

const categories = computed(() => data.value?.data || [])
const meta = computed(() => data.value?.meta)
const paymentsBackfillActive = computed(() => Boolean(meta.value?.payments_backfill_active))
const tableDescription = computed(() =>
  paymentsBackfillActive.value
    ? 'Category totals will appear here after the transaction-level payment feed finishes loading.'
    : 'These broad categories summarize what the public payment feed says Texas agencies are spending money on.',
)
const emptyTitle = computed(() =>
  paymentsBackfillActive.value
    ? 'Payment backfill in progress'
    : 'No categories match these filters',
)
const emptyDescription = computed(() =>
  paymentsBackfillActive.value
    ? 'Category rankings will populate once the transaction-level payment feed finishes loading.'
    : 'Try a broader search term or clear the fiscal year filter.',
)

const title = computed(() =>
  fiscalYear.value
    ? `Texas Spending Categories for FY ${fiscalYear.value}`
    : 'Texas Spending Categories',
)
const description = computed(
  () => 'Browse broad Texas state spending categories derived from the public payment feed.',
)

useSeo({
  title,
  description,
  ogImage: {
    title,
    description,
    icon: 'i-lucide-chart-pie',
  },
})

useWebPageSchema({
  name: title.value,
  description: description.value,
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
      eyebrow="Categories"
      title="Category Explorer"
      subtitle="Browse broad payment categories and drill into agencies, payees, and underlying objects."
      :breadcrumbs="[{ label: 'Home', to: '/' }, { label: 'Categories' }]"
    />

    <UAlert
      v-if="paymentsBackfillActive"
      title="Category rankings are temporarily syncing."
      description="The transaction-level payment feed is still loading, so broad spending categories are temporarily unavailable."
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
          label: 'Search categories',
          type: 'input',
          placeholder: 'Salaries, grants, supplies…',
        },
      ]"
    />

    <DataTableCard
      title="Payment categories"
      :description="tableDescription"
      :columns="[
        { key: 'category_code', label: 'Code', sortable: true },
        { key: 'category_title', label: 'Category', sortable: true },
        { key: 'amount', label: 'Amount', sortable: true },
      ]"
      :rows="categories"
      :meta="meta"
      :loading="status === 'pending'"
      :empty-title="emptyTitle"
      :empty-description="emptyDescription"
      @page="updatePage"
      @sort="updateSort"
    >
      <template #category_code-data="{ row }">
        <UBadge color="neutral" variant="soft">{{ row.category_code }}</UBadge>
      </template>
      <template #category_title-data="{ row }">
        <UButton
          :to="`/categories/${row.category_code}`"
          :prefetch="false"
          color="neutral"
          variant="link"
          class="px-0 font-semibold text-primary"
        >
          {{ row.category_title }}
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
