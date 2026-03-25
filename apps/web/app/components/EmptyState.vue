<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string
    description: string
    icon?: string
    actionLabel?: string
  }>(),
  {
    icon: 'i-lucide-inbox',
    actionLabel: '',
  },
)

defineEmits<{ action: [] }>()
</script>

<template>
  <div class="rounded-[1.5rem] border border-dashed border-default bg-elevated/60 p-8">
    <AppEmptyState :title="title" :description="description" :icon="icon">
      <UButton
        v-if="actionLabel"
        color="primary"
        variant="soft"
        class="rounded-full"
        @click="$emit('action')"
      >
        {{ actionLabel }}
      </UButton>
      <slot />
    </AppEmptyState>
  </div>
</template>
