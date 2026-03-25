<script setup lang="ts">
import {
  cleanQueryObject,
  FISCAL_YEAR_OPTIONS,
  formatCountyLabel,
  formatCount,
  formatUsd,
  formatUsdCompact,
  getNumberQueryValue,
} from '~/utils/explorer'

const route = useRoute()
const router = useRouter()

const agencyId = computed(() => String(route.params.id))
const fiscalYear = computed(() => getNumberQueryValue(route.query.fy))
const activeTab = ref('overview')

const detailQuery = computed(() =>
  cleanQueryObject({
    fiscal_year: fiscalYear.value,
  }),
)

const {
  data: detail,
  error,
  status,
} = await useFetch(() => `/api/v1/agencies/${agencyId.value}`, {
  query: detailQuery,
})
const { data: trends } = await useFetch(() => `/api/v1/agencies/${agencyId.value}/trends`, {
  query: detailQuery,
})
const { data: payees } = await useFetch(() => `/api/v1/agencies/${agencyId.value}/payees`, {
  query: detailQuery,
})
const { data: objects } = await useFetch(() => `/api/v1/agencies/${agencyId.value}/objects`, {
  query: detailQuery,
})
const { data: counties } = await useFetch(() => `/api/v1/agencies/${agencyId.value}/counties`, {
  query: detailQuery,
})

const agency = computed(() => detail.value?.data)

const title = agency.value
  ? `${agency.value.agency_name} Spending in Texas`
  : 'Agency Spending | Texas State Spending Explorer'
const description = agency.value
  ? `Explore ${agency.value.agency_name} spending, top payees, object codes, county distribution, and trends over time.`
  : 'Explore Texas agency spending, top payees, object codes, and county distribution.'

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
  { label: 'Payees', key: 'payees', icon: 'i-lucide-briefcase-business' },
  { label: 'Objects', key: 'objects', icon: 'i-lucide-badge-dollar-sign' },
  { label: 'Counties', key: 'counties', icon: 'i-lucide-map-pinned' },
  { label: 'Trends', key: 'trends', icon: 'i-lucide-chart-line' },
]
</script>

<template>
  <UContainer class="space-y-8 py-8">
    <div v-if="status === 'pending'" class="flex min-h-64 items-center justify-center">
      <UIcon name="i-lucide-loader-circle" class="size-10 animate-spin text-primary" />
    </div>

    <template v-else-if="agency">
      <PageHeader
        eyebrow="Agency detail"
        :title="agency.agency_name"
        :subtitle="
          agency.agency_code
            ? `Agency code ${agency.agency_code}`
            : 'Texas state agency spending detail.'
        "
        :breadcrumbs="[
          { label: 'Home', to: '/' },
          { label: 'Agencies', to: '/agencies' },
          { label: agency.agency_name },
        ]"
        :badge="fiscalYear ? `FY ${fiscalYear}` : 'All fiscal years'"
      >
        <template #actions>
          <UButton
            :to="`/transactions?agency_id=${agency.agency_id}${fiscalYear ? `&fy=${fiscalYear}` : ''}`"
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
          :value="formatUsdCompact(agency.total_spend)"
          :helper="formatUsd(agency.total_spend)"
          icon="i-lucide-wallet"
        />
        <KpiCard
          label="Payments"
          :value="formatCount(agency.payment_count)"
          helper="Public payment rows"
          icon="i-lucide-receipt-text"
        />
        <KpiCard
          label="Distinct payees"
          :value="formatCount(agency.distinct_payee_count)"
          helper="Across the selected slice"
          icon="i-lucide-users"
        />
        <KpiCard
          label="Top object"
          :value="agency.top_object?.object_code || 'Unmapped'"
          :helper="agency.top_object?.object_title || 'No object breakdown available'"
          icon="i-lucide-badge-dollar-sign"
        />
      </section>

      <EntityTabs v-model="activeTab" :tabs="tabs" persist-key="agency-detail-tab" />

      <section v-if="activeTab === 'overview'" class="space-y-6">
        <TrendChartCard
          title="Agency spending trend"
          description="Annual spending totals from the public state payment feed."
          :series="trends?.data || []"
          x-key="fiscal_year"
          y-key="amount"
          :value-formatter="formatUsdCompact"
        />

        <div class="grid gap-6 xl:grid-cols-2">
          <RankedBarCard
            title="Top payees"
            description="Largest recipients of this agency's spending."
            :items="(payees?.data || []).slice(0, 10)"
            label-key="payee_name"
            value-key="amount"
            :value-formatter="formatUsdCompact"
          />
          <RankedBarCard
            title="Top objects"
            description="Comptroller object codes driving this agency's spend."
            :items="(objects?.data || []).slice(0, 10)"
            label-key="object_title"
            value-key="amount"
            :value-formatter="formatUsdCompact"
          />
        </div>

        <UAlert
          title="County distribution is a separate annual layer."
          description="Agency county breakdowns come from the annual county expenditure reports, not from payment row geography."
          icon="i-lucide-info"
          color="primary"
          variant="soft"
          class="rounded-[1.25rem]"
        />

        <CountyMapCard
          :county-metrics="counties?.data || []"
          :fy="fiscalYear || 'All years'"
          @select-county="router.push(`/counties/${$event}`)"
        />
      </section>

      <DataTableCard
        v-else-if="activeTab === 'payees'"
        title="Payee breakdown"
        description="Recipients of this agency's spending."
        :columns="[
          { key: 'payee_name', label: 'Payee' },
          { key: 'amount', label: 'Amount', sortable: true },
        ]"
        :rows="payees?.data || []"
        empty-title="No payee data"
        empty-description="There are no payees available for this agency under the current fiscal year filter."
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
        description="Comptroller objects attached to this agency's payment rows."
        :columns="[
          { key: 'object_code', label: 'Object code' },
          { key: 'object_title', label: 'Object title' },
          { key: 'amount', label: 'Amount', sortable: true },
        ]"
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

      <template v-else-if="activeTab === 'counties'">
        <DisclaimerStrip variant="county" />
        <DataTableCard
          title="County distribution"
          description="Annual county-level spending attributed to this agency."
          :columns="[
            { key: 'county_name', label: 'County' },
            { key: 'amount', label: 'Amount', sortable: true },
          ]"
          :rows="counties?.data || []"
        >
          <template #county_name-data="{ row }">
            <UButton
              :to="`/counties/${row.county_id}`"
              :prefetch="false"
              color="neutral"
              variant="link"
              class="px-0 font-semibold text-primary"
            >
              {{ formatCountyLabel(row.county_name) }}
            </UButton>
          </template>
          <template #amount-data="{ row }">
            <span class="font-semibold text-default">{{ formatUsd(row.amount) }}</span>
          </template>
        </DataTableCard>
      </template>

      <TrendChartCard
        v-else
        title="Agency trend"
        description="Annual trend series for this agency."
        :series="trends?.data || []"
        x-key="fiscal_year"
        y-key="amount"
        :value-formatter="formatUsdCompact"
      />
    </template>

    <EmptyState
      v-else
      title="Agency not found"
      description="The requested agency could not be found in the public spending dataset."
      icon="i-lucide-search-x"
    >
      <UButton to="/agencies" color="primary" variant="soft" class="rounded-full">
        Back to agencies
      </UButton>
    </EmptyState>
  </UContainer>
</template>
