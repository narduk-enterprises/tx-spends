<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from '#app'

defineProps<{
  placeholder?: string
}>()

const router = useRouter()
const query = ref('')

function onSubmit() {
  if (!query.value.trim()) return
  router.push({
    path: '/search',
    query: { q: query.value.trim() },
  })
}
</script>

<template>
  <UForm :state="{}" @submit="onSubmit" class="relative w-full max-w-sm">
    <UInput
      v-model="query"
      icon="i-heroicons-magnifying-glass"
      :placeholder="placeholder || 'Search agencies, payees...'"
      size="md"
      class="w-full"
      autocomplete="off"
    >
      <template #trailing>
        <UKbd v-if="!query">Enter</UKbd>
        <UButton
          v-else
          color="neutral"
          variant="link"
          icon="i-heroicons-x-mark"
          :padded="false"
          @click="query = ''"
        />
      </template>
    </UInput>
  </UForm>
</template>
