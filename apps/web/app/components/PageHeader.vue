<script setup lang="ts">
const props = defineProps<{
  title: string
  subtitle?: string
  eyebrow?: string
  badge?: string
  breadcrumbs?: { label: string; to?: string }[]
}>()

const hasBreadcrumbs = computed(() => Boolean(props.breadcrumbs?.length))
</script>

<template>
  <section
    class="relative overflow-hidden rounded-[1.75rem] border border-default bg-default/90 px-6 py-8 shadow-card sm:px-8"
  >
    <div class="pointer-events-none absolute inset-0 bg-[var(--gradient-accent)] opacity-60" />
    <div class="pointer-events-none absolute inset-0 tx-grid opacity-25" />

    <div class="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div class="max-w-3xl space-y-3">
        <UBreadcrumb v-if="hasBreadcrumbs" :items="breadcrumbs" class="text-xs text-muted" />
        <div class="flex flex-wrap items-center gap-3">
          <span
            v-if="eyebrow"
            class="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary"
          >
            {{ eyebrow }}
          </span>
          <UBadge v-if="badge" color="neutral" variant="soft" class="rounded-full px-3 py-1">
            {{ badge }}
          </UBadge>
        </div>
        <div class="space-y-2">
          <h1
            class="max-w-4xl font-sans text-4xl font-semibold tracking-tight text-default sm:text-5xl"
          >
            {{ title }}
          </h1>
          <p v-if="subtitle" class="max-w-2xl text-base leading-7 text-muted sm:text-lg">
            {{ subtitle }}
          </p>
        </div>
      </div>

      <div v-if="$slots.actions" class="relative shrink-0">
        <slot name="actions" />
      </div>
    </div>
  </section>
</template>
