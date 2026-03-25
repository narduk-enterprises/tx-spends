<script setup lang="ts">
const title = 'Methodology'
const description =
  'How the explorer models Texas state spending, county distribution, and vendor enrichment.'

useSeo({
  title,
  description,
  ogImage: {
    title,
    description,
    icon: 'i-lucide-flask-conical',
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
      eyebrow="Methodology"
      :title="title"
      :subtitle="description"
      :breadcrumbs="[{ label: 'Home', to: '/' }, { label: 'Methodology' }]"
    />

    <section class="grid gap-6 lg:grid-cols-2">
      <UCard class="card-base">
        <template #header>
          <p class="text-lg font-semibold text-default">Data model</p>
        </template>
        <div class="space-y-4 text-sm leading-7 text-muted">
          <p>
            The app uses two fact tables: one transactional state payment layer and one annual
            county expenditure layer. They are related conceptually, but they are not merged into a
            fake geography model.
          </p>
          <p>
            Payments drive payee, agency, object, and transaction analysis. County expenditure
            reports drive maps and county detail pages.
          </p>
        </div>
      </UCard>

      <UCard class="card-base">
        <template #header>
          <p class="text-lg font-semibold text-default">Vendor enrichment</p>
        </template>
        <div class="space-y-4 text-sm leading-7 text-muted">
          <p>
            Procurement/vendor enrichment is stored separately and linked to payees through explicit
            match records. Public payment outputs do not include vendor IDs, so these matches are
            approximate by design.
          </p>
          <p>
            The UI always presents enrichment as context, not as an authoritative identity claim.
          </p>
        </div>
      </UCard>
    </section>
  </UContainer>
</template>
