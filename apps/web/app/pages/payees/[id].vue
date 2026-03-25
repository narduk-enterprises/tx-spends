<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const payeeId = route.params.id as string

const { data: detail, status: detailStatus } = await useFetch(`/api/v1/payees/${payeeId}`, {
  query: computed(() => route.query),
})

const { data: agencies } = await useFetch(`/api/v1/payees/${payeeId}/agencies`, {
  lazy: true,
  query: computed(() => route.query),
})
const { data: categories } = await useFetch(`/api/v1/payees/${payeeId}/categories`, {
  lazy: true,
  query: computed(() => route.query),
})
const { data: trends } = await useFetch(`/api/v1/payees/${payeeId}/trends`, { lazy: true })

useSeoMeta({
  title: computed(() =>
    detail.value?.data?.payee_name
      ? `${detail.value.data.payee_name} | Vendor Profile`
      : 'Payee Explorer | Texas Spends',
  ),
  description: computed(
    () =>
      `Spending profile and revenue from state business for ${detail.value?.data?.payee_name || 'Vendor'} in Texas.`,
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
              <UIcon name="i-heroicons-user-group" class="w-5 h-5 shrink-0" /> Enterprise / Vendor
            </div>
            <h1 class="text-3xl font-bold text-[var(--ui-text)]">{{ detail.data.payee_name }}</h1>

            <!-- Vendor Master Data Block -->
            <div
              v-if="detail.data.vendor_name"
              class="mt-2 inline-flex items-center gap-2 px-3 py-1 bg-green-500/10 text-green-700 dark:text-green-400 rounded-full text-xs font-semibold uppercase tracking-wide"
            >
              <UIcon name="i-heroicons-check-badge" class="w-4 h-4" /> Matched to State Master
              Record
            </div>
          </div>
          <div class="text-left md:text-right">
            <p class="text-sm text-[var(--ui-text-muted)] uppercase tracking-wider">
              Total Received
            </p>
            <p class="text-4xl font-bold text-[var(--ui-primary)]">
              ${{ Number((detail.data as any).total_spend || 0).toLocaleString() }}
            </p>
          </div>
        </div>

        <div
          class="mt-6 border-t border-[var(--ui-border)] pt-4 grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          <div>
            <span class="text-xs text-[var(--ui-text-muted)] uppercase tracking-wider"
              >Payee ID</span
            >
            <p class="font-medium font-mono text-sm mt-1">{{ detail.data.payee_id }}</p>
          </div>
          <div v-if="detail.data.vendor_name">
            <span class="text-xs text-[var(--ui-text-muted)] uppercase tracking-wider"
              >Master DBA</span
            >
            <p class="font-medium text-sm mt-1 truncate" :title="detail.data.vendor_name">
              {{ detail.data.vendor_name }}
            </p>
          </div>
          <div v-if="(detail.data as any).hub_type">
            <span class="text-xs text-[var(--ui-text-muted)] uppercase tracking-wider"
              >HUB Status</span
            >
            <p class="font-medium text-sm mt-1">{{ (detail.data as any).hub_type }}</p>
          </div>
          <div v-if="(detail.data as any).address_city">
            <span class="text-xs text-[var(--ui-text-muted)] uppercase tracking-wider"
              >Location</span
            >
            <p class="font-medium text-sm mt-1">
              {{ (detail.data as any).address_city }}, {{ (detail.data as any).address_state }}
              {{ (detail.data as any).address_zip }}
            </p>
          </div>
        </div>
      </div>

      <div v-if="detail?.data" class="grid grid-cols-1 md:grid-cols-2 gap-8">
        <UCard>
          <template #header
            ><h3 class="font-semibold flex items-center gap-2">
              <UIcon name="i-heroicons-building-office" /> Supporting Agencies
            </h3></template
          >
          <ul class="space-y-3" v-if="agencies?.data?.length">
            <li
              v-for="agency in agencies.data"
              :key="agency.agency_id"
              class="flex justify-between items-center text-sm"
            >
              <NuxtLink
                :to="`/agencies/${agency.agency_id}`"
                class="truncate font-medium text-[var(--ui-primary)] hover:underline pr-4"
                >{{ agency.agency_name }}</NuxtLink
              >
              <span class="font-medium whitespace-nowrap"
                >${{ agency.amount.toLocaleString() }}</span
              >
            </li>
          </ul>
          <p v-else class="text-sm text-[var(--ui-text-muted)] text-center py-4">
            No agency data available.
          </p>
          <div class="mt-4 text-center">
            <UButton :to="`/transactions?payee_id=${payeeId}`" variant="link" color="primary"
              >View all ledger traces</UButton
            >
          </div>
        </UCard>

        <UCard>
          <template #header
            ><h3 class="font-semibold flex items-center gap-2">
              <UIcon name="i-heroicons-document-currency-dollar" /> Income Categories
            </h3></template
          >
          <ul class="space-y-3" v-if="categories?.data?.length">
            <li
              v-for="cat in categories.data"
              :key="cat.category_code"
              class="flex justify-between items-center text-sm"
            >
              <span class="truncate block pr-4" :title="cat.category_title">{{
                cat.category_title
              }}</span>
              <span class="font-medium whitespace-nowrap">${{ cat.amount.toLocaleString() }}</span>
            </li>
          </ul>
          <p v-else class="text-sm text-[var(--ui-text-muted)] text-center py-4">
            No category objects found.
          </p>
        </UCard>
      </div>
    </UContainer>
  </div>
</template>
