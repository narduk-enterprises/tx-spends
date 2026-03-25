<script setup lang="ts">
import {
  buildFiscalYearOptions,
  cleanQueryObject,
  formatCountyLabel,
  formatCount,
  formatUsd,
  formatUsdCompact,
  getNumberQueryValue,
} from '~/utils/explorer'

const route = useRoute()
const router = useRouter()

const countyId = computed(() => String(route.params.id))
const fiscalYear = computed(() => getNumberQueryValue(route.query.fy))
const activeTab = ref('overview')

const requestQuery = computed(() =>
  cleanQueryObject({
    fiscal_year: fiscalYear.value,
  }),
)

const { data: detail, status } = await useFetch(() => `/api/v1/counties/${countyId.value}`, {
  query: requestQuery,
})
const { data: agencies } = await useFetch(() => `/api/v1/counties/${countyId.value}/agencies`, {
  query: requestQuery,
})
const { data: expenditureTypes } = await useFetch(
  () => `/api/v1/counties/${countyId.value}/expenditure-types`,
  {
    query: requestQuery,
  },
)
const { data: trends } = await useFetch(() => `/api/v1/counties/${countyId.value}/trends`, {
  query: requestQuery,
})

const county = computed(() => detail.value?.data)
const countyLabel = computed(() => formatCountyLabel(county.value?.county_name))
const countyFiscalYearOptions = computed(() =>
  buildFiscalYearOptions(county.value?.available_fiscal_years || []),
)

const title = county.value
  ? `Texas State Spending in ${countyLabel.value}`
  : 'County Detail | Texas State Spending Explorer'
const description = county.value
  ? `See annual Texas state expenditure totals, top agencies, and expenditure types for ${countyLabel.value}.`
  : 'See annual Texas state expenditure totals for a county.'

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
  { label: 'Expenditure types', key: 'types', icon: 'i-lucide-chart-pie' },
  { label: 'Trends', key: 'trends', icon: 'i-lucide-chart-line' },
]
</script>

<template>
  <UContainer class="space-y-8 py-8">
    <div v-if="status === 'pending'" class="flex min-h-64 items-center justify-center">
      <UIcon name="i-lucide-loader-circle" class="size-10 animate-spin text-primary" />
    </div>

    <template v-else-if="county">
      <PageHeader
        eyebrow="County detail"
        :title="countyLabel"
        :subtitle="
          county.fips_code
            ? `FIPS ${county.fips_code}`
            : 'Annual county-level state expenditure detail.'
        "
        :breadcrumbs="[
          { label: 'Home', to: '/' },
          { label: 'Counties', to: '/counties' },
          { label: countyLabel },
        ]"
        :badge="fiscalYear ? `FY ${fiscalYear}` : 'All fiscal years'"
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
        ]"
      />

      <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total landed spend"
          :value="formatUsdCompact(county.total_state_spend_landed)"
          :helper="formatUsd(county.total_state_spend_landed)"
          icon="i-lucide-wallet"
        />
        <KpiCard
          label="Statewide rank"
          :value="county.statewide_rank ? `#${county.statewide_rank}` : 'Unranked'"
          helper="Across the selected fiscal slice"
          icon="i-lucide-trophy"
        />
        <KpiCard
          label="Top agency"
          :value="county.top_agency?.agency_name || 'Unlisted'"
          :helper="
            county.top_agency ? formatUsd(county.top_agency.amount) : 'No agency summary available'
          "
          icon="i-lucide-building-2"
        />
        <KpiCard
          label="Top expenditure type"
          :value="county.top_expenditure_type?.category_title || 'Unlisted'"
          :helper="
            county.top_expenditure_type
              ? formatUsd(county.top_expenditure_type.amount)
              : 'No type summary available'
          "
          icon="i-lucide-chart-pie"
        />
      </section>

      <EntityTabs v-model="activeTab" :tabs="tabs" persist-key="county-detail-tab" />

      <section
        v-if="activeTab === 'overview'"
        class="grid items-start gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(20rem,1fr)]"
      >
        <TrendChartCard
          class="h-auto self-start"
          title="County trend"
          description="Annual state spending landing in this county."
          :series="trends?.data || []"
          x-key="fiscal_year"
          y-key="amount"
          :value-formatter="formatUsdCompact"
        />
        <RankedBarCard
          title="Top agencies"
          description="Agencies accounting for the largest share of county-layer spend."
          :items="(agencies?.data || []).slice(0, 10)"
          label-key="agency_name"
          value-key="amount"
          :value-formatter="formatUsdCompact"
        />
      </section>

      <DataTableCard
        v-else-if="activeTab === 'agencies'"
        title="Agency breakdown"
        description="Agencies with spending landing in this county."
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
        v-else-if="activeTab === 'types'"
        title="Expenditure types"
        description="Broad categories used in the county expenditure layer."
        :columns="[
          { key: 'category_title', label: 'Type' },
          { key: 'amount', label: 'Amount', sortable: true },
        ]"
        :rows="expenditureTypes?.data || []"
      >
        <template #category_title-data="{ row }">
          <UButton
            :to="row.category_code ? `/categories/${row.category_code}` : undefined"
            :prefetch="false"
            color="neutral"
            variant="link"
            class="px-0 font-semibold text-primary"
          >
            {{ row.category_title || 'Unmapped type' }}
          </UButton>
        </template>
        <template #amount-data="{ row }">
          <span class="font-semibold text-default">{{ formatUsd(row.amount) }}</span>
        </template>
      </DataTableCard>

      <TrendChartCard
        v-else
        title="County trend"
        description="Annual county series."
        :series="trends?.data || []"
        x-key="fiscal_year"
        y-key="amount"
        :value-formatter="formatUsdCompact"
      />
    </template>

    <EmptyState
      v-else
      title="County not found"
      description="The requested county could not be found in the county distribution layer."
      icon="i-lucide-search-x"
    >
      <UButton to="/counties" color="primary" variant="soft" class="rounded-full">
        Back to counties
      </UButton>
    </EmptyState>
  </UContainer>
</template>
