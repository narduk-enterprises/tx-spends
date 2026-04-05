<script setup lang="ts">
import {
  buildFetchKey,
  cleanQueryObject,
  FISCAL_YEAR_OPTIONS,
  formatCount,
  formatUsd,
  formatUsdCompact,
  getBooleanQueryValue,
  getNumberQueryValue,
} from '~/utils/explorer'

const route = useRoute('/payees/[payeeId]')
const router = useRouter()

const payeeId = computed(() => String(route.params.payeeId))
const fiscalYear = computed(() => getNumberQueryValue(route.query.fy))
const includeConfidential = computed(() => getBooleanQueryValue(route.query.includeConfidential))
const activeTab = ref('overview')

type PayeeCategoryApiRow = {
  category_code: string
  category_title?: string | null
  amount: number | string | null
}

const requestQuery = computed(() =>
  cleanQueryObject({
    fiscal_year: fiscalYear.value,
    include_confidential: includeConfidential.value ? 'true' : undefined,
  }),
)

const detailKey = computed(() => buildFetchKey(`payee-detail:${payeeId.value}`, requestQuery.value))
const agenciesKey = computed(() =>
  buildFetchKey(`payee-agencies:${payeeId.value}`, requestQuery.value),
)
const categoriesKey = computed(() =>
  buildFetchKey(`payee-categories:${payeeId.value}`, requestQuery.value),
)
const beveragesKey = computed(() => buildFetchKey(`payee-beverages:${payeeId.value}`, requestQuery.value))
const trendsKey = computed(() => buildFetchKey(`payee-trends:${payeeId.value}`, requestQuery.value))

const [detailState, agenciesState, trendsState] = await Promise.all([
  useLazyFetch(() => `/api/v1/payees/${payeeId.value}`, {
    key: detailKey,
    query: requestQuery,
  }),
  useLazyFetch(() => `/api/v1/payees/${payeeId.value}/agencies`, {
    key: agenciesKey,
    query: requestQuery,
  }),
  useLazyFetch(() => `/api/v1/payees/${payeeId.value}/trends`, {
    key: trendsKey,
    query: requestQuery,
  }),
])
const { data: detail, status } = detailState
const { data: agencies, status: agenciesStatus } = agenciesState
const { data: trends, status: trendsStatus } = trendsState
const {
  data: categories,
  status: categoriesStatus,
  execute: fetchCategories,
} = useLazyFetch(() => `/api/v1/payees/${payeeId.value}/categories`, {
  key: categoriesKey,
  query: requestQuery,
  immediate: false,
  server: false,
  default: () => ({ data: [] }),
})

const {
  data: beverages,
  status: beveragesStatus,
  execute: fetchBeverages,
} = useLazyFetch(() => `/api/v1/payees/${payeeId.value}/beverage-sales`, {
  key: beveragesKey,
  query: requestQuery,
  immediate: false,
  server: false,
  default: () => ({ data: [] }),
})

watch(
  [activeTab, categoriesKey, beveragesKey],
  ([tab]) => {
    if (tab === 'categories') void fetchCategories()
    if (tab === 'beverages') void fetchBeverages()
  },
  { immediate: true },
)

/** Keeps header + shell visible while fiscal/confidential filters refetch (avoids full-page spinner). */
const displayPayee = shallowRef<NonNullable<(typeof detail)['value']>['data'] | null>(null)

watch(
  payeeId,
  () => {
    displayPayee.value = null
  },
  { flush: 'sync' },
)

watch(
  () => detail.value?.data,
  (d) => {
    if (d) {
      displayPayee.value = d
    }
  },
  { immediate: true },
)

const initialLoading = computed(() => !displayPayee.value && status.value === 'pending')

const metricsRefreshing = computed(
  () =>
    Boolean(displayPayee.value) &&
    (status.value === 'pending' ||
      agenciesStatus.value === 'pending' ||
      trendsStatus.value === 'pending'),
)

const payeeMetrics = computed(() => {
  if (metricsRefreshing.value) {
    return null
  }
  return detail.value?.data ?? displayPayee.value
})

const payeeCategoryRows = computed(() =>
  ((categories.value?.data || []) as PayeeCategoryApiRow[]).map((category) => ({
    category_code: category.category_code,
    category_title: category.category_title || 'Uncategorized',
    amount: Number(category.amount || 0),
  })),
)

const title = computed(() =>
  displayPayee.value
    ? `${displayPayee.value.payee_name} Payments from Texas Agencies`
    : 'Payee Detail | Texas State Spending Explorer',
)
const description = computed(() =>
  displayPayee.value
    ? `See how much ${displayPayee.value.payee_name} received from Texas agencies, plus agency relationships, category mix, and trend data.`
    : 'See how much a payee received from Texas agencies, plus category and trend data.',
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
  name: title,
  description,
  type: 'ItemPage',
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

const tabs = [
  { label: 'Overview', key: 'overview', icon: 'i-lucide-layout-dashboard' },
  { label: 'Agencies', key: 'agencies', icon: 'i-lucide-building-2' },
  { label: 'Categories', key: 'categories', icon: 'i-lucide-chart-pie' },
  { label: 'Beverages', key: 'beverages', icon: 'i-lucide-martini' },
  { label: 'Trends', key: 'trends', icon: 'i-lucide-chart-line' },
]

const enrichment = computed(() => {
  const p = displayPayee.value
  if (!p?.vendor_id) {
    return null
  }

  return {
    vendor_name: p.vendor_name,
    hub_status: p.hub_status,
    small_business_flag: p.small_business_flag,
    sdv_flag: p.sdv_flag,
    city: p.city,
    county: p.county,
    state: p.state,
    zip: p.zip,
    is_manual_override: p.is_manual_override,
    review_status: p.review_status,
  }
})

const matchMethodLabel = computed(() => {
  const p = displayPayee.value
  const method = p?.match_method

  if (method === 'exact_normalized') return 'Exact normalized name match'
  if (method === 'trigram_similarity') return 'Approximate name match'

  // For unknown methods, humanize the raw string when a vendor match exists
  if (p?.vendor_id && typeof method === 'string' && method.length > 0) {
    return method
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
  }

  return null
})
</script>

<template>
  <UContainer class="space-y-8 py-8">
    <div v-if="initialLoading" class="flex min-h-64 items-center justify-center">
      <UIcon name="i-lucide-loader-circle" class="size-10 animate-spin text-primary" />
    </div>

    <template v-else-if="displayPayee">
      <PageHeader
        eyebrow="Payee detail"
        :title="displayPayee.payee_name"
        :subtitle="
          displayPayee.is_confidential
            ? 'This payee is marked confidential in the public dataset.'
            : 'Public recipient profile from the Texas state payment feed.'
        "
        :breadcrumbs="[
          { label: 'Home', to: '/' },
          { label: 'Payees', to: '/payees' },
          { label: displayPayee.payee_name },
        ]"
        :badge="fiscalYear ? `FY ${fiscalYear}` : 'All fiscal years'"
      >
        <template #actions>
          <div class="flex flex-wrap gap-3">
            <UButton
              :to="`/analysis?mode=relationships&dataset=payments&subject=payee&payee_id=${displayPayee.payee_id}${fiscalYear ? `&fy=${fiscalYear}` : ''}${includeConfidential ? '&includeConfidential=true' : ''}`"
              color="neutral"
              variant="outline"
              icon="i-lucide-chart-column-big"
              class="rounded-full"
            >
              Open analysis
            </UButton>
            <UButton
              :to="`/transactions?payee_id=${displayPayee.payee_id}${fiscalYear ? `&fy=${fiscalYear}` : ''}${includeConfidential ? '&includeConfidential=true' : ''}`"
              color="primary"
              variant="soft"
              icon="i-lucide-arrow-right"
              class="rounded-full"
            >
              View transactions
            </UButton>
          </div>
        </template>
      </PageHeader>

      <DisclaimerStrip variant="payee" />

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

      <VendorMatchBadgeRow
        v-if="enrichment"
        :enrichment="enrichment"
        :match-confidence="Number(displayPayee.match_confidence || 0)"
        :match-method="displayPayee.match_method"
      />

      <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          :loading="metricsRefreshing"
          label="Total received"
          :value="formatUsdCompact(payeeMetrics?.total_received ?? 0)"
          :helper="formatUsd(payeeMetrics?.total_received ?? 0)"
          icon="i-lucide-wallet-cards"
        />
        <KpiCard
          :loading="metricsRefreshing"
          label="Agencies paying"
          :value="formatCount(payeeMetrics?.agency_count ?? 0)"
          helper="Distinct agency relationships"
          icon="i-lucide-building-2"
        />
        <KpiCard
          :loading="metricsRefreshing"
          label="Largest payer"
          :value="payeeMetrics?.largest_agency?.agency_name || 'Unlisted'"
          :helper="
            payeeMetrics?.largest_agency
              ? formatUsd(payeeMetrics.largest_agency.amount)
              : 'No agency summary available'
          "
          icon="i-lucide-hand-coins"
        />
        <KpiCard
          :loading="metricsRefreshing"
          label="Vendor match"
          :value="payeeMetrics?.vendor_id ? 'Available' : 'Not matched'"
          :helper="matchMethodLabel || 'No procurement enrichment attached'"
          icon="i-lucide-scan-search"
        />
      </section>

      <EntityTabs v-model="activeTab" :tabs="tabs" persist-key="payee-detail-tab" />

      <section
        v-if="activeTab === 'overview'"
        class="grid items-start gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(20rem,1fr)]"
      >
        <TrendChartCard
          class="h-auto self-start"
          title="Payee trend"
          description="Annual total receipts for this payee."
          :loading="metricsRefreshing"
          :series="metricsRefreshing ? [] : trends?.data || []"
          x-key="fiscal_year"
          y-key="amount"
          :value-formatter="formatUsdCompact"
        />
        <RankedBarCard
          title="Agencies paying this payee"
          description="Which agencies account for the largest share of payments."
          :loading="metricsRefreshing"
          :items="metricsRefreshing ? [] : (agencies?.data || []).slice(0, 10)"
          label-key="agency_name"
          value-key="amount"
          :value-formatter="formatUsdCompact"
        />
      </section>

      <DataTableCard
        v-else-if="activeTab === 'agencies'"
        title="Agency relationships"
        description="All agencies that paid this recipient."
        :columns="[
          { key: 'agency_name', label: 'Agency' },
          { key: 'amount', label: 'Amount' },
        ]"
        :loading="metricsRefreshing"
        :rows="metricsRefreshing ? [] : agencies?.data || []"
      >
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
        <template #amount-data="{ row }">
          <span class="font-semibold text-default">{{ formatUsd(row.amount) }}</span>
        </template>
      </DataTableCard>

      <DataTableCard
        v-else-if="activeTab === 'categories'"
        title="Category mix"
        description="Broad payment categories associated with this payee."
        :columns="[
          { key: 'category_title', label: 'Category' },
          { key: 'amount', label: 'Amount' },
        ]"
        :loading="categoriesStatus === 'pending'"
        :rows="payeeCategoryRows"
      >
        <template #category_title-data="{ row }">
          <UButton
            :to="`/categories/${row.category_code}`"
            :prefetch="false"
            color="neutral"
            variant="link"
            class="px-0 font-semibold text-primary"
          >
            {{ row.category_title || 'Uncategorized' }}
          </UButton>
        </template>
        <template #amount-data="{ row }">
          <span class="font-semibold text-default">{{ formatUsd(row.amount) }}</span>
        </template>
      </DataTableCard>

      <DataTableCard
        v-else-if="activeTab === 'beverages'"
        title="Beverage Sales"
        description="Gross commercial mixed beverage sales generated by this vendor's linked entity, reported to the state."
        :columns="[
          { key: 'location_name', label: 'Location' },
          { key: 'permit_number', label: 'TABC Permit' },
          { key: 'total_sales', label: 'Total Receipts' },
          { key: 'total_taxable', label: 'Taxable Receipts' },
          { key: 'obligation_end_date', label: 'Obligation Date' }
        ]"
        :loading="beveragesStatus === 'pending'"
        :rows="beverages?.data || []"
        empty-title="No commercial linkage"
        empty-description="This state payee does not hold matching taxpayer alcohol permits in the Socrata DB."
      >
        <template #location_name-data="{ row }">
          <div class="flex flex-col items-start">
            <span class="font-semibold text-primary">{{ row.location_name || 'Unknown location' }}</span>
            <span v-if="row.location_city" class="text-xs text-muted">
              {{ row.location_city }}
            </span>
          </div>
        </template>
        <template #permit_number-data="{ row }">
          <UBadge color="neutral" variant="soft">{{ row.permit_number || 'Unknown' }}</UBadge>
        </template>
        <template #total_sales-data="{ row }">
          <span class="font-semibold text-default">{{ formatUsd(row.total_sales, 2) }}</span>
        </template>
        <template #total_taxable-data="{ row }">
          <span class="font-semibold text-default">{{ formatUsd(row.total_taxable, 2) }}</span>
        </template>
        <template #obligation_end_date-data="{ row }">
          <span class="text-sm text-default">{{ row.obligation_end_date ? new Date(row.obligation_end_date).toLocaleDateString() : 'Unknown' }}</span>
        </template>
      </DataTableCard>


      <TrendChartCard
        v-else
        title="Trend view"
        description="Annual payment totals for this payee."
        :loading="metricsRefreshing"
        :series="metricsRefreshing ? [] : trends?.data || []"
        x-key="fiscal_year"
        y-key="amount"
        :value-formatter="formatUsdCompact"
      />
    </template>

    <EmptyState
      v-else
      title="Payee not found"
      description="The requested payee could not be found in the public dataset."
      icon="i-lucide-search-x"
    >
      <UButton to="/payees" color="primary" variant="soft" class="rounded-full">
        Back to payees
      </UButton>
    </EmptyState>
  </UContainer>
</template>
