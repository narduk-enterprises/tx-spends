<script setup lang="ts">
const title = 'About Texas State Spending Explorer'
const description =
  'Why this product exists, what it covers, and how it scopes Texas state spending honestly.'

useSeo({
  title,
  description,
  ogImage: {
    title,
    description,
    icon: 'i-lucide-landmark',
  },
})

useWebPageSchema({
  name: title,
  description,
  type: 'AboutPage',
})
</script>

<template>
  <UContainer class="space-y-8 py-8">
    <PageHeader
      eyebrow="About"
      :title="title"
      :subtitle="description"
      :breadcrumbs="[{ label: 'Home', to: '/' }, { label: 'About' }]"
    />

    <section class="grid gap-6 lg:grid-cols-2">
      <UCard class="card-base">
        <template #header>
          <p class="text-lg font-semibold text-default">What this app is</p>
        </template>
        <div class="space-y-4 text-sm leading-7 text-muted">
          <p>
            Texas State Spending Explorer is a public-facing tool for understanding Texas state
            treasury spending, who agencies pay, how spending is categorized, and where state
            dollars land by county.
          </p>
          <p>
            It is designed for journalists, researchers, watchdog groups, policy staff, and
            residents who want a cleaner interface over messy public finance data.
          </p>
        </div>
      </UCard>

      <UCard class="card-base">
        <template #header>
          <p class="text-lg font-semibold text-default">What this app is not</p>
        </template>
        <div class="space-y-4 text-sm leading-7 text-muted">
          <p>
            It is not a full local-government ledger explorer. The underlying public data does not
            expose transaction-level county geography, city-level geography, or authoritative vendor
            IDs on payment rows.
          </p>
          <p>
            The product is intentionally scoped to Texas state spending plus the annual county
            distribution layer published by the Texas Comptroller.
          </p>
        </div>
      </UCard>
    </section>
  </UContainer>
</template>
