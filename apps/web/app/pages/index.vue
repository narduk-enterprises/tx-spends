<script setup lang="ts">
import { useSeoMeta, useAsyncData } from '#imports'

useSeoMeta({
  title: 'Texas State Spending Explorer',
  description:
    'Explore Texas state treasury and accounting-oriented spending, agencies, payees, and trends over time.',
})

// Mock or actual API call for overview data
const { data, pending, error } = await useAsyncData('overview', () => {
  // eslint-disable-next-line narduk/no-raw-fetch -- Exception: Raw fetch is safely wrapped inside useAsyncData
  return $fetch('/api/v1/overview').catch(() => {
    // Return mock fallback if API is not yet available
    return {
      filters_applied: {
        fiscal_year: 2025,
        include_confidential: false,
      },
      data: {
        total_spend: 1234567890.12,
        agency_count: 142,
        payee_count: 58231,
        top_agency: {
          agency_id: 'mock-1',
          agency_name: 'Health and Human Services Commission',
          amount: 123456789.12,
        },
        top_payee: {
          payee_id: 'mock-2',
          payee_name: 'Example Vendor',
          amount: 98765432.1,
        },
        top_category: {
          category_code: '12',
          category_title: 'Salaries and Wages',
          amount: 456789123.45,
        },
        top_county: {
          county_id: 'mock-3',
          county_name: 'Travis',
          amount: 76543210.11,
        },
        trends: [
          { year: 2021, amount: 800000000 },
          { year: 2022, amount: 950000000 },
          { year: 2023, amount: 1100000000 },
          { year: 2024, amount: 1150000000 },
          { year: 2025, amount: 1234567890.12 },
        ],
        top_agencies_list: [
          { agency_name: 'Health and Human Services Commission', amount: 123456789.12 },
          { agency_name: 'Texas Education Agency', amount: 98000000.0 },
          { agency_name: 'Department of Transportation', amount: 75000000.0 },
        ],
        recent_transactions: [
          {
            transaction_id: '1',
            payment_date: '2025-01-15',
            agency_name: 'HHSC',
            payee_name: 'Example Vendor',
            amount: 12345.67,
            object_title: 'Services',
          },
          {
            transaction_id: '2',
            payment_date: '2025-01-14',
            agency_name: 'TEA',
            payee_name: 'School District',
            amount: 50000.0,
            object_title: 'Grants',
          },
        ],
      },
      meta: { currency: 'USD' },
    }
  })
})

const overview = computed(() => (data.value?.data as any) || null)
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 h-full flex flex-col gap-8">
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <PageHeader
        title="Texas State Spending Explorer"
        subtitle="Explore state treasury spending across agencies, payees, and categories."
        class="mb-0"
      />
      <!-- Search bar here -->
      <SearchAutocomplete class="w-full md:w-72 md:shrink-0" />
    </div>

    <!-- Global Disclaimer -->
    <DisclaimerStrip variant="global" />

    <div v-if="pending" class="flex justify-center p-12">
      <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-primary-500" />
    </div>

    <div v-else-if="overview" class="flex flex-col gap-8">
      <!-- KPI Row -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Spend (FY25)"
          :value="
            new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
              maximumFractionDigits: 0,
            }).format(overview.total_spend)
          "
        />
        <KpiCard
          label="Active Agencies"
          :value="new Intl.NumberFormat('en-US').format(overview.agency_count)"
        />
        <KpiCard
          label="Total Payees"
          :value="new Intl.NumberFormat('en-US').format(overview.payee_count)"
        />
        <KpiCard
          label="Top Agency"
          :value="overview.top_agency.agency_name"
          :helper="
            new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
              maximumFractionDigits: 0,
            }).format(overview.top_agency.amount)
          "
        />
      </div>

      <!-- Main Visualizations -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div class="lg:col-span-2">
          <TrendChartCard
            title="Spending Over Time"
            :series="overview.trends"
            x-key="year"
            y-key="amount"
            :value-formatter="
              (v) =>
                new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'USD',
                  notation: 'compact',
                }).format(v)
            "
          />
        </div>
        <div class="lg:col-span-1">
          <RankedBarCard
            title="Top Agencies"
            :items="overview.top_agencies_list"
            label-key="agency_name"
            value-key="amount"
          />
        </div>
      </div>

      <!-- Map & Categories -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <CountyMapCard
          :county-metrics="[overview.top_county]"
          :fy="overview.filters_applied?.fiscal_year"
        />

        <RankedBarCard
          title="Top Categories"
          :items="[overview.top_category]"
          label-key="category_title"
          value-key="amount"
        />
      </div>

      <!-- Recent Transactions Preview -->
      <div class="flex flex-col gap-4">
        <div class="flex items-center justify-between">
          <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">
            Recent Transactions
          </h3>
          <UButton
            to="/transactions"
            variant="soft"
            color="primary"
            trailing-icon="i-heroicons-arrow-right"
            >View All</UButton
          >
        </div>
        <DataTableCard
          :columns="[
            { key: 'payment_date', label: 'Date' },
            { key: 'agency_name', label: 'Agency' },
            { key: 'payee_name', label: 'Payee' },
            { key: 'object_title', label: 'Category' },
            { key: 'amount', label: 'Amount' },
          ]"
          :rows="overview.recent_transactions"
        >
          <template #amount-data="{ row }">
            {{
              new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
                row.amount,
              )
            }}
          </template>
        </DataTableCard>
      </div>
    </div>
  </div>
</template>
