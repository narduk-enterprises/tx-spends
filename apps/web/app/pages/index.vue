<script setup lang="ts">
import {
  buildFetchKey,
  cleanQueryObject,
  FISCAL_YEAR_OPTIONS,
  formatCountyLabel,
  formatCount,
  formatDurationShort,
  formatFiscalYearCoverage,
  formatUsd,
  formatUsdCompact,
  getBooleanQueryValue,
  getNumberQueryValue,
} from '~/utils/explorer'

const route = useRoute()
const router = useRouter()

const fiscalYear = computed(() => getNumberQueryValue(route.query.fy))
const includeConfidential = computed(() => getBooleanQueryValue(route.query.includeConfidential))

const overviewQuery = computed(() =>
  cleanQueryObject({
    fiscal_year: fiscalYear.value,
    include_confidential: includeConfidential.value ? 'true' : undefined,
  }),
)

const overviewKey = computed(() => buildFetchKey('overview', overviewQuery.value))

const { data, status } = await useFetch('/api/v1/overview', {
  key: overviewKey,
  query: overviewQuery,
})

const overview = computed(() => data.value?.data)
const overviewMeta = computed(() => data.value?.meta)
const paymentsBackfillActive = computed(() => Boolean(overviewMeta.value?.payments_backfill_active))
const paymentsBackfill = computed(
  () =>
    overviewMeta.value?.payments_backfill as
      | {
          source_row_count: number
          source_file_count: number
          fiscal_years: number[]
          active_runtime_seconds: number | null
        }
      | undefined,
)

const pageTitle = computed(() =>
  fiscalYear.value
    ? `Texas State Spending Overview for FY ${fiscalYear.value}`
    : 'Texas State Spending Overview',
)
const pageDescription = computed(() =>
  fiscalYear.value
    ? `See Texas state spending totals, top agencies, payees, categories, and county distribution for fiscal year ${fiscalYear.value}.`
    : 'Explore Texas state spending totals, top agencies, payees, categories, recent transactions, and county-level distribution.',
)

const yoyMovers = computed(() => overview.value?.yoy_movers ?? null)

const headlineSpendDelta = computed(() => {
  const pct = yoyMovers.value?.total_change_pct
  if (pct == null) return undefined
  return {
    value: Math.abs(pct),
    direction: pct > 0 ? ('up' as const) : pct < 0 ? ('down' as const) : ('neutral' as const),
  }
})

const headlineSpendValue = computed(() =>
  overview.value
    ? overview.value.total_spend > 0
      ? overview.value.total_spend
      : overview.value.county_layer_total
    : 0,
)

const headlineSpendHelper = computed(() =>
  overview.value?.total_spend && overview.value.total_spend > 0
    ? 'Visible public payment rows'
    : 'Fallback to county annual layer while transaction facts are unavailable',
)

const hasPaymentFacts = computed(() =>
  Boolean(overview.value?.total_spend && overview.value.total_spend > 0),
)

const pageBadge = computed(() =>
  paymentsBackfillActive.value ? 'Payment backfill in progress' : 'Live public finance explorer',
)

const backfillAlertDescription = computed(() =>
  [
    fiscalYear.value
      ? `Transaction-level payment rows for FY ${fiscalYear.value} are still loading. Totals and county geography remain available through the annual county expenditure layer.`
      : 'Transaction-level payment rows are still loading. Totals and county geography remain available through the annual county expenditure layer in the meantime.',
    paymentsBackfill.value
      ? `${formatCount(paymentsBackfill.value.source_row_count)} exported rows across ${formatFiscalYearCoverage(paymentsBackfill.value.fiscal_years)}`
      : undefined,
    paymentsBackfill.value?.active_runtime_seconds
      ? `current ingest ${formatDurationShort(paymentsBackfill.value.active_runtime_seconds)}`
      : undefined,
  ]
    .filter(Boolean)
    .join(' '),
)

const agencyHeadlineHelper = computed(() =>
  hasPaymentFacts.value
    ? 'Distinct paying agencies'
    : 'Agencies represented in the county-layer fallback',
)

const payeeHeadlineValue = computed(() =>
  hasPaymentFacts.value ? formatCount(overview.value?.payee_count) : 'Syncing',
)

const payeeHeadlineHelper = computed(() =>
  hasPaymentFacts.value
    ? 'Distinct public payees'
    : 'Transaction-level payment facts are not loaded yet',
)

const trendDescription = computed(() =>
  hasPaymentFacts.value
    ? 'Texas state payment totals across available fiscal years.'
    : 'Annual county-layer totals while the transaction-level payment feed is still loading.',
)

const topAgenciesDescription = computed(() =>
  hasPaymentFacts.value
    ? 'Largest agencies by total state payments.'
    : 'Largest agencies by county-layer annual expenditure totals while payment facts are pending.',
)

const topCategoriesDescription = computed(() =>
  hasPaymentFacts.value
    ? 'Broad spending categories derived from the public state payment feed.'
    : 'Broad spending categories from the county distribution layer while payment facts are pending.',
)

const topPayeesDescription = computed(() =>
  hasPaymentFacts.value
    ? 'Largest public recipients of state payments.'
    : 'Top payees will appear here after the transaction-level payment feed is loaded.',
)

useSeo({
  title: pageTitle,
  description: pageDescription,
  ogImage: {
    title: pageTitle,
    description: pageDescription,
    icon: 'i-lucide-landmark',
  },
})

useWebPageSchema({
  name: pageTitle,
  description: pageDescription,
})

const filters = computed({
  get: () => ({
    fiscal_year: fiscalYear.value ? String(fiscalYear.value) : null,
    include_confidential: includeConfidential.value,
  }),
  set: (value: { fiscal_year: string | null; include_confidential: boolean | null }) => {
    router.replace({
      query: cleanQueryObject({
        ...route.query,
        fy:
          value.fiscal_year && value.fiscal_year !== 'all' ? String(value.fiscal_year) : undefined,
        includeConfidential: value.include_confidential ? 'true' : undefined,
      }),
    })
  },
})
</script>

<template>
  <UContainer class="space-y-8 py-8">
    <PageHeader
      eyebrow="Texas state spending"
      :title="pageTitle"
      :subtitle="pageDescription"
      :badge="pageBadge"
    >
      <template #actions>
        <div class="w-full min-w-[18rem] max-w-md">
          <SearchAutocomplete />
        </div>
      </template>
    </PageHeader>

    <DisclaimerStrip variant="global" />

    <UAlert
      v-if="paymentsBackfillActive"
      title="Transaction-level payments are actively backfilling."
      :description="backfillAlertDescription"
      icon="i-lucide-database-zap"
      color="warning"
      variant="soft"
      class="rounded-[1.25rem]"
    />

    <FilterBar
      v-model="filters"
      :available-filters="[
        {
          key: 'fiscal_year',
          label: 'Fiscal year',
          type: 'select',
          options: FISCAL_YEAR_OPTIONS,
        },
        {
          key: 'include_confidential',
          label: 'Include confidential rows',
          type: 'boolean',
        },
      ]"
    />

    <div v-if="status === 'pending'" class="flex min-h-64 items-center justify-center">
      <UIcon name="i-lucide-loader-circle" class="size-10 animate-spin text-primary" />
    </div>

    <template v-else-if="overview">
      <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total state spend"
          :value="formatUsdCompact(headlineSpendValue)"
          :helper="headlineSpendHelper"
          :delta="headlineSpendDelta"
          icon="i-lucide-wallet"
        />
        <KpiCard
          label="Agencies"
          :value="formatCount(overview.agency_count)"
          :helper="agencyHeadlineHelper"
          icon="i-lucide-building-2"
        />
        <KpiCard
          label="Payees"
          :value="payeeHeadlineValue"
          :helper="payeeHeadlineHelper"
          icon="i-lucide-briefcase-business"
        />
        <KpiCard
          label="Top county"
          :value="
            overview.top_county?.county_name
              ? formatCountyLabel(overview.top_county.county_name)
              : 'No county data'
          "
          :helper="
            overview.top_county ? formatUsd(overview.top_county.amount) : 'No county layer data'
          "
          icon="i-lucide-map-pinned"
        />
      </section>

      <section class="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(20rem,1fr)]">
        <TrendChartCard
          title="Spending over time"
          :description="trendDescription"
          :series="overview.timeline || []"
          x-key="fiscal_year"
          y-key="amount"
          :value-formatter="formatUsdCompact"
        />

        <RankedBarCard
          title="Top agencies"
          :description="topAgenciesDescription"
          :items="overview.top_agencies || []"
          label-key="agency_name"
          value-key="amount"
          :value-formatter="formatUsdCompact"
        />
      </section>

      <section v-if="yoyMovers">
        <InsightMoversCard :movers="yoyMovers" />
      </section>

      <section class="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(20rem,1fr)]">
        <CountyMapCard
          :county-metrics="overview.top_counties || []"
          :fy="fiscalYear || 'All years'"
          @select-county="router.push(`/counties/${$event}`)"
        />

        <RankedBarCard
          title="Top categories"
          :description="topCategoriesDescription"
          :items="overview.top_categories || []"
          label-key="category_title"
          value-key="amount"
          :value-formatter="formatUsdCompact"
        />
      </section>

      <section class="grid gap-6 xl:grid-cols-2">
        <RankedBarCard
          v-if="hasPaymentFacts"
          title="Top payees"
          :description="topPayeesDescription"
          :items="overview.top_payees || []"
          label-key="payee_name"
          value-key="amount"
          :value-formatter="formatUsdCompact"
          :empty-title="hasPaymentFacts ? 'No ranked data' : 'Payment feed pending'"
          :empty-description="
            hasPaymentFacts
              ? 'There are no rows available for this breakdown under the current filters.'
              : 'Top payees will appear here after the transaction-level payment feed is loaded.'
          "
        />

        <UCard v-else class="card-base overflow-hidden">
          <template #header>
            <div class="space-y-1">
              <p class="text-lg font-semibold text-default">Top payees</p>
              <p class="text-sm text-muted">
                The payee leaderboard unlocks after the transaction-level payment import commits.
              </p>
            </div>
          </template>

          <PaymentsBackfillPanel
            :source-row-count="paymentsBackfill?.source_row_count || 0"
            :source-file-count="paymentsBackfill?.source_file_count || 0"
            :fiscal-years="paymentsBackfill?.fiscal_years || []"
            :active-runtime-seconds="paymentsBackfill?.active_runtime_seconds || null"
            title="Texas payment exports are ready"
            description="All monthly exports have been captured from the Comptroller portal. The live payee leaderboard will populate when the current database ingest commits."
          >
            <template #actions>
              <UButton to="/counties" color="primary" variant="soft" class="rounded-full">
                Explore county distribution
              </UButton>
              <UButton to="/data-sources" color="neutral" variant="soft" class="rounded-full">
                Review data sources
              </UButton>
            </template>
          </PaymentsBackfillPanel>
        </UCard>

        <UCard class="card-base overflow-hidden">
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <div class="space-y-1">
                <p class="text-lg font-semibold text-default">What you can do next</p>
                <p class="text-sm text-muted">
                  Jump directly into the strongest entry points in the explorer.
                </p>
              </div>
            </div>
          </template>

          <div class="grid gap-3">
            <UButton
              to="/agencies"
              color="neutral"
              variant="soft"
              class="justify-between rounded-2xl px-4 py-4"
            >
              <span>Browse agencies</span>
              <UIcon name="i-lucide-arrow-right" class="size-4" />
            </UButton>
            <UButton
              to="/counties"
              color="neutral"
              variant="soft"
              class="justify-between rounded-2xl px-4 py-4"
            >
              <span>Explore county distribution</span>
              <UIcon name="i-lucide-arrow-right" class="size-4" />
            </UButton>
            <UButton
              to="/transactions"
              color="neutral"
              variant="soft"
              class="justify-between rounded-2xl px-4 py-4"
            >
              <span>Inspect raw payments</span>
              <UIcon name="i-lucide-arrow-right" class="size-4" />
            </UButton>
            <UButton
              to="/methodology"
              color="neutral"
              variant="soft"
              class="justify-between rounded-2xl px-4 py-4"
            >
              <span>Read the methodology</span>
              <UIcon name="i-lucide-arrow-right" class="size-4" />
            </UButton>
          </div>
        </UCard>
      </section>

      <DataTableCard
        title="Recent transactions"
        description="Latest public payment rows from the state payment feed."
        :columns="[
          { key: 'payment_date', label: 'Date', sortable: true },
          { key: 'agency_name', label: 'Agency' },
          { key: 'payee_name', label: 'Payee' },
          { key: 'object_code', label: 'Object' },
          { key: 'amount', label: 'Amount', sortable: true },
        ]"
        :rows="overview.recent_transactions || []"
        :empty-title="hasPaymentFacts ? 'No recent transactions' : 'Payment feed pending'"
        :empty-description="
          hasPaymentFacts
            ? 'There are no recent transaction rows for the current filters.'
            : 'Recent payment rows will appear after the transaction-level payment feed is loaded.'
        "
      >
        <template v-if="paymentsBackfillActive" #empty>
          <PaymentsBackfillPanel
            :source-row-count="paymentsBackfill?.source_row_count || 0"
            :source-file-count="paymentsBackfill?.source_file_count || 0"
            :fiscal-years="paymentsBackfill?.fiscal_years || []"
            :active-runtime-seconds="paymentsBackfill?.active_runtime_seconds || null"
            title="Transaction feed pending"
            description="The exported Texas payment rows are queued for ingest. Raw transactions will appear here after the current load commits."
          />
        </template>

        <template #agency_name-data="{ row }">
          <UButton
            :to="row.agency_id ? `/agencies/${row.agency_id}` : undefined"
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
          <UBadge color="neutral" variant="soft">
            {{ row.object_code || 'Unmapped' }}
          </UBadge>
        </template>

        <template #amount-data="{ row }">
          <span class="font-semibold text-default">{{ formatUsd(row.amount, 2) }}</span>
        </template>
      </DataTableCard>
    </template>

    <EmptyState
      v-else
      title="No overview data available"
      description="The explorer could not load public spending data for the current filters."
      icon="i-lucide-database-zap"
    >
      <UButton to="/data-sources" color="primary" variant="soft" class="rounded-full">
        Review data sources
      </UButton>
    </EmptyState>
  </UContainer>
</template>
