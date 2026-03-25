<script setup lang="ts">
const title = 'Disclaimers'
const description =
  'Important scope, matching, confidentiality, and geography limitations for Texas State Spending Explorer.'

useSeo({
  title,
  description,
  ogImage: {
    title,
    description,
    icon: 'i-lucide-triangle-alert',
  },
})

useWebPageSchema({
  name: title,
  description,
})
</script>

<template>
  <UContainer class="space-y-8 py-8">
    <PageHeader
      eyebrow="Disclaimers"
      :title="title"
      :subtitle="description"
      :breadcrumbs="[{ label: 'Home', to: '/' }, { label: 'Disclaimers' }]"
    />

    <section class="grid gap-6 lg:grid-cols-2">
      <UCard class="card-base">
        <template #header>
          <p class="text-lg font-semibold text-default">Scope disclaimer</p>
        </template>
        <p class="text-sm leading-7 text-muted">
          This product explores Texas state spending data published by the Texas Comptroller and
          related state transparency sources. It is not a complete ledger for all local governments
          in Texas.
        </p>
      </UCard>

      <UCard class="card-base">
        <template #header>
          <p class="text-lg font-semibold text-default">Geography disclaimer</p>
        </template>
        <p class="text-sm leading-7 text-muted">
          County pages use annual county expenditure reports. They are not derived from geocoding
          individual payment transactions, and transaction pages intentionally omit county fields.
        </p>
      </UCard>

      <UCard class="card-base">
        <template #header>
          <p class="text-lg font-semibold text-default">Vendor enrichment disclaimer</p>
        </template>
        <p class="text-sm leading-7 text-muted">
          Vendor enrichment depends on name matching because public payment outputs do not include
          public vendor IDs. Some matches may be incomplete or approximate.
        </p>
      </UCard>

      <UCard class="card-base">
        <template #header>
          <p class="text-lg font-semibold text-default">Confidentiality disclaimer</p>
        </template>
        <p class="text-sm leading-7 text-muted">
          Some transactions are masked or aggregated in the public source data. When a row is marked
          confidential, the explorer preserves that limitation instead of inventing hidden detail.
        </p>
      </UCard>
    </section>
  </UContainer>
</template>
