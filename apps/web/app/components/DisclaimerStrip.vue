<script setup lang="ts">
const props = defineProps<{
  variant: 'global' | 'county' | 'payee' | 'transactions'
}>()

const disclaimer = computed(() => {
  switch (props.variant) {
    case 'county':
      return {
        title: 'County views are an annual geography layer.',
        description:
          'County totals come from the Comptroller annual county expenditure reports, not from geocoding individual payment rows.',
      }
    case 'payee':
      return {
        title: 'Vendor enrichment is approximate.',
        description:
          'Public payment outputs do not expose vendor IDs, so procurement enrichment depends on name matching and manual review.',
      }
    case 'transactions':
      return {
        title: 'Transaction rows may be masked or aggregated.',
        description:
          'Confidential rows can appear obfuscated in the public source data. Geography is intentionally unavailable at the transaction level.',
      }
    case 'global':
    default:
      return {
        title: 'This is a Texas state spending explorer.',
        description:
          'The app analyzes Comptroller state transparency datasets and county distribution reports. It is not a full ledger for local governments in Texas.',
      }
  }
})
</script>

<template>
  <UAlert
    :title="disclaimer.title"
    :description="disclaimer.description"
    icon="i-lucide-info"
    color="primary"
    variant="soft"
    class="rounded-[1.25rem]"
  />
</template>
