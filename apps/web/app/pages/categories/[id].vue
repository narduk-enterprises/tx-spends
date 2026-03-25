<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useSeoMeta, useAsyncData } from '#imports'

const route = useRoute()
const code = route.params.id as string

const { data, pending } = await useAsyncData(`category-${code}`, () => {
  return Promise.resolve({
    data: {
      category_code: code,
      category_title: 'Medical Services',
      total_spend: 800000000.0,
      payee_count: 14205,
      transaction_count: 502010,
      trends: [
        { year: 2021, amount: 600000000 },
        { year: 2022, amount: 650000000 },
        { year: 2023, amount: 700000000 },
        { year: 2024, amount: 750000000 },
        { year: 2025, amount: 800000000 },
      ],
      top_agencies: [
        { agency_name: 'Health and Human Services Commission', amount: 750000000 },
        { agency_name: 'Department of Criminal Justice', amount: 50000000 },
      ],
    },
  })
})

const category = computed(() => data.value?.data)

useSeoMeta({
  title: computed(() =>
    category.value
      ? `${category.value.category_title} (${category.value.category_code}) Spending - Texas State Spending Explorer`
      : 'Category Spending',
  ),
  description: computed(() =>
    category.value
      ? `Explore expenditure details, agencies, and trends for ${category.value.category_title}.`
      : '',
  ),
})

const activeTab = ref('overview')
const tabs = [
  { label: 'Overview', key: 'overview', icon: 'i-heroicons-chart-pie' },
  { label: 'Agencies', key: 'agencies', icon: 'i-heroicons-building-library' },
  { label: 'Payees', key: 'payees', icon: 'i-heroicons-user-group' },
  { label: 'Transactions', key: 'transactions', icon: 'i-heroicons-list-bullet' },
]
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 h-full flex flex-col gap-6">
    <div v-if="pending" class="flex justify-center p-12">
      <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-primary-500" />
    </div>

    <template v-else-if="category">
      <PageHeader
        :title="category.category_title"
        :subtitle="`Object Code: ${category.category_code}`"
        :breadcrumbs="[
          { label: 'Home', to: '/' },
          { label: 'Categories', to: '/categories' },
          { label: category.category_title },
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
            }).format(category.total_spend)
          "
        />
        <KpiCard
          label="Total Payees"
          :value="new Intl.NumberFormat('en-US').format(category.payee_count)"
        />
        <KpiCard
          label="Transactions"
          :value="new Intl.NumberFormat('en-US').format(category.transaction_count)"
        />
      </div>

      <EntityTabs :tabs="tabs" v-model="activeTab" />

      <!-- Overview Tab -->
      <div v-show="activeTab === 'overview'" class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <TrendChartCard
          title="Spending Trend (5 Years)"
          :series="category.trends"
          x-key="year"
          y-key="amount"
          class="lg:col-span-2"
        />

        <RankedBarCard
          title="Top Agencies using this Category"
          :items="category.top_agencies"
          label-key="agency_name"
          value-key="amount"
          class="lg:col-span-2"
        />
      </div>

      <div v-show="activeTab !== 'overview'">
        <EmptyState
          :title="`${tabs.find((t) => t.key === activeTab)?.label} Details`"
          description="This tab would dynamically fetch paginated data for the selected entity filtering by the parent category code."
          icon="i-heroicons-clock"
        />
      </div>
    </template>

    <EmptyState
      v-else
      title="Category Not Found"
      description="The category you are looking for does not exist."
      icon="i-heroicons-x-circle"
    />
  </div>
</template>
