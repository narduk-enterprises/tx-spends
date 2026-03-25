<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useSeoMeta, useAsyncData } from '#imports'

const route = useRoute()
const agencyId = route.params.id as string

const { data, pending } = await useAsyncData(`agency-${agencyId}`, () => {
  // Mock API fallback
  return Promise.resolve({
    data: {
      agency_id: agencyId,
      agency_name: 'Health and Human Services Commission',
      total_spend: 123456789.12,
      payee_count: 5201,
      transaction_count: 142050,
      trends: [
        { year: 2021, amount: 80000000 },
        { year: 2022, amount: 95000000 },
        { year: 2023, amount: 110000000 },
        { year: 2024, amount: 115000000 },
        { year: 2025, amount: 123456789.12 },
      ],
      top_payees: [
        { payee_name: 'Mock Vendor A', amount: 50000000 },
        { payee_name: 'Mock Vendor B', amount: 25000000 },
      ],
      top_categories: [
        { category_title: 'Medical Services', amount: 80000000 },
        { category_title: 'Salaries', amount: 20000000 },
      ],
    },
  })
})

const agency = computed(() => data.value?.data)

useSeoMeta({
  title: computed(() =>
    agency.value
      ? `${agency.value.agency_name} Spending - Texas State Spending Explorer`
      : 'Agency Spending',
  ),
  description: computed(() =>
    agency.value
      ? `Explore expenditure details, payees, and trends for the ${agency.value.agency_name}.`
      : '',
  ),
})

const activeTab = ref('overview')
const tabs = [
  { label: 'Overview', key: 'overview', icon: 'i-heroicons-chart-pie' },
  { label: 'Payees', key: 'payees', icon: 'i-heroicons-user-group' },
  { label: 'Categories', key: 'categories', icon: 'i-heroicons-tag' },
  { label: 'Transactions', key: 'transactions', icon: 'i-heroicons-list-bullet' },
]
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 h-full flex flex-col gap-6">
    <div v-if="pending" class="flex justify-center p-12">
      <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-primary-500" />
    </div>

    <template v-else-if="agency">
      <PageHeader
        :title="agency.agency_name"
        :subtitle="`Agency ID: ${agency.agency_id}`"
        :breadcrumbs="[
          { label: 'Home', to: '/' },
          { label: 'Agencies', to: '/agencies' },
          { label: agency.agency_name },
        ]"
      />

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard
          label="Total Spend (FY25)"
          :value="
            new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
              maximumFractionDigits: 0,
            }).format(agency.total_spend)
          "
        />
        <KpiCard
          label="Total Payees"
          :value="new Intl.NumberFormat('en-US').format(agency.payee_count)"
        />
        <KpiCard
          label="Transactions"
          :value="new Intl.NumberFormat('en-US').format(agency.transaction_count)"
        />
      </div>

      <EntityTabs :tabs="tabs" v-model="activeTab" />

      <!-- Overview Tab -->
      <div v-show="activeTab === 'overview'" class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <TrendChartCard
          title="Spending Trend (5 Years)"
          :series="agency.trends"
          x-key="year"
          y-key="amount"
          class="lg:col-span-2"
        />

        <RankedBarCard
          title="Top Payees"
          :items="agency.top_payees"
          label-key="payee_name"
          value-key="amount"
        />

        <RankedBarCard
          title="Top Categories"
          :items="agency.top_categories"
          label-key="category_title"
          value-key="amount"
        />
      </div>

      <!-- Other Tabs Fallbacks -->
      <div v-show="activeTab !== 'overview'">
        <EmptyState
          :title="`${tabs.find((t) => t.key === activeTab)?.label} Details`"
          description="This tab would dynamically fetch paginated data for the selected entity filtering by the parent agency ID."
          icon="i-heroicons-clock"
        />
      </div>
    </template>

    <EmptyState
      v-else
      title="Agency Not Found"
      description="The agency you are looking for does not exist or has no spending data."
      icon="i-heroicons-x-circle"
    />
  </div>
</template>
