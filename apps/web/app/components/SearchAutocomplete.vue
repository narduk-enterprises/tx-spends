<script setup lang="ts">
const props = defineProps<{
  placeholder?: string
}>()

const router = useRouter()
const state = reactive({
  query: '',
})

async function submitSearch() {
  const value = state.query.trim()
  if (!value) {
    return
  }

  await router.push({
    path: '/search',
    query: { q: value },
  })
}
</script>

<template>
  <UForm :state="state" class="w-full" @submit.prevent="submitSearch">
    <div
      class="flex items-center gap-2 rounded-full border border-default bg-default p-1 shadow-card"
    >
      <UInput
        v-model="state.query"
        name="hero-search"
        icon="i-lucide-search"
        :placeholder="props.placeholder || 'Search agencies, payees, counties, and objects'"
        class="w-full"
        variant="ghost"
        autocomplete="off"
        @keydown.enter.prevent="submitSearch"
      >
        <template #trailing>
          <UKbd v-if="!state.query">Enter</UKbd>
          <UButton
            v-else
            type="button"
            color="neutral"
            variant="ghost"
            icon="i-lucide-x"
            class="rounded-full"
            @click="state.query = ''"
          />
        </template>
      </UInput>

      <UButton type="submit" color="primary" class="rounded-full px-4" icon="i-lucide-arrow-right">
        Search
      </UButton>
    </div>
  </UForm>
</template>
