<script setup lang="ts">
const title = 'Data Sources'
const description =
  'Primary Texas Comptroller data sources powering the explorer, how they are accessed, and what each one can honestly support.'

const sourceGroups = [
  {
    title: 'Primary explorer sources',
    description:
      'These are the sources that directly drive the product surface users see on tx-spends.org.',
    items: [
      {
        name: 'Payments to Payee',
        role: 'Transaction layer',
        cadence: 'Near-daily public dashboard',
        access: 'Exported from the Comptroller transparency portal',
        limitations:
          'No public vendor IDs or payment geography, so payee enrichment stays probabilistic and county joins stay separate.',
        href: 'https://comptroller.texas.gov/transparency/spending/',
      },
      {
        name: 'Texas State Expenditures by County',
        role: 'County geography layer',
        cadence: 'Annual fiscal-year reports',
        access: 'Published as county expenditure reports and open data slices',
        limitations:
          'This is an annual aggregation layer, not a geocoded rollup of individual payment rows.',
        href: 'https://comptroller.texas.gov/transparency/reports/expenditures-by-county/',
      },
      {
        name: 'Comptroller object and category taxonomies',
        role: 'Rollups and drilldowns',
        cadence: 'Slow-moving reference tables',
        access: 'Reference tables and transparency taxonomy extracts',
        limitations:
          'Some category mappings require a crosswalk because the payment feed and county layer expose different category shapes.',
        href: 'https://comptroller.texas.gov/transparency/spending/',
      },
    ],
  },
  {
    title: 'Supporting and enrichment sources',
    description:
      'These sources strengthen context and matching, but they do not override the limits of the public payment feed.',
    items: [
      {
        name: 'Vendor master downloads',
        role: 'Procurement enrichment',
        cadence: 'Nightly or current-state downloads',
        access: 'Downloadable Comptroller purchasing files',
        limitations:
          'Matched by normalized names rather than a released payment-side vendor ID, so the app labels these matches as approximate.',
        href: 'https://comptroller.texas.gov/purchasing/downloads/',
      },
      {
        name: 'Annual Cash Report',
        role: 'Macro context and reconciliation',
        cadence: 'Annual publication',
        access: 'Official annual report with downloadable spreadsheets',
        limitations:
          'Useful for fund-level statewide context, not transaction-level browsing or payee analysis.',
        href: 'https://comptroller.texas.gov/transparency/reports/cash-report/',
      },
    ],
  },
] as const

const implementationNotes = [
  'The transaction feed is exported from the public Qlik interface because the portal does not expose a stable bulk API for the Payments to Payee view.',
  'County pages are backed by a separate annual fact table so the app never invents transaction-level geography that the public source data does not provide.',
  'Vendor enrichment is stored as a distinct layer with explicit match records, confidence, and review status instead of being hidden in application code.',
]

useSeo({
  title,
  description,
  ogImage: {
    title,
    description,
    icon: 'i-lucide-database',
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
      eyebrow="Data Sources"
      :title="title"
      :subtitle="description"
      badge="Public-source inventory"
      :breadcrumbs="[{ label: 'Home', to: '/' }, { label: 'Data Sources' }]"
    />

    <section class="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.9fr)]">
      <UCard class="card-base overflow-hidden">
        <template #header>
          <div class="space-y-1">
            <p class="text-lg font-semibold text-default">What powers the explorer</p>
            <p class="text-sm text-muted">
              Texas State Spending Explorer is intentionally built on public Texas Comptroller
              sources that can be refreshed and audited without inventing hidden joins.
            </p>
          </div>
        </template>

        <div class="grid gap-3 sm:grid-cols-3">
          <div class="rounded-[1.25rem] border border-default bg-elevated/40 p-4">
            <p class="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Payments</p>
            <p class="mt-2 text-sm text-muted">State payment exports across available fiscal years.</p>
          </div>
          <div class="rounded-[1.25rem] border border-default bg-elevated/40 p-4">
            <p class="text-xs font-semibold uppercase tracking-[0.14em] text-primary">County layer</p>
            <p class="mt-2 text-sm text-muted">Annual county-level distribution of state spending.</p>
          </div>
          <div class="rounded-[1.25rem] border border-default bg-elevated/40 p-4">
            <p class="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Enrichment</p>
            <p class="mt-2 text-sm text-muted">Taxonomies, vendor files, and statewide context tables.</p>
          </div>
        </div>
      </UCard>

      <UCard class="card-base overflow-hidden">
        <template #header>
          <div class="space-y-1">
            <p class="text-lg font-semibold text-default">Implementation notes</p>
            <p class="text-sm text-muted">
              These rules keep the product honest when the public data is fragmented or incomplete.
            </p>
          </div>
        </template>

        <div class="space-y-3">
          <div
            v-for="note in implementationNotes"
            :key="note"
            class="rounded-[1.25rem] border border-default bg-elevated/40 px-4 py-3 text-sm leading-7 text-muted"
          >
            {{ note }}
          </div>
        </div>
      </UCard>
    </section>

    <section
      v-for="group in sourceGroups"
      :key="group.title"
      class="space-y-4"
    >
      <div class="space-y-1">
        <h2 class="text-2xl font-semibold tracking-tight text-default">{{ group.title }}</h2>
        <p class="max-w-3xl text-sm leading-7 text-muted">{{ group.description }}</p>
      </div>

      <div class="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <UCard
          v-for="source in group.items"
          :key="source.name"
          class="card-base overflow-hidden"
        >
          <template #header>
            <div class="space-y-3">
              <div class="flex flex-wrap items-center gap-2">
                <UBadge color="primary" variant="soft" class="rounded-full px-3 py-1">
                  {{ source.role }}
                </UBadge>
                <UBadge color="neutral" variant="outline" class="rounded-full px-3 py-1">
                  {{ source.cadence }}
                </UBadge>
              </div>
              <div>
                <p class="text-lg font-semibold text-default">{{ source.name }}</p>
                <p class="mt-1 text-sm text-muted">{{ source.access }}</p>
              </div>
            </div>
          </template>

          <div class="space-y-4">
            <div class="rounded-[1.25rem] border border-default bg-elevated/40 p-4">
              <p class="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                Product limitation
              </p>
              <p class="mt-2 text-sm leading-7 text-muted">{{ source.limitations }}</p>
            </div>

            <UButton
              :to="source.href"
              target="_blank"
              rel="noopener noreferrer"
              color="neutral"
              variant="soft"
              class="w-full justify-between rounded-2xl px-4 py-3"
              trailing-icon="i-lucide-arrow-up-right"
            >
              Open official source
            </UButton>
          </div>
        </UCard>
      </div>
    </section>
  </UContainer>
</template>
