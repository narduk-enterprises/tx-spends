<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{
  error: NuxtError
}>()

const title = computed(() => {
  const code = props.error?.statusCode
  if (code === 404) return 'Page not found'
  if (code === 403) return 'Access denied'
  if (code === 401) return 'Not authenticated'
  return 'Something went wrong'
})

const description = computed(() => {
  const code = props.error?.statusCode
  if (code === 404) return "The page you're looking for doesn't exist or has been moved."
  if (code === 403) return "You don't have permission to access this resource."
  if (code === 401) return 'Please sign in to access this page.'
  return 'An unexpected error occurred. Please try again later.'
})

const errorTitle = computed(() => `${props.error?.statusCode || 'Error'} — ${title.value}`)

function handleError() {
  clearError({ redirect: '/' })
}

function refreshPage() {
  clearError()
  if (import.meta.client) {
    window.location.reload()
  }
}

useSeo({
  title: errorTitle,
  description,
  robots: 'noindex, nofollow',
})

useWebPageSchema({
  name: errorTitle,
  description,
  type: 'WebPage',
})
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-default px-4">
    <div class="max-w-md text-center">
      <p class="mb-2 font-display text-7xl font-bold text-primary">
        {{ error?.statusCode || 500 }}
      </p>

      <h1 class="mb-3 text-2xl font-semibold text-primary">
        {{ title }}
      </h1>

      <p class="mb-8 text-muted">
        {{ description }}
      </p>

      <div class="flex flex-col items-center justify-center gap-3 sm:flex-row">
        <UButton size="lg" icon="i-lucide-home" @click="handleError"> Go Home </UButton>
        <UButton
          size="lg"
          variant="ghost"
          color="neutral"
          icon="i-lucide-refresh-cw"
          @click="refreshPage"
        >
          Try Again
        </UButton>
      </div>
    </div>
  </div>
</template>
