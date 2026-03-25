<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const countyId = route.params.id as string

const { data: detail, status: detailStatus } = await useFetch(`/api/v1/counties/${countyId}`, {
  query: computed(() => route.query),
})

const { data: agencies } = await useFetch(`/api/v1/counties/${countyId}/agencies`, {
  lazy: true,
  query: computed(() => route.query),
})
const { data: types } = await useFetch(`/api/v1/counties/${countyId}/expenditure-types`, {
  lazy: true,
  query: computed(() => route.query),
})
const { data: trends } = await useFetch(`/api/v1/counties/${countyId}/trends`, { lazy: true })

useSeoMeta({
  title: computed(() =>
    detail.value?.data?.county_name
      ? `${detail.value.data.county_name} County | Texas Spends`
      : 'County Explorer | Texas Spends',
  ),
  description: computed(
    () => `Explore local state spending flowing into ${detail.value?.data?.county_name} County.`,
  ),
})
</script>

<template>
  <div>
    <FilterBar />
    <UContainer class="py-8">
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
              <UIcon name="i-heroicons-map" class="w-5 h-5 shrink-0" /> Target County
            </div>
            <h1 class="text-3xl font-bold text-[var(--ui-text)]">
              {{ detail.data.county_name }} County
            </h1>
          </div>
          <div class="text-left md:text-right">
            <p class="text-sm text-[var(--ui-text-muted)] uppercase tracking-wider">
              Local Total Spend
            </p>
            <p class="text-4xl font-bold text-[var(--ui-primary)]">
              ${{ Number((detail.data as any).total_spend || 0).toLocaleString() }}
            </p>
          </div>
        </div>
      </div>

      <div v-if="detail?.data" class="grid grid-cols-1 md:grid-cols-2 gap-8">
        <UCard>
          <template #header
            ><h3 class="font-semibold flex items-center gap-2">
              <UIcon name="i-heroicons-building-office" /> Local Spend from Agencies
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
        </UCard>
        <UCard>
          <template #header
            ><h3 class="font-semibold flex items-center gap-2">
              <UIcon name="i-heroicons-tag" /> Local Categories of Spend
            </h3></template
          >
          <ul class="space-y-3" v-if="types?.data?.length">
            <li
              v-for="cat in types.data"
              :key="cat.category_code"
              class="flex justify-between items-center text-sm"
            >
              <NuxtLink
                :to="`/categories/${cat.category_code}`"
                class="truncate font-medium text-[var(--ui-primary)] hover:underline pr-4"
                >{{ cat.category_title }}</NuxtLink
              >
              <span class="font-medium whitespace-nowrap">${{ cat.amount.toLocaleString() }}</span>
            </li>
          </ul>
        </UCard>
      </div>
    </UContainer>
  </div>
</template>
