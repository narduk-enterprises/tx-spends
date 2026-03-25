<script setup lang="ts">
import {
  buildFetchKey,
  cleanQueryObject,
  FISCAL_YEAR_OPTIONS,
  formatUsd,
  formatUsdCompact,
  getNumberQueryValue,
} from '~/utils/explorer'

const route = useRoute()
const router = useRouter()

const objectCode = computed(() => String(route.params.code))
const fiscalYear = computed(() => getNumberQueryValue(route.query.fy))

const requestQuery = computed(() =>
  cleanQueryObject({
    fiscal_year: fiscalYear.value,
  }),
)

const transactionsQuery = computed(() =>
  cleanQueryObject({
    object_code: objectCode.value,
    fiscal_year: fiscalYear.value,
    limit: 10,
  }),
)
const detailKey = computed(() =>
  buildFetchKey(`object-detail:${objectCode.value}`, requestQuery.value),
)
const transactionsKey = computed(() =>
  buildFetchKey(`object-transactions:${objectCode.value}`, transactionsQuery.value),
)

const [detailState, transactionsState] = await Promise.all([
  useFetch(() => `/api/v1/objects/${objectCode.value}`, {
    key: detailKey,
    query: requestQuery,
  }),
  useFetch('/api/v1/transactions', {
    key: transactionsKey,
    query: transactionsQuery,
  }),
])
const { data: detail, status } = detailState
const { data: transactions } = transactionsState

const objectDetail = computed(() => detail.value?.data)

const title = computed(() =>
  objectDetail.value
    ? `${objectDetail.value.object_title} (${objectDetail.value.object_code})`
    : 'Comptroller Object Detail',
)
const description = computed(() =>
  objectDetail.value
    ? `Explore total spend and recent public transactions for comptroller object ${objectDetail.value.object_code}.`
    : 'Explore a comptroller object.',
)

useSeo({
  title,
  description,
  ogImage: {
    title,
    description,
    icon: 'i-lucide-badge-dollar-sign',
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
</script>

<template>
  <UContainer class="space-y-8 py-8">
    <div v-if="status === 'pending'" class="flex min-h-64 items-center justify-center">
      <UIcon name="i-lucide-loader-circle" class="size-10 animate-spin text-primary" />
    </div>

    <template v-else-if="objectDetail">
      <PageHeader
        eyebrow="Object detail"
        :title="objectDetail.object_title"
        :subtitle="
          objectDetail.object_group || 'Comptroller object detail from the state payment feed.'
        "
        :breadcrumbs="[
          { label: 'Home', to: '/' },
          { label: 'Objects', to: '/objects' },
          { label: objectDetail.object_code },
        ]"
        :badge="objectDetail.object_code"
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
        ]"
      />

      <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <KpiCard
          label="Total spend"
          :value="formatUsdCompact(objectDetail.total_spend)"
          :helper="formatUsd(objectDetail.total_spend)"
          icon="i-lucide-wallet"
        />
        <KpiCard
          label="Object code"
          :value="objectDetail.object_code"
          helper="Fine-grained accounting object"
          icon="i-lucide-hash"
        />
        <KpiCard
          label="Object group"
          :value="objectDetail.object_group || 'Unlisted'"
          helper="Reference taxonomy"
          icon="i-lucide-layers-3"
        />
      </section>

      <DataTableCard
        title="Recent transactions"
        description="Latest public transactions for this object code."
        :columns="[
          { key: 'payment_date', label: 'Date' },
          { key: 'agency_name', label: 'Agency' },
          { key: 'payee_name', label: 'Payee' },
          { key: 'amount', label: 'Amount', sortable: true },
        ]"
        :rows="transactions?.data || []"
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
          <span class="font-semibold text-default">{{ formatUsd(row.amount, 2) }}</span>
        </template>
      </DataTableCard>
    </template>

    <EmptyState
      v-else
      title="Object not found"
      description="The requested comptroller object could not be found."
      icon="i-lucide-search-x"
    >
      <UButton to="/objects" color="primary" variant="soft" class="rounded-full">
        Back to objects
      </UButton>
    </EmptyState>
  </UContainer>
</template>
