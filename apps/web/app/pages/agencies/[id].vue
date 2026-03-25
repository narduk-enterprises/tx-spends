<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const agencyId = route.params.id as string

const { data: detail, status: detailStatus } = await useFetch(`/api/v1/agencies/${agencyId}`, {
  query: computed(() => route.query),
})

const { data: payees } = await useFetch(`/api/v1/agencies/${agencyId}/payees`, {
  lazy: true,
  query: computed(() => route.query),
})
const { data: objects } = await useFetch(`/api/v1/agencies/${agencyId}/objects`, {
  lazy: true,
  query: computed(() => route.query),
})
const { data: counties } = await useFetch(`/api/v1/agencies/${agencyId}/counties`, {
  lazy: true,
  query: computed(() => route.query),
})
const { data: trends } = await useFetch(`/api/v1/agencies/${agencyId}/trends`, { lazy: true })

useSeoMeta({
  title: computed(() =>
    detail.value?.data?.agency_name
      ? `${detail.value.data.agency_name} | Agency Profile`
      : 'Agency Explorer | Texas Spends',
  ),
  description: computed(
    () =>
      `Spending profile and vendor payments for ${detail.value?.data?.agency_name || 'State Agency'} in Texas.`,
  ),
})
</script>

<template>
  <div>
    <FilterBar />
    <UContainer class="py-8">
      <!-- Header -->
      <div v-if="detailStatus === 'pending'" class="py-12 flex justify-center">
        <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin" />
      </div>

      <div
        v-else-if="detail?.data"
        class="mb-8 p-6 bg-[var(--ui-bg)] rounded-xl border border-[var(--ui-border)] shadow-sm"
      >
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div
              class="flex items-center gap-2 mb-2 text-sm font-medium text-[var(--ui-text-muted)] uppercase tracking-wider"
            >
              <UIcon name="i-heroicons-building-office" class="w-5 h-5 shrink-0" /> State Agency
            </div>
            <h1 class="text-3xl font-bold text-[var(--ui-text)]">{{ detail.data.agency_name }}</h1>
          </div>
          <div class="text-left md:text-right">
            <p class="text-sm text-[var(--ui-text-muted)] uppercase tracking-wider">
              Total Evaluated Spend
            </p>
            <p class="text-4xl font-bold text-[var(--ui-primary)]">
              ${{ Number((detail.data as any).total_spend || 0).toLocaleString() }}
            </p>
          </div>
        </div>

        <div class="mt-6 border-t border-[var(--ui-border)] pt-4 flex gap-8">
          <div>
            <span class="text-xs text-[var(--ui-text-muted)] uppercase tracking-wider"
              >Agency ID</span
            >
            <p class="font-medium font-mono text-sm mt-1">{{ detail.data.agency_id }}</p>
          </div>
        </div>
      </div>

      <div v-if="detail?.data" class="grid grid-cols-1 md:grid-cols-2 gap-8">
        <UCard>
          <template #header
            ><h3 class="font-semibold flex items-center gap-2">
              <UIcon name="i-heroicons-user-group" /> Top Payees
            </h3></template
          >
          <ul class="space-y-3" v-if="payees?.data?.length">
            <li
              v-for="payee in payees.data"
              :key="payee.payee_id"
              class="flex justify-between items-center text-sm"
            >
              <NuxtLink
                :to="`/payees/${payee.payee_id}`"
                class="truncate font-medium text-[var(--ui-primary)] hover:underline pr-4"
                >{{ payee.payee_name }}</NuxtLink
              >
              <span class="font-medium whitespace-nowrap"
                >${{ payee.amount.toLocaleString() }}</span
              >
            </li>
          </ul>
          <p v-else class="text-sm text-[var(--ui-text-muted)] text-center py-4">
            No payee data available.
          </p>
          <div class="mt-4 text-center">
            <UButton :to="`/transactions?agency_id=${agencyId}`" variant="link" color="primary"
              >View all ledger traces</UButton
            >
          </div>
        </UCard>

        <UCard>
          <template #header
            ><h3 class="font-semibold flex items-center gap-2">
              <UIcon name="i-heroicons-tag" /> Top Expenditures
            </h3></template
          >
          <ul class="space-y-3" v-if="objects?.data?.length">
            <li
              v-for="obj in objects.data"
              :key="obj.object_code"
              class="flex justify-between items-center text-sm"
            >
              <span class="truncate block pr-4" :title="obj.object_title">{{
                obj.object_title
              }}</span>
              <span class="font-medium whitespace-nowrap">${{ obj.amount.toLocaleString() }}</span>
            </li>
          </ul>
          <p v-else class="text-sm text-[var(--ui-text-muted)] text-center py-4">
            No expenditure objects found.
          </p>
        </UCard>

        <UCard class="md:col-span-2">
          <template #header
            ><h3 class="font-semibold flex items-center gap-2">
              <UIcon name="i-heroicons-map" /> Target Counties Breakdown
            </h3></template
          >
          <div
            class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4"
            v-if="counties?.data?.length"
          >
            <div
              v-for="county in counties.data"
              :key="county.county_id"
              class="p-3 bg-[var(--ui-bg-elevated)] rounded-lg border border-[var(--ui-border)]"
            >
              <NuxtLink
                :to="`/counties/${county.county_id}`"
                class="font-medium text-[var(--ui-primary)] hover:underline text-sm block truncate"
                >{{ county.county_name }}</NuxtLink
              >
              <p class="text-xl font-bold mt-1">${{ county.amount.toLocaleString() }}</p>
            </div>
          </div>
        </UCard>
      </div>
    </UContainer>
  </div>
</template>
