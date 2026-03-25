<script setup lang="ts">
import {
  buildFetchKey,
  cleanQueryObject,
  FISCAL_YEAR_OPTIONS,
  formatCount,
  formatUsd,
  formatUsdCompact,
  getNumberQueryValue,
} from '~/utils/explorer'

const route = useRoute()
const router = useRouter()

const payeeId = computed(() => String(route.params.id))
const fiscalYear = computed(() => getNumberQueryValue(route.query.fy))
const activeTab = ref('overview')

type PayeeCategoryApiRow = {
  category_code: string
  category_title?: string | null
  amount: number | string | null
}

const requestQuery = computed(() =>
  cleanQueryObject({
    fiscal_year: fiscalYear.value,
  }),
)

const detailKey = computed(() => buildFetchKey(`payee-detail:${payeeId.value}`, requestQuery.value))
const agenciesKey = computed(() =>
  buildFetchKey(`payee-agencies:${payeeId.value}`, requestQuery.value),
)
const categoriesKey = computed(() =>
  buildFetchKey(`payee-categories:${payeeId.value}`, requestQuery.value),
)
const trendsKey = computed(() => buildFetchKey(`payee-trends:${payeeId.value}`, requestQuery.value))

const [detailState, agenciesState, trendsState] = await Promise.all([
  useFetch(() => `/api/v1/payees/${payeeId.value}`, {
    key: detailKey,
    query: requestQuery,
  }),
  useFetch(() => `/api/v1/payees/${payeeId.value}/agencies`, {
    key: agenciesKey,
    query: requestQuery,
  }),
  useFetch(() => `/api/v1/payees/${payeeId.value}/trends`, {
    key: trendsKey,
    query: requestQuery,
  }),
])
const { data: detail, status } = detailState
const { data: agencies } = agenciesState
const { data: trends } = trendsState
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

watch(
  [activeTab, categoriesKey],
  ([tab]) => {
    if (tab === 'categories') {
      void fetchCategories()
    }
  },
  { immediate: true },
)

const payee = computed(() => detail.value?.data)
const payeeCategoryRows = computed(() =>
  ((categories.value?.data || []) as PayeeCategoryApiRow[]).map((category) => ({
    category_code: category.category_code,
    category_title: category.category_title || 'Uncategorized',
    amount: Number(category.amount || 0),
  })),
)

const title = computed(() =>
  payee.value
    ? `${payee.value.payee_name} Payments from Texas Agencies`
    : 'Payee Detail | Texas State Spending Explorer',
)
const description = computed(() =>
  payee.value
    ? `See how much ${payee.value.payee_name} received from Texas agencies, plus agency relationships, category mix, and trend data.`
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
  name: title.value,
  description: description.value,
  type: 'ItemPage',
})

const filters = computed({
  get: () => ({
    fiscal_year: fiscalYear.value ? String(fiscalYear.value) : null,
  }),
  set: (value: { fiscal_year: string | null }) => {
    router.replace({
      query: cleanQueryObject({
        ...route.query,
        fy:
          value.fiscal_year && value.fiscal_year !== 'all' ? String(value.fiscal_year) : undefined,
      }),
    })
  },
})

const tabs = [
  { label: 'Overview', key: 'overview', icon: 'i-lucide-layout-dashboard' },
  { label: 'Agencies', key: 'agencies', icon: 'i-lucide-building-2' },
  { label: 'Categories', key: 'categories', icon: 'i-lucide-chart-pie' },
  { label: 'Trends', key: 'trends', icon: 'i-lucide-chart-line' },
]

const enrichment = computed(() => {
  if (!payee.value?.vendor_id) {
    return null
  }

  return {
    vendor_name: payee.value.vendor_name,
    hub_status: payee.value.hub_status,
    city: payee.value.city,
    state: payee.value.state,
    zip: payee.value.zip,
  }
})
</script>

<template>
  <UContainer class="space-y-8 py-8">
    <div v-if="status === 'pending'" class="flex min-h-64 items-center justify-center">
      <UIcon name="i-lucide-loader-circle" class="size-10 animate-spin text-primary" />
    </div>

    <template v-else-if="payee">
      <PageHeader
        eyebrow="Payee detail"
        :title="payee.payee_name"
        :subtitle="
          payee.is_confidential
            ? 'This payee is marked confidential in the public dataset.'
            : 'Public recipient profile from the Texas state payment feed.'
        "
        :breadcrumbs="[
          { label: 'Home', to: '/' },
          { label: 'Payees', to: '/payees' },
          { label: payee.payee_name },
        ]"
        :badge="fiscalYear ? `FY ${fiscalYear}` : 'All fiscal years'"
      >
        <template #actions>
          <UButton
            :to="`/transactions?payee_id=${payee.payee_id}${fiscalYear ? `&fy=${fiscalYear}` : ''}`"
            color="primary"
            variant="soft"
            icon="i-lucide-arrow-right"
            class="rounded-full"
          >
            View transactions
          </UButton>
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
        ]"
      />

      <VendorMatchBadgeRow
        v-if="enrichment"
        :enrichment="enrichment"
        :match-confidence="Number(payee.match_confidence || 0)"
      />

      <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total received"
          :value="formatUsdCompact(payee.total_received)"
          :helper="formatUsd(payee.total_received)"
          icon="i-lucide-wallet-cards"
        />
        <KpiCard
          label="Agencies paying"
          :value="formatCount(payee.agency_count)"
          helper="Distinct agency relationships"
          icon="i-lucide-building-2"
        />
        <KpiCard
          label="Largest payer"
          :value="payee.largest_agency?.agency_name || 'Unlisted'"
          :helper="
            payee.largest_agency
              ? formatUsd(payee.largest_agency.amount)
              : 'No agency summary available'
          "
          icon="i-lucide-hand-coins"
        />
        <KpiCard
          label="Vendor match"
          :value="payee.vendor_id ? 'Available' : 'Not matched'"
          :helper="payee.match_method || 'No procurement enrichment attached'"
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
          :series="trends?.data || []"
          x-key="fiscal_year"
          y-key="amount"
          :value-formatter="formatUsdCompact"
        />
        <RankedBarCard
          title="Agencies paying this payee"
          description="Which agencies account for the largest share of payments."
          :items="(agencies?.data || []).slice(0, 10)"
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
          { key: 'amount', label: 'Amount', sortable: true },
        ]"
        :rows="agencies?.data || []"
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
          { key: 'amount', label: 'Amount', sortable: true },
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

      <TrendChartCard
        v-else
        title="Trend view"
        description="Annual payment totals for this payee."
        :series="trends?.data || []"
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
