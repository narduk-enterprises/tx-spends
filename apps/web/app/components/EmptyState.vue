<script setup lang="ts">
defineProps<{
  title: string
  description: string
  icon?: string
  actionLabel?: string
}>()

defineEmits(['action'])
</script>

<template>
  <div class="flex flex-col items-center justify-center p-12 text-center rounded-xl border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
    <UIcon
      v-if="icon"
      :name="icon"
      class="w-12 h-12 text-gray-400 dark:text-gray-500 mb-4"
    />
    <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-1">
      {{ title }}
    </h3>
    <p class="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto mb-6">
      {{ description }}
    </p>
    <UButton
      v-if="actionLabel"
      color="primary"
      variant="outline"
      @click="$emit('action')"
    >
      {{ actionLabel }}
    </UButton>
    <slot />
  </div>
</template>
