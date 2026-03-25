<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  enrichment: any
  matchConfidence: number
}>()

const isHighConfidence = computed(() => Number(props.matchConfidence) >= 0.98)
</script>

<template>
  <div
    v-if="enrichment"
    class="flex flex-wrap items-center gap-3 py-3 border-y border-gray-200 dark:border-gray-800 my-4"
  >
    <div
      class="flex items-center gap-1.5 line-clamp-1 text-sm font-medium text-gray-700 dark:text-gray-300"
    >
      <UIcon name="i-heroicons-building-office-2" class="w-4 h-4 text-gray-400" />
      {{ enrichment.vendor_name_normalized }}
    </div>

    <!-- Match Confidence Indicator -->
    <UBadge :color="isHighConfidence ? 'success' : 'warning'" variant="subtle" size="sm">
      {{ isHighConfidence ? 'Exact Match' : 'Probable Match' }}
    </UBadge>

    <!-- Specific enrichment badges -->
    <UBadge v-if="enrichment.hub_status" color="primary" variant="subtle" size="sm"> HUB </UBadge>

    <UBadge v-if="enrichment.small_business_flag" color="primary" variant="subtle" size="sm">
      Small Business
    </UBadge>

    <UBadge v-if="enrichment.sdv_flag" color="error" variant="subtle" size="sm">
      Service-Disabled Veteran
    </UBadge>

    <UTooltip
      text="Vendor enrichment is non-authoritative due to lack of public IDs in payment records."
    >
      <UIcon
        name="i-heroicons-information-circle"
        class="w-4 h-4 text-gray-400 cursor-help ml-auto"
      />
    </UTooltip>
  </div>
</template>
