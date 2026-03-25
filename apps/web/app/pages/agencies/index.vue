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
  getNumberQueryValue,
  getStringQueryValue,
  pageToOffset,
} from '~/utils/explorer'

const route = useRoute()
const router = useRouter()

const currentPage = computed(() => getNumberQueryValue(route.query.page) || 1)
const fiscalYear = computed(() => getNumberQueryValue(route.query.fy))
const searchQuery = computed(() => getStringQueryValue(route.query.q))
const sort = computed(() => getStringQueryValue(route.query.sort) || 'total_spend')
const order = computed(() => (getStringQueryValue(route.query.order) === 'asc' ? 'asc' : 'desc'))

const requestQuery = computed(() =>
  cleanQueryObject({
    fiscal_year: fiscalYear.value,
    q: searchQuery.value,
    limit: DEFAULT_PAGE_SIZE,
    offset: pageToOffset(currentPage.value, DEFAULT_PAGE_SIZE),
    sort: sort.value === 'total_spend' ? 'amount' : sort.value,
    order: order.value,
  }),
)

const requestKey = computed(() => buildFetchKey('agencies-list', requestQuery.value))

const { data, status } = await useFetch('/api/v1/agencies', {
  key: requestKey,
  query: requestQuery,
})

const agencies = computed(() => data.value?.data || [])
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
const rowsReturnedValue = computed(() =>
  paymentsBackfillActive.value ? 'Syncing' : formatCount(meta.value?.returned),
)
const totalAgenciesValue = computed(() =>
  paymentsBackfillActive.value ? 'Syncing' : formatCount(meta.value?.total),
)
const tableDescription = computed(() =>
  paymentsBackfillActive.value
    ? 'Agency rankings will appear here after the transaction-level payment feed finishes loading.'
    : 'Use the agency detail pages to inspect payees, objects, county distribution, and trends.',
)
const emptyTitle = computed(() =>
  paymentsBackfillActive.value ? 'Payment backfill in progress' : 'No agencies match these filters',
)
const emptyDescription = computed(() =>
  paymentsBackfillActive.value
    ? 'Agency rankings will populate once the transaction-level payment feed finishes loading.'
    : 'Try a broader search or remove the fiscal year filter.',
)

const title = computed(() =>
  fiscalYear.value
    ? `Texas Agencies by Spending for FY ${fiscalYear.value}`
    : 'Texas Agencies by Spending',
)
const description = computed(() =>
  fiscalYear.value
    ? `Browse Texas state agencies ranked by spending in fiscal year ${fiscalYear.value}.`
    : 'Browse Texas state agencies ranked by public spending totals.',
)

useSeo({
  title,
  description,
  ogImage: {
    title,
    description,
    icon: 'i-lucide-building-2',
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
      sort: value.column === 'total_spend' ? undefined : value.column,
      order: value.direction === 'desc' ? undefined : value.direction,
    }),
  })
}
</script>

<template>
  <UContainer class="space-y-8 py-8">
    <PageHeader
      eyebrow="Agencies"
      title="Agency Explorer"
      subtitle="Browse Texas state agencies and universities ranked by public spending."
      :breadcrumbs="[{ label: 'Home', to: '/' }, { label: 'Agencies' }]"
      badge="Collection page"
    >
      <template #actions>
        <div class="grid gap-3 sm:grid-cols-2">
          <KpiCard
            label="Rows returned"
            :value="rowsReturnedValue"
            :helper="
              paymentsBackfillActive
                ? 'Transaction-level agency rankings are still loading'
                : 'Agencies in this slice'
            "
            icon="i-lucide-rows-3"
          />
          <KpiCard
            label="Total agencies"
            :value="totalAgenciesValue"
            :helper="
              paymentsBackfillActive
                ? 'Agency totals will appear once payment rows are committed'
                : 'Across the active filters'
            "
            icon="i-lucide-building"
          />
        </div>
      </template>
    </PageHeader>

    <UAlert
      v-if="paymentsBackfillActive"
      title="Agency rankings are temporarily syncing."
      :description="
        [
          'The transaction-level payment feed is still loading, so agency totals and rankings are temporarily unavailable.',
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
          label: 'Search agencies',
          type: 'input',
          placeholder: 'Health, education, transportation…',
        },
      ]"
    />

    <DataTableCard
      title="Texas state agencies"
      :description="tableDescription"
      :columns="[
        { key: 'agency_name', label: 'Agency', sortable: true },
        { key: 'agency_code', label: 'Agency code', sortable: true },
        { key: 'total_spend', label: 'Total spend', sortable: true },
      ]"
      :rows="agencies"
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
          title="Agency leaderboard pending"
          description="The agency collection will populate after the live payment import commits. County-based agency breakdowns are already available from the county map."
        >
          <template #actions>
            <UButton to="/counties" color="primary" variant="soft" class="rounded-full">
              Open county map
            </UButton>
            <UButton to="/methodology" color="neutral" variant="soft" class="rounded-full">
              Read methodology
            </UButton>
          </template>
        </PaymentsBackfillPanel>
      </template>

      <template #agency_name-data="{ row }">
        <UButton
          :to="`/agencies/${row.agency_id}`"
          :prefetch="false"
          color="neutral"
          variant="link"
          class="px-0 font-semibold text-primary"
        >
          {{ row.agency_name }}
        </UButton>
      </template>

      <template #agency_code-data="{ row }">
        <UBadge color="neutral" variant="soft">
          {{ row.agency_code || 'Unlisted' }}
        </UBadge>
      </template>

      <template #total_spend-data="{ row }">
        <div class="space-y-1 text-right">
          <p class="font-semibold text-default">{{ formatUsd(row.total_spend) }}</p>
          <p class="text-xs text-muted">{{ formatUsdCompact(row.total_spend) }}</p>
        </div>
      </template>
    </DataTableCard>
  </UContainer>
</template>
