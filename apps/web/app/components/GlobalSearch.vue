<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()
const router = useRouter()

const query = ref('')

// In Nuxt 4, we debounce visually but useFetch can run reactively
const { data, status } = await useFetch('/api/v1/search', {
  query: { q: query },
  immediate: false,
  watch: [query],
})

const items = computed(() => {
  if (!(data.value?.data as any)?.results) return []
  return (((data.value?.data as any)?.results || []) as any[]).map((r: any) => ({
    id: r.id,
    label: r.name,
    icon:
      r.type === 'agency'
        ? 'i-heroicons-building-office'
        : r.type === 'payee'
          ? 'i-heroicons-user-group'
          : 'i-heroicons-map',
    to: `/${r.type === 'agency' ? 'agencies' : r.type === 'payee' ? 'payees' : 'counties'}/${r.id}`,
  }))
})

function onSelect(item: any) {
  emit('update:open', false)
  if (item.to) router.push(item.to)
}
</script>

<template>
  <UModal :open="open" @update:open="emit('update:open', $event)">
    <UCommandPalette
      v-model:search-term="query"
      :loading="status === 'pending'"
      :groups="[{ id: 'results', items: items }]"
      placeholder="Search agencies, payees, or counties..."
      @update:model-value="onSelect"
    />
  </UModal>
</template>
