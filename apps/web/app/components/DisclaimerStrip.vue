<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  variant: 'global' | 'county' | 'payee' | 'transactions'
}>()

const disclaimerCopy = computed(() => {
  switch (props.variant) {
    case 'county':
      return 'County views show annual county-level state expenditures from the Comptroller’s county expenditure reports. They are not derived from geocoding individual payment transactions.'
    case 'payee':
      return 'Vendor enrichment is based on public procurement/vendor files and name-based matching where available. Some matches may be incomplete or approximate because public payment outputs do not include public vendor IDs.'
    case 'transactions':
      return 'Some transactions are masked or aggregated in the public source data due to confidentiality rules.'
    case 'global':
    default:
      return 'This product explores Texas state spending data published by the Texas Comptroller and related state transparency sources. It is not a complete ledger for all local governments in Texas.'
  }
})
</script>

<template>
  <div class="mb-6">
    <UAlert
      icon="i-heroicons-information-circle"
      color="primary"
      variant="soft"
      :title="disclaimerCopy"
    />
  </div>
</template>
