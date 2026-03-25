<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useSeoMeta, useAsyncData } from '#imports'

const route = useRoute()
const countyId = route.params.id as string

const { data, pending } = await useAsyncData(`county-${countyId}`, () => {
  return Promise.resolve({
    data: {
      county_id: countyId,
      county_name: 'Travis',
      total_spend: 8000000000.0,
      agency_count: 85,
      trends: [
        { year: 2021, amount: 6000000000 },
        { year: 2022, amount: 6500000000 },
        { year: 2023, amount: 7000000000 },
        { year: 2024, amount: 7500000000 },
        { year: 2025, amount: 8000000000 },
      ],
      top_agencies: [
        { agency_name: 'Health and Human Services Commission', amount: 2500000000 },
        { agency_name: 'University of Texas at Austin', amount: 1500000000 },
      ],
      top_categories: [
        { category_title: 'Salaries and Wages', amount: 3000000000 },
        { category_title: 'Construction', amount: 1000000000 },
      ],
    },
  })
})

const county = computed(() => data.value?.data)

useSeoMeta({
  title: computed(() =>
    county.value
      ? `${county.value.county_name} County State Spending - Texas State Spending Explorer`
      : 'County Spending',
  ),
  description: computed(() =>
    county.value
      ? `Explore state expenditure details and agencies within ${county.value.county_name} County.`
      : '',
  ),
})

const activeTab = ref('overview')
const tabs = [
  { label: 'Overview', key: 'overview', icon: 'i-heroicons-chart-pie' },
  { label: 'Agencies', key: 'agencies', icon: 'i-heroicons-building-library' },
  { label: 'Categories', key: 'categories', icon: 'i-heroicons-tag' },
]
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 h-full flex flex-col gap-6">
    <div v-if="pending" class="flex justify-center p-12">
      <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-primary-500" />
    </div>

    <template v-else-if="county">
      <PageHeader
        :title="`${county.county_name} County`"
        :subtitle="`FIPS: 48${county.county_id.padStart(3, '0')}`"
        :breadcrumbs="[
          { label: 'Home', to: '/' },
          { label: 'Counties', to: '/counties' },
          { label: `${county.county_name} County` },
        ]"
      />

      <DisclaimerStrip variant="county" />

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <KpiCard
          label="Total State Spend (FY25)"
          :value="
            new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
              maximumFractionDigits: 0,
            }).format(county.total_spend)
          "
        />
        <KpiCard
          label="Agencies active in county"
          :value="new Intl.NumberFormat('en-US').format(county.agency_count)"
        />
      </div>

      <EntityTabs :tabs="tabs" v-model="activeTab" />

      <div v-show="activeTab === 'overview'" class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <TrendChartCard
          title="Spending Trend in County (5 Years)"
          :series="county.trends"
          x-key="year"
          y-key="amount"
          class="lg:col-span-2"
        />

        <RankedBarCard
          title="Top Agencies structured in County"
          :items="county.top_agencies"
          label-key="agency_name"
          value-key="amount"
        />

        <RankedBarCard
          title="Top Categories"
          :items="county.top_categories"
          label-key="category_title"
          value-key="amount"
        />
      </div>

      <div v-show="activeTab !== 'overview'">
        <EmptyState
          :title="`${tabs.find((t) => t.key === activeTab)?.label} Details`"
          description="This tab would dynamically fetch paginated data filtering by the parent county ID."
          icon="i-heroicons-clock"
        />
      </div>
    </template>

    <EmptyState
      v-else
      title="County Not Found"
      description="The county you are looking for does not exist."
      icon="i-heroicons-x-circle"
    />
  </div>
</template>
