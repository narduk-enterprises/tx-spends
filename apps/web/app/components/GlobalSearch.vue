<script setup lang="ts">
const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const router = useRouter()
const query = ref('')

type SearchEntity = {
  id: string
  name: string
  type: 'agency' | 'payee' | 'category' | 'object' | 'county'
}

const typeMeta: Record<SearchEntity['type'], { icon: string; prefix: string; label: string }> = {
  agency: { icon: 'i-lucide-building-2', prefix: '/agencies', label: 'Agencies' },
  payee: { icon: 'i-lucide-briefcase-business', prefix: '/payees', label: 'Payees' },
  category: { icon: 'i-lucide-chart-pie', prefix: '/categories', label: 'Categories' },
  object: { icon: 'i-lucide-badge-dollar-sign', prefix: '/objects', label: 'Objects' },
  county: { icon: 'i-lucide-map-pinned', prefix: '/counties', label: 'Counties' },
}

const payloadKeyMap: Record<
  SearchEntity['type'],
  'agencies' | 'payees' | 'categories' | 'objects' | 'counties'
> = {
  agency: 'agencies',
  payee: 'payees',
  category: 'categories',
  object: 'objects',
  county: 'counties',
}

const { data, status } = await useFetch('/api/v1/search', {
  server: false,
  query: computed(() => ({
    q: query.value || undefined,
  })),
  watch: [query],
})

const groups = computed(() => {
  const payload = data.value?.data
  if (!payload) {
    return []
  }

  return (['agency', 'payee', 'category', 'object', 'county'] as SearchEntity['type'][])
    .map((type) => {
      const items = ((payload[payloadKeyMap[type]] as SearchEntity[] | undefined) || []).map(
        (item) => ({
          id: item.id,
          label: item.name,
          suffix: typeMeta[type].label.slice(0, -1),
          icon: typeMeta[type].icon,
          to: `${typeMeta[type].prefix}/${item.id}`,
        }),
      )

      return {
        id: type,
        label: typeMeta[type].label,
        items,
      }
    })
    .filter((group) => group.items.length > 0)
})

async function onSelect(item: { to?: unknown }) {
  emit('update:open', false)
  query.value = ''

  if (typeof item.to === 'string' || (typeof item.to === 'object' && item.to !== null)) {
    await router.push(item.to as never)
  }
}
</script>

<template>
  <UModal
    :open="props.open"
    title="Search the explorer"
    description="Jump directly to agencies, payees, categories, objects, or counties."
    @update:open="emit('update:open', $event)"
  >
    <template #content>
      <div class="space-y-3 p-4">
        <div class="space-y-1 px-2 pt-2">
          <p class="text-base font-semibold text-default">Search the explorer</p>
          <p class="text-sm text-muted">
            Jump directly to agencies, payees, categories, objects, or counties.
          </p>
        </div>

        <UCommandPalette
          v-model:search-term="query"
          :loading="status === 'pending'"
          :groups="groups"
          placeholder="Start typing a Texas agency, payee, county, or category"
          @update:model-value="onSelect"
        />
      </div>
    </template>
  </UModal>
</template>
