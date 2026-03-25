<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const code = route.params.code as string

const { data: detail, status: detailStatus } = await useFetch(`/api/v1/categories/${code}`, {
  query: computed(() => route.query),
})

const { data: agencies } = await useFetch(`/api/v1/categories/${code}/agencies`, {
  lazy: true,
  query: computed(() => route.query),
})
const { data: payees } = await useFetch(`/api/v1/categories/${code}/payees`, {
  lazy: true,
  query: computed(() => route.query),
})
const { data: objects } = await useFetch(`/api/v1/categories/${code}/objects`, {
  lazy: true,
  query: computed(() => route.query),
})
const { data: trends } = await useFetch(`/api/v1/categories/${code}/trends`, { lazy: true })

useSeoMeta({
  title: computed(() =>
    detail.value?.data?.category_title
      ? `${detail.value.data.category_title} | Category Explorer`
      : 'Category Explorer | Texas Spends',
  ),
  description: computed(
    () =>
      `Spending profile for ${detail.value?.data?.category_title || 'Expenditure Category'} in Texas.`,
  ),
})
</script>

<template>
  <div>
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
              <UIcon name="i-heroicons-tag" class="w-5 h-5 shrink-0" /> Expenditure Category
            </div>
            <h1 class="text-3xl font-bold text-[var(--ui-text)]">
              {{ detail.data.category_title }}
              <span class="text-xl text-[var(--ui-text-muted)] font-mono"
                >({{ detail.data.category_code }})</span
              >
            </h1>
          </div>
          <div class="text-left md:text-right">
            <p class="text-sm text-[var(--ui-text-muted)] uppercase tracking-wider">
              Category Spend
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
        </UCard>
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
          <div class="mt-4 text-center">
            <UButton :to="`/transactions?category_code=${code}`" variant="link" color="primary"
              >View all ledger traces</UButton
            >
          </div>
        </UCard>
        <UCard class="md:col-span-2">
          <template #header
            ><h3 class="font-semibold flex items-center gap-2">
              <UIcon name="i-heroicons-document-currency-dollar" /> Objects Under Category
            </h3></template
          >
          <ul class="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3" v-if="objects?.data?.length">
            <li
              v-for="obj in objects.data"
              :key="obj.object_code"
              class="flex justify-between items-center text-sm"
            >
              <span class="truncate pr-4" :title="obj.object_title">{{ obj.object_title }}</span>
              <span class="font-medium whitespace-nowrap">${{ obj.amount.toLocaleString() }}</span>
            </li>
          </ul>
        </UCard>
      </div>
    </UContainer>
  </div>
</template>
