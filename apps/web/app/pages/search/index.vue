<script setup lang="ts">
import { cleanQueryObject, getStringQueryValue } from '~/utils/explorer'

const route = useRoute()
const router = useRouter()

const searchQuery = computed(() => getStringQueryValue(route.query.q))

const { data, status } = await useFetch('/api/v1/search', {
  query: computed(() =>
    cleanQueryObject({
      q: searchQuery.value,
    }),
  ),
})

const groups = computed(() => [
  { title: 'Agencies', items: data.value?.data?.agencies || [], prefix: '/agencies' },
  { title: 'Payees', items: data.value?.data?.payees || [], prefix: '/payees' },
  { title: 'Categories', items: data.value?.data?.categories || [], prefix: '/categories' },
  { title: 'Objects', items: data.value?.data?.objects || [], prefix: '/objects' },
  { title: 'Counties', items: data.value?.data?.counties || [], prefix: '/counties' },
])

const title = searchQuery.value
  ? `Search results for “${searchQuery.value}”`
  : 'Search the Texas State Spending Explorer'
const description =
  'Search agencies, payees, categories, objects, and counties in the Texas State Spending Explorer.'

useSeo({
  title,
  description,
  robots: 'noindex,follow',
  ogImage: {
    title,
    description,
    icon: 'i-lucide-search',
  },
})

useWebPageSchema({
  name: title,
  description,
  type: 'SearchResultsPage',
})

const searchInput = computed({
  get: () => ({
    q: searchQuery.value || null,
  }),
  set: (value: { q: string | null }) => {
    router.replace({
      query: cleanQueryObject({
        q: value.q || undefined,
      }),
    })
  },
})
</script>

<template>
  <UContainer class="space-y-8 py-8">
    <PageHeader
      eyebrow="Search"
      title="Search the explorer"
      subtitle="Find agencies, payees, categories, objects, and counties."
      :breadcrumbs="[{ label: 'Home', to: '/' }, { label: 'Search' }]"
      badge="Noindex page"
    />

    <FilterBar
      v-model="searchInput"
      :available-filters="[
        {
          key: 'q',
          label: 'Search query',
          type: 'input',
          placeholder: 'Start with an agency, county, payee, or object code',
        },
      ]"
    />

    <div v-if="status === 'pending'" class="flex min-h-48 items-center justify-center">
      <UIcon name="i-lucide-loader-circle" class="size-10 animate-spin text-primary" />
    </div>

    <template v-else-if="searchQuery">
      <section class="grid gap-6 lg:grid-cols-2">
        <UCard v-for="group in groups" :key="group.title" class="card-base overflow-hidden">
          <template #header>
            <div class="space-y-1">
              <p class="text-lg font-semibold text-default">{{ group.title }}</p>
              <p class="text-sm text-muted">Matching results for “{{ searchQuery }}”.</p>
            </div>
          </template>

          <div v-if="group.items.length" class="grid gap-2">
            <UButton
              v-for="item in group.items"
              :key="item.id"
              :to="`${group.prefix}/${item.id}`"
              color="neutral"
              variant="ghost"
              class="justify-between rounded-2xl border border-default px-4 py-3 text-left hover:border-primary/20 hover:bg-primary/5"
            >
              <span class="truncate font-semibold text-default">{{ item.name }}</span>
              <UIcon name="i-lucide-arrow-right" class="size-4 text-muted" />
            </UButton>
          </div>
          <EmptyState
            v-else
            title="No results in this group"
            description="Try a broader search term."
            icon="i-lucide-search-x"
          />
        </UCard>
      </section>
    </template>

    <EmptyState
      v-else
      title="Start with a search query"
      description="Search works best with an agency name, county, payee, category title, or object code."
      icon="i-lucide-search"
    />
  </UContainer>
</template>
