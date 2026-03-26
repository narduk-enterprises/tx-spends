<script setup lang="ts">
const props = defineProps<{
  busyAction?: 'draft' | 'published' | null
}>()

const emit = defineEmits<{
  generateDraft: []
  publishNow: []
}>()
</script>

<template>
  <UCard class="card-base border-default">
    <div class="space-y-4">
      <div class="space-y-1">
        <p class="text-xs font-semibold uppercase tracking-wider text-primary">Generate</p>
        <h2 class="text-lg font-semibold text-default">Spotlight workflow</h2>
        <p class="text-sm text-muted">
          Use the same analyzer and generator pipeline that powers the weekday cron job, but from a
          protected admin surface.
        </p>
      </div>

      <div class="grid gap-3 sm:grid-cols-2">
        <UButton
          color="primary"
          icon="i-lucide-wand-sparkles"
          :loading="busyAction === 'draft'"
          :disabled="busyAction !== null"
          @click="emit('generateDraft')"
        >
          Generate draft
        </UButton>

        <UButton
          color="neutral"
          variant="soft"
          icon="i-lucide-send"
          :loading="busyAction === 'published'"
          :disabled="busyAction !== null"
          @click="emit('publishNow')"
        >
          Publish today&apos;s spotlight
        </UButton>
      </div>

      <p class="text-xs text-muted">
        Manual publish still honors the one-post-per-day guard; if today already has a live
        spotlight, the existing post is returned instead of creating a duplicate.
      </p>
    </div>
  </UCard>
</template>
