<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useSeoMeta, useAsyncData } from '#imports'

const route = useRoute()
const payeeId = route.params.id as string

const { data, pending } = await useAsyncData(`payee-${payeeId}`, () => {
  return Promise.resolve({
    data: {
      payee_id: payeeId,
      payee_name_normalized: 'MOCK VENDOR A',
      total_spend: 500000.0,
      agency_count: 3,
      transaction_count: 142,
      enrichment: {
        vendor_name_normalized: 'MOCK VENDOR A INC',
        hub_status: true,
        small_business_flag: true,
        sdv_flag: false,
        confidence_score: 0.99,
      },
      trends: [
        { year: 2021, amount: 60000 },
        { year: 2022, amount: 65000 },
        { year: 2023, amount: 70000 },
        { year: 2024, amount: 75000 },
        { year: 2025, amount: 500000 },
      ],
      top_agencies: [
        { agency_name: 'Health and Human Services Commission', amount: 250000 },
        { agency_name: 'Department of Transportation', amount: 150000 },
      ],
    },
  })
})

const payee = computed(() => data.value?.data)

useSeoMeta({
  title: computed(() =>
    payee.value
      ? `${payee.value.payee_name_normalized} State Spending - Texas State Spending Explorer`
      : 'Payee Spending',
  ),
  description: computed(() =>
    payee.value
      ? `Explore state expenditure details and agencies paying ${payee.value.payee_name_normalized}.`
      : '',
  ),
})

const activeTab = ref('overview')
const tabs = [
  { label: 'Overview', key: 'overview', icon: 'i-heroicons-chart-pie' },
  { label: 'Agencies', key: 'agencies', icon: 'i-heroicons-building-library' },
  { label: 'Transactions', key: 'transactions', icon: 'i-heroicons-list-bullet' },
]
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 h-full flex flex-col gap-6">
    <div v-if="pending" class="flex justify-center p-12">
      <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-primary-500" />
    </div>

    <template v-else-if="payee">
      <PageHeader
        :title="payee.payee_name_normalized"
        :subtitle="`Payee Link ID: ${payee.payee_id}`"
        :breadcrumbs="[
          { label: 'Home', to: '/' },
          { label: 'Payees', to: '/payees' },
          { label: payee.payee_name_normalized },
        ]"
        class="mb-2"
      />

      <!-- Enrichment details if found -->
      <VendorMatchBadgeRow
        v-if="payee.enrichment"
        :enrichment="payee.enrichment"
        :match-confidence="payee.enrichment.confidence_score"
      />
      <div v-else class="mb-4 text-sm text-gray-500 dark:text-gray-400">
        No state vendor enrichment matches found for this payee.
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard
          label="Total State Spend (FY25)"
          :value="
            new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
              maximumFractionDigits: 0,
            }).format(payee.total_spend)
          "
        />
        <KpiCard
          label="Agencies Paying"
          :value="new Intl.NumberFormat('en-US').format(payee.agency_count)"
        />
        <KpiCard
          label="Transactions"
          :value="new Intl.NumberFormat('en-US').format(payee.transaction_count)"
        />
      </div>

      <EntityTabs :tabs="tabs" v-model="activeTab" />

      <div v-show="activeTab === 'overview'" class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <TrendChartCard
          title="Income from State (5 Years)"
          :series="payee.trends"
          x-key="year"
          y-key="amount"
          class="lg:col-span-2"
        />

        <RankedBarCard
          title="Top Paying Agencies"
          :items="payee.top_agencies"
          label-key="agency_name"
          value-key="amount"
          class="lg:col-span-2"
        />
      </div>

      <div v-show="activeTab !== 'overview'">
        <EmptyState
          :title="`${tabs.find((t) => t.key === activeTab)?.label} Details`"
          description="This tab would dynamically fetch paginated data filtering by the parent payee ID."
          icon="i-heroicons-clock"
        />
      </div>
    </template>

    <EmptyState
      v-else
      title="Payee Not Found"
      description="The payee you are looking for does not exist."
      icon="i-heroicons-x-circle"
    />
  </div>
</template>
