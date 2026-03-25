<script setup lang="ts">
const props = defineProps<{
  enrichment: Record<string, unknown>
  matchConfidence: number
}>()

const matchVariant = computed(() =>
  Number(props.matchConfidence) >= 0.98 ? 'Exact match' : 'Probable match',
)
</script>

<template>
  <div
    v-if="enrichment"
    class="rounded-[1.5rem] border border-default bg-default/80 p-4 shadow-card"
  >
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="space-y-2">
        <div class="flex items-center gap-2">
          <div
            class="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary"
          >
            <UIcon name="i-lucide-briefcase-business" class="size-5" />
          </div>
          <div>
            <p class="text-sm font-semibold text-default">
              {{
                enrichment.vendor_name ||
                enrichment.vendor_name_normalized ||
                enrichment.vendor_name_raw
              }}
            </p>
            <p class="text-xs text-muted">Procurement/vendor enrichment attached to this payee</p>
          </div>
        </div>

        <div class="flex flex-wrap gap-2">
          <UBadge color="neutral" variant="soft">{{ matchVariant }}</UBadge>
          <UBadge v-if="enrichment.hub_status" color="primary" variant="soft">HUB</UBadge>
          <UBadge v-if="enrichment.small_business_flag" color="primary" variant="soft"
            >Small business</UBadge
          >
          <UBadge v-if="enrichment.sdv_flag" color="error" variant="soft"
            >Service-disabled veteran</UBadge
          >
          <UBadge v-if="enrichment.city || enrichment.state" color="neutral" variant="soft">
            {{ [enrichment.city, enrichment.state].filter(Boolean).join(', ') }}
          </UBadge>
        </div>
      </div>

      <UTooltip
        text="Vendor enrichment is helpful context, not an authoritative payee identity match."
      >
        <div class="flex size-10 items-center justify-center rounded-full bg-elevated text-muted">
          <UIcon name="i-lucide-info" class="size-4" />
        </div>
      </UTooltip>
    </div>
  </div>
</template>
