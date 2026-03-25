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

const categoryCode = computed(() => String(route.params.code))
const fiscalYear = computed(() => getNumberQueryValue(route.query.fy))
const activeTab = ref('overview')

const requestQuery = computed(() =>
  cleanQueryObject({
    fiscal_year: fiscalYear.value,
  }),
)

const detailKey = computed(() =>
  buildFetchKey(`category-detail:${categoryCode.value}`, requestQuery.value),
)
const trendsKey = computed(() =>
  buildFetchKey(`category-trends:${categoryCode.value}`, requestQuery.value),
)
const agenciesKey = computed(() =>
  buildFetchKey(`category-agencies:${categoryCode.value}`, requestQuery.value),
)
const payeesKey = computed(() =>
  buildFetchKey(`category-payees:${categoryCode.value}`, requestQuery.value),
)
const objectsKey = computed(() =>
  buildFetchKey(`category-objects:${categoryCode.value}`, requestQuery.value),
)

const [detailState, trendsState, agenciesState] = await Promise.all([
  useFetch(() => `/api/v1/categories/${categoryCode.value}`, {
    key: detailKey,
    query: requestQuery,
  }),
  useFetch(() => `/api/v1/categories/${categoryCode.value}/trends`, {
    key: trendsKey,
    query: requestQuery,
  }),
  useFetch(() => `/api/v1/categories/${categoryCode.value}/agencies`, {
    key: agenciesKey,
    query: requestQuery,
  }),
])
const { data: detail, status } = detailState
const { data: trends } = trendsState
const { data: agencies } = agenciesState
const {
  data: payees,
  status: payeesStatus,
  execute: fetchPayees,
} = useLazyFetch(() => `/api/v1/categories/${categoryCode.value}/payees`, {
  key: payeesKey,
  query: requestQuery,
  immediate: false,
  server: false,
  default: () => ({ data: [] }),
})
const {
  data: objects,
  status: objectsStatus,
  execute: fetchObjects,
} = useLazyFetch(() => `/api/v1/categories/${categoryCode.value}/objects`, {
  key: objectsKey,
  query: requestQuery,
  immediate: false,
  server: false,
  default: () => ({ data: [] }),
})

watch(
  [activeTab, payeesKey],
  ([tab]) => {
    if (tab === 'payees') {
      void fetchPayees()
    }
  },
  { immediate: true },
)

watch(
  [activeTab, objectsKey],
  ([tab]) => {
    if (tab === 'objects') {
      void fetchObjects()
    }
  },
  { immediate: true },
)

const category = computed(() => detail.value?.data)

const title = computed(() =>
  category.value
    ? `${category.value.category_title} Spending in Texas`
    : 'Category Detail | Texas State Spending Explorer',
)
const description = computed(() =>
  category.value
    ? `Explore agency participation, payees, objects, and trend lines for ${category.value.category_title}.`
    : 'Explore a Texas expenditure category.',
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
  { label: 'Payees', key: 'payees', icon: 'i-lucide-briefcase-business' },
  { label: 'Objects', key: 'objects', icon: 'i-lucide-badge-dollar-sign' },
  { label: 'Trends', key: 'trends', icon: 'i-lucide-chart-line' },
]
</script>

<template>
  <UContainer class="space-y-8 py-8">
    <div v-if="status === 'pending'" class="flex min-h-64 items-center justify-center">
      <UIcon name="i-lucide-loader-circle" class="size-10 animate-spin text-primary" />
    </div>

    <template v-else-if="category">
      <PageHeader
        eyebrow="Category detail"
        :title="category.category_title"
        :subtitle="`Category slug ${category.category_code}`"
        :breadcrumbs="[
          { label: 'Home', to: '/' },
          { label: 'Categories', to: '/categories' },
          { label: category.category_title },
        ]"
        :badge="fiscalYear ? `FY ${fiscalYear}` : 'All fiscal years'"
      >
        <template #actions>
          <UButton
            :to="`/transactions?category_code=${category.category_code}${fiscalYear ? `&fy=${fiscalYear}` : ''}`"
            color="primary"
            variant="soft"
            icon="i-lucide-arrow-right"
            class="rounded-full"
          >
            View transactions
          </UButton>
        </template>
      </PageHeader>

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

      <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total spend"
          :value="formatUsdCompact(category.total_spend)"
          :helper="formatUsd(category.total_spend)"
          icon="i-lucide-wallet"
        />
        <KpiCard
          label="Agency count"
          :value="formatCount(category.agency_count)"
          helper="Distinct agencies in the payment feed"
          icon="i-lucide-building-2"
        />
        <KpiCard
          label="Payee count"
          :value="formatCount(category.payee_count)"
          helper="Distinct payees in payment feed"
          icon="i-lucide-users"
        />
        <KpiCard
          label="Category code"
          :value="category.category_code"
          helper="Broad expenditure rollup"
          icon="i-lucide-badge-dollar-sign"
        />
      </section>

      <EntityTabs v-model="activeTab" :tabs="tabs" persist-key="category-detail-tab" />

      <section
        v-if="activeTab === 'overview'"
        class="grid items-start gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(20rem,1fr)]"
      >
        <TrendChartCard
          class="h-auto self-start"
          title="Category trend"
          description="Annual payment totals for this category."
          :series="trends?.data || []"
          x-key="fiscal_year"
          y-key="amount"
          :value-formatter="formatUsdCompact"
        />
        <RankedBarCard
          title="Top agencies"
          description="Agencies driving this category."
          :items="(agencies?.data || []).slice(0, 10)"
          label-key="agency_name"
          value-key="amount"
          :value-formatter="formatUsdCompact"
        />
      </section>

      <DataTableCard
        v-else-if="activeTab === 'agencies'"
        title="Agency breakdown"
        description="Agencies contributing to this category."
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
        v-else-if="activeTab === 'payees'"
        title="Payee breakdown"
        description="Public payees whose payment rows fall into this category."
        :columns="[
          { key: 'payee_name', label: 'Payee' },
          { key: 'amount', label: 'Amount', sortable: true },
        ]"
        :loading="payeesStatus === 'pending'"
        :rows="payees?.data || []"
      >
        <template #payee_name-data="{ row }">
          <UButton
            :to="row.payee_id ? `/payees/${row.payee_id}` : undefined"
            :prefetch="false"
            color="neutral"
            variant="link"
            class="px-0 font-semibold text-primary"
          >
            {{ row.payee_name || 'Unknown payee' }}
          </UButton>
        </template>
        <template #amount-data="{ row }">
          <span class="font-semibold text-default">{{ formatUsd(row.amount) }}</span>
        </template>
      </DataTableCard>

      <DataTableCard
        v-else-if="activeTab === 'objects'"
        title="Object breakdown"
        description="Comptroller objects attached to payment rows in this category."
        :columns="[
          { key: 'object_code', label: 'Object code' },
          { key: 'object_title', label: 'Object title' },
          { key: 'amount', label: 'Amount', sortable: true },
        ]"
        :loading="objectsStatus === 'pending'"
        :rows="objects?.data || []"
      >
        <template #object_code-data="{ row }">
          <UBadge color="neutral" variant="soft">{{ row.object_code || 'Unmapped' }}</UBadge>
        </template>
        <template #object_title-data="{ row }">
          <UButton
            :to="row.object_code ? `/objects/${row.object_code}` : undefined"
            :prefetch="false"
            color="neutral"
            variant="link"
            class="px-0 font-semibold text-primary"
          >
            {{ row.object_title || 'Unknown object' }}
          </UButton>
        </template>
        <template #amount-data="{ row }">
          <span class="font-semibold text-default">{{ formatUsd(row.amount) }}</span>
        </template>
      </DataTableCard>

      <TrendChartCard
        v-else
        title="Trend view"
        description="Annual payment totals for this category."
        :series="trends?.data || []"
        x-key="fiscal_year"
        y-key="amount"
        :value-formatter="formatUsdCompact"
      />
    </template>

    <EmptyState
      v-else
      title="Category not found"
      description="The requested category could not be found in the explorer."
      icon="i-lucide-search-x"
    >
      <UButton to="/categories" color="primary" variant="soft" class="rounded-full">
        Back to categories
      </UButton>
    </EmptyState>
  </UContainer>
</template>
