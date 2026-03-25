<script setup lang="ts">
useSeoMeta({ title: 'Methodology | Texas Spends' })
</script>

<template>
  <UContainer class="py-12 max-w-3xl">
    <h1 class="text-4xl font-bold mb-6">Methodology</h1>
    <div class="prose dark:prose-invert">
      <p>
        Data is primarily pulled from state-published open data CSVs and dynamically updated scraped
        facts. Due to obfuscation requirements (e.g., SPEC 10.7), some confidential personal
        information is stripped or merged to ensure privacy while maintaining macro aggregate
        accuracy.
      </p>
      <p>
        A fuzzy-matching algorithm driven by `pg_trgm` links disparate payees (with typos or
        alternate acronyms) to a centralized Vendor Master list indicating HUB status and
        standardized business location.
      </p>
    </div>
  </UContainer>
</template>
