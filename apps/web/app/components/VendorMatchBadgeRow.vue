<script setup lang="ts">
type VendorEnrichment = {
  vendor_name?: string | null
  hub_status?: string | null
  small_business_flag?: boolean | null
  sdv_flag?: boolean | null
  city?: string | null
  county?: string | null
  state?: string | null
  zip?: string | null
  is_manual_override?: boolean | null
  review_status?: string | null
}

const props = defineProps<{
  enrichment: VendorEnrichment
  matchConfidence: number
  matchMethod?: string | null
}>()

const confidencePercent = computed(() => Math.round(Number(props.matchConfidence) * 100))

const isExactMatch = computed(() => props.matchMethod === 'exact_normalized')

const matchLabel = computed(() => {
  if (isExactMatch.value) return 'Exact match'
  if (confidencePercent.value > 0)
    return `Approximate match — ${confidencePercent.value}% confidence`
  return 'Matched vendor'
})

const matchColor = computed<'success' | 'warning'>(() =>
  isExactMatch.value ? 'success' : 'warning',
)

const locationLabel = computed(() => {
  const parts = [props.enrichment.city, props.enrichment.state].filter(Boolean)
  return parts.length > 0 ? parts.join(', ') : null
})
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
              {{ enrichment.vendor_name }}
            </p>
            <p class="text-xs text-muted">Procurement/vendor enrichment attached to this payee</p>
          </div>
        </div>

        <div class="flex flex-wrap gap-2">
          <UBadge :color="matchColor" variant="soft">{{ matchLabel }}</UBadge>
          <UBadge v-if="enrichment.is_manual_override" color="info" variant="soft">
            Manual override
          </UBadge>
          <UBadge v-if="enrichment.hub_status" color="primary" variant="soft">
            HUB — {{ enrichment.hub_status }}
          </UBadge>
          <UBadge v-if="enrichment.small_business_flag" color="primary" variant="soft">
            Small business
          </UBadge>
          <UBadge v-if="enrichment.sdv_flag" color="error" variant="soft">
            Service-disabled veteran
          </UBadge>
          <UBadge v-if="enrichment.state === 'TX'" color="neutral" variant="soft">
            Texas vendor
          </UBadge>
          <UBadge v-else-if="locationLabel" color="neutral" variant="soft">
            {{ locationLabel }}
          </UBadge>
        </div>

        <p v-if="!isExactMatch" class="text-xs text-muted">
          This match is based on name similarity and may not be an exact identity match.
        </p>
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
