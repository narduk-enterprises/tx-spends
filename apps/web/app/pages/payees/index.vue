<script setup lang="ts">
import {
  buildFetchKey,
  cleanQueryObject,
  DEFAULT_PAGE_SIZE,
  FISCAL_YEAR_OPTIONS,
  formatCount,
  formatDurationShort,
  formatFiscalYearCoverage,
  formatUsd,
  formatUsdCompact,
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
const matchedVendorOnly = computed(() => getBooleanQueryValue(route.query.matchedVendorOnly))
const sort = computed(() => getStringQueryValue(route.query.sort) || 'amount')
const order = computed(() => (getStringQueryValue(route.query.order) === 'asc' ? 'asc' : 'desc'))

const requestQuery = computed(() =>
  cleanQueryObject({
    fiscal_year: fiscalYear.value,
    q: searchQuery.value,
    matched_vendor_only: matchedVendorOnly.value ? 'true' : undefined,
    limit: DEFAULT_PAGE_SIZE,
    offset: pageToOffset(currentPage.value, DEFAULT_PAGE_SIZE),
    sort: sort.value,
    order: order.value,
  }),
)

const requestKey = computed(() => buildFetchKey('payees-list', requestQuery.value))

const { data, status } = await useFetch('/api/v1/payees', {
  key: requestKey,
  query: requestQuery,
})

const payees = computed(() => data.value?.data || [])
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
const emptyTitle = computed(() =>
  paymentsBackfillActive.value ? 'Payment backfill in progress' : 'No payees match these filters',
)
const emptyDescription = computed(() =>
  paymentsBackfillActive.value
    ? 'Payee rankings will populate once the transaction-level payment feed finishes loading.'
    : 'Try clearing the vendor-match toggle or broadening the search.',
)
const tableDescription = computed(() =>
  paymentsBackfillActive.value
    ? 'Payee rankings and vendor matches will appear here after the transaction-level payment feed finishes loading.'
    : 'Payee pages show agency relationships, categories, trend lines, and optional procurement enrichment.',
)

const title = computed(() =>
  fiscalYear.value
    ? `Texas Payees and Vendors for FY ${fiscalYear.value}`
    : 'Texas Payees and Vendors',
)
const description = computed(
  () =>
    'Browse public Texas state payees and vendors, including optional procurement enrichment when matching succeeds.',
)

useSeo({
  title,
  description,
  ogImage: {
    title,
    description,
    icon: 'i-lucide-briefcase-business',
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
    matched_vendor_only: matchedVendorOnly.value,
  }),
  set: (value: {
    fiscal_year: string | null
    q: string | null
    matched_vendor_only: boolean | null
  }) => {
    router.replace({
      query: cleanQueryObject({
        ...route.query,
        page: undefined,
        fy:
          value.fiscal_year && value.fiscal_year !== 'all' ? String(value.fiscal_year) : undefined,
        q: value.q || undefined,
        matchedVendorOnly: value.matched_vendor_only ? 'true' : undefined,
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
      eyebrow="Payees"
      title="Payee Explorer"
      subtitle="Search public state recipients and view vendor enrichment where public matching succeeds."
      :breadcrumbs="[{ label: 'Home', to: '/' }, { label: 'Payees' }]"
      badge="Public collection"
    />

    <DisclaimerStrip variant="payee" />

    <UAlert
      v-if="paymentsBackfillActive"
      title="Payee rankings are temporarily syncing."
      :description="
        [
          'The transaction-level payment feed is still loading, so payee totals and vendor-match rankings are temporarily unavailable.',
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
        {
          key: 'q',
          label: 'Search payees',
          type: 'input',
          placeholder: 'Hospital, district, vendor…',
        },
        { key: 'matched_vendor_only', label: 'Matched vendor only', type: 'boolean' },
      ]"
    />

    <DataTableCard
      title="Public payees"
      :description="tableDescription"
      :columns="[
        { key: 'payee_name', label: 'Payee', sortable: true },
        { key: 'agency_count', label: 'Agencies', sortable: true },
        { key: 'amount', label: 'Total received', sortable: true },
      ]"
      :rows="payees"
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
          title="Payee leaderboard pending"
          description="The payee collection and vendor-match overlays will populate after the live payment import commits."
        >
          <template #actions>
            <UButton to="/counties" color="primary" variant="soft" class="rounded-full">
              See county spend instead
            </UButton>
            <UButton to="/data-sources" color="neutral" variant="soft" class="rounded-full">
              Inspect source data
            </UButton>
          </template>
        </PaymentsBackfillPanel>
      </template>

      <template #payee_name-data="{ row }">
        <div class="flex items-center gap-2">
          <UButton
            :to="`/payees/${row.payee_id}`"
            :prefetch="false"
            color="neutral"
            variant="link"
            class="px-0 font-semibold text-primary"
          >
            {{ row.payee_name }}
          </UButton>
          <UBadge v-if="row.matched_vendor" color="primary" variant="soft">Matched vendor</UBadge>
          <UBadge v-if="row.is_confidential" color="warning" variant="soft">Confidential</UBadge>
        </div>
      </template>
      <template #agency_count-data="{ row }">
        <span class="text-sm text-default">{{ formatCount(row.agency_count) }}</span>
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
