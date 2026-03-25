<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  title: string
  subtitle?: string
  breadcrumbs?: { label: string; to?: string }[]
}>()

const hasBreadcrumbs = computed(() => props.breadcrumbs && props.breadcrumbs.length > 0)
</script>

<template>
  <div class="mb-8 flex flex-col gap-2">
    <UBreadcrumb v-if="hasBreadcrumbs" :items="breadcrumbs" class="mb-2" />
    <h1 class="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
      {{ title }}
    </h1>
    <p v-if="subtitle" class="text-lg text-gray-500 dark:text-gray-400">
      {{ subtitle }}
    </p>
  </div>
</template>
