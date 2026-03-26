<script setup lang="ts">
const props = defineProps<{
  slug: string
  title: string
  excerpt: string
  angleName: string
  publishedAt: string | Date | null
}>()

</script>

<template>
  <NuxtLink
    :to="`/blog/${slug}`"
    :prefetch="false"
    class="group flex flex-col gap-4 rounded-2xl border border-default bg-default p-5 transition-base hover:border-primary/30 hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
  >
    <div class="flex items-start justify-between gap-3">
      <UBadge color="primary" variant="soft" size="sm" class="shrink-0">
        {{ angleName }}
      </UBadge>
      <UIcon
        name="i-lucide-arrow-up-right"
        class="mt-0.5 size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
      />
    </div>

    <div class="flex-1 space-y-2">
      <h3 class="text-base font-semibold leading-snug text-default group-hover:text-primary">
        {{ title }}
      </h3>
      <p class="line-clamp-3 text-sm text-muted">
        {{ excerpt }}
      </p>
    </div>

    <div v-if="publishedAt" class="flex items-center gap-2 text-xs text-muted">
      <UIcon name="i-lucide-calendar" class="size-3.5 shrink-0" />
      <NuxtTime :datetime="publishedAt" year="numeric" month="short" day="numeric" />
    </div>
  </NuxtLink>
</template>
