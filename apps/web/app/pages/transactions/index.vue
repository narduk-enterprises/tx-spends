<script setup lang="ts">
import {
  cleanQueryObject,
  DEFAULT_PAGE_SIZE,
  FISCAL_YEAR_OPTIONS,
  formatCount,
  formatDurationShort,
  formatFiscalYearCoverage,
  formatUsd,
  getBooleanQueryValue,
  getNumberQueryValue,
  getStringQueryValue,
  pageToOffset,
} from '~/utils/explorer'

const route = useRoute()
const router = useRouter()

const currentPage = computed(() => getNumberQueryValue(route.query.page) || 1)
const fiscalYear = computed(() => getNumberQueryValue(route.query.fy))
const searchQuery = computed(() => getStringQueryValue(route.query.q))
const categoryCode = computed(
  () => getStringQueryValue(route.query.category_code) || getStringQueryValue(route.query.category),
)
const objectCode = computed(() => getStringQueryValue(route.query.object))
const minAmount = computed(() => getNumberQueryValue(route.query.minAmount))
const maxAmount = computed(() => getNumberQueryValue(route.query.maxAmount))
const includeConfidential = computed(() => getBooleanQueryValue(route.query.includeConfidential))
const sort = computed(() => getStringQueryValue(route.query.sort) || 'payment_date')
const order = computed(() => (getStringQueryValue(route.query.order) === 'asc' ? 'asc' : 'desc'))

const requestQuery = computed(() =>
  cleanQueryObject({
    fiscal_year: fiscalYear.value,
    q: searchQuery.value,
    category_code: categoryCode.value,
    object_code: objectCode.value,
    min_amount: minAmount.value,
    max_amount: maxAmount.value,
    include_confidential: includeConfidential.value ? 'true' : undefined,
    limit: DEFAULT_PAGE_SIZE,
    offset: pageToOffset(currentPage.value, DEFAULT_PAGE_SIZE),
    sort: sort.value,
    order: order.value,
  }),
)

const { data, status } = await useFetch('/api/v1/transactions', {
  query: requestQuery,
})

const transactions = computed(() => data.value?.data || [])
const meta = computed(() => data.value?.meta)
const paymentsBackfillActive = computed(() => Boolean(meta.value?.payments_backfill_active))
const paymentsBackfill = computed(
  () =>
    meta.value?.payments_backfill as
      | {
          source_row_count: number
          source_file_count: number
          fiscal_years: number[]
          active_runtime_seconds: number | null
        }
      | undefined,
)
const tableDescription = computed(() =>
  paymentsBackfillActive.value
    ? 'Recent payment rows will appear here after the transaction-level payment feed finishes loading.'
    : 'Transaction rows include date, agency, payee, object code, and amount. County is deliberately unsupported at this grain.',
)
const emptyTitle = computed(() =>
  paymentsBackfillActive.value
    ? 'Payment backfill in progress'
    : 'No transactions match these filters',
)
const emptyDescription = computed(() =>
  paymentsBackfillActive.value
    ? 'Transaction rows will populate once the transaction-level payment feed finishes loading.'
    : 'Try broadening the filters or removing the amount range.',
)

useSeo({
  title: 'Texas State Transactions',
  description:
    'Browse public Texas state payment rows by date, agency, payee, object code, and amount.',
  robots: 'noindex,follow',
  ogImage: {
    title: 'Texas State Transactions',
    description:
      'Browse public Texas state payment rows by date, agency, payee, object code, and amount.',
    icon: 'i-lucide-receipt-text',
  },
})

useWebPageSchema({
  name: 'Texas State Transactions',
  description:
    'Browse public Texas state payment rows by date, agency, payee, object code, and amount.',
  type: 'CollectionPage',
})

const filters = computed({
  get: () => ({
    fiscal_year: fiscalYear.value ? String(fiscalYear.value) : null,
    q: searchQuery.value || null,
    category_code: categoryCode.value || null,
    object_code: objectCode.value || null,
    min_amount: minAmount.value ? String(minAmount.value) : null,
    max_amount: maxAmount.value ? String(maxAmount.value) : null,
    include_confidential: includeConfidential.value,
  }),
  set: (value: {
    fiscal_year: string | null
    q: string | null
    category_code: string | null
    object_code: string | null
    min_amount: string | null
    max_amount: string | null
    include_confidential: boolean | null
  }) => {
    router.replace({
      query: cleanQueryObject({
        ...route.query,
        page: undefined,
        fy:
          value.fiscal_year && value.fiscal_year !== 'all' ? String(value.fiscal_year) : undefined,
        q: value.q || undefined,
        category_code: value.category_code || undefined,
        object: value.object_code || undefined,
        minAmount: value.min_amount || undefined,
        maxAmount: value.max_amount || undefined,
        includeConfidential: value.include_confidential ? 'true' : undefined,
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
      eyebrow="Transactions"
      title="Transaction Explorer"
      subtitle="Browse raw state payment rows. County geography is intentionally unavailable on this page."
      :breadcrumbs="[{ label: 'Home', to: '/' }, { label: 'Transactions' }]"
      badge="Noindex collection"
    />

    <DisclaimerStrip variant="transactions" />

    <UAlert
      v-if="paymentsBackfillActive"
      title="Transaction rows are temporarily syncing."
      :description="
        [
          'The transaction-level payment feed is still loading, so raw payment rows are temporarily unavailable on this page.',
          paymentsBackfill
            ? `${formatCount(paymentsBackfill.source_row_count)} exported rows across ${formatFiscalYearCoverage(paymentsBackfill.fiscal_years)}`
            : undefined,
          paymentsBackfill?.active_runtime_seconds
            ? `current ingest ${formatDurationShort(paymentsBackfill.active_runtime_seconds)}`
            : undefined,
        ]
          .filter(Boolean)
          .join(' ')
      "
      icon="i-lucide-database-zap"
      color="warning"
      variant="soft"
      class="rounded-[1.25rem]"
    />

    <FilterBar
      v-model="filters"
      :available-filters="[
        { key: 'fiscal_year', label: 'Fiscal year', type: 'select', options: FISCAL_YEAR_OPTIONS },
        { key: 'q', label: 'Search', type: 'input', placeholder: 'Agency or payee' },
        {
          key: 'category_code',
          label: 'Category code',
          type: 'input',
          placeholder: 'public-assistance-payments',
        },
        { key: 'object_code', label: 'Object code', type: 'input', placeholder: '7211' },
        { key: 'min_amount', label: 'Min amount', type: 'input', placeholder: '10000' },
        { key: 'max_amount', label: 'Max amount', type: 'input', placeholder: '1000000' },
        { key: 'include_confidential', label: 'Include confidential rows', type: 'boolean' },
      ]"
    />

    <DataTableCard
      title="Public payment rows"
      :description="tableDescription"
      :columns="[
        { key: 'payment_date', label: 'Date', sortable: true },
        { key: 'agency_name', label: 'Agency', sortable: true },
        { key: 'payee_name', label: 'Payee', sortable: true },
        { key: 'object_code', label: 'Object' },
        { key: 'amount', label: 'Amount', sortable: true },
      ]"
      :rows="transactions"
      :meta="meta"
      :loading="status === 'pending'"
      :empty-title="emptyTitle"
      :empty-description="emptyDescription"
      @page="updatePage"
      @sort="updateSort"
    >
      <template v-if="paymentsBackfillActive" #empty>
        <PaymentsBackfillPanel
          :source-row-count="paymentsBackfill?.source_row_count || 0"
          :source-file-count="paymentsBackfill?.source_file_count || 0"
          :fiscal-years="paymentsBackfill?.fiscal_years || []"
          :active-runtime-seconds="paymentsBackfill?.active_runtime_seconds || null"
          title="Raw payments pending"
          description="The monthly payment exports are already captured from the Comptroller portal. Transaction rows will appear here after the current ingest commits."
        >
          <template #actions>
            <UButton to="/counties" color="primary" variant="soft" class="rounded-full">
              Browse county totals
            </UButton>
            <UButton to="/methodology" color="neutral" variant="soft" class="rounded-full">
              Why this page is empty
            </UButton>
          </template>
        </PaymentsBackfillPanel>
      </template>

      <template #payment_date-data="{ row }">
        <UBadge color="neutral" variant="soft">{{ row.payment_date }}</UBadge>
      </template>
      <template #agency_name-data="{ row }">
        <UButton
          :to="row.agency_id ? `/agencies/${row.agency_id}` : undefined"
          :prefetch="false"
          color="neutral"
          variant="link"
          class="px-0 font-semibold text-primary"
        >
          {{ row.agency_name || 'Unknown agency' }}
        </UButton>
      </template>
      <template #payee_name-data="{ row }">
        <span class="text-sm text-default">{{ row.payee_name || 'Unknown payee' }}</span>
      </template>
      <template #object_code-data="{ row }">
        <UButton
          :to="row.object_code ? `/objects/${row.object_code}` : undefined"
          :prefetch="false"
          color="neutral"
          variant="link"
          class="px-0 font-semibold text-primary"
        >
          {{ row.object_code || 'Unmapped' }}
        </UButton>
      </template>
      <template #amount-data="{ row }">
        <span class="font-semibold text-default">{{ formatUsd(row.amount, 2) }}</span>
      </template>
    </DataTableCard>
  </UContainer>
</template>
