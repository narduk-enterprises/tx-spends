<script setup lang="ts">
useSeoMeta({ title: 'Data Sources | Texas Spends' })
</script>

<template>
  <UContainer class="py-12 max-w-3xl">
    <h1 class="text-4xl font-bold mb-6">Data Sources</h1>
    <div class="prose dark:prose-invert">
      <p>
        The databases mapping institutional Texas spending rely directly on public datasets
        periodically sourced from the <strong>Texas Comptroller of Public Accounts</strong>.
      </p>
      <ul>
        <li>
          <strong>State Payment Facts:</strong> Nightly data ingestion parsing "Payments to Payees"
          PowerBI exports via Playwright.
        </li>
        <li>
          <strong>County Expenditures:</strong> Detailed reports tracking flow parameters into all
          254 counties.
        </li>
        <li>
          <strong>Vendor Master List:</strong> HUB and Location resolution utilizing the Centralized
          Master Bidders List (CMBL).
        </li>
      </ul>
      <p>Source integrity is maintained via deterministic SHA-256 deduplication.</p>
    </div>
  </UContainer>
</template>
