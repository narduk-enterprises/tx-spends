<script setup lang="ts">
import { buildFetchKey } from '~/utils/explorer'

const title = 'Texas Spending Spotlight Blog'
const description =
  'Daily evidence-backed articles on Texas state government spending, generated from Comptroller data to surface patterns, trends, and notable findings.'

useSeo({
  title,
  description,
  ogImage: {
    title,
    description,
    icon: 'i-lucide-newspaper',
  },
})

useWebPageSchema({
  name: title,
  description,
  type: 'CollectionPage',
})

const requestKey = buildFetchKey('blog-index', {})
const { data, status } = await useFetch('/api/blog', {
  key: requestKey,
  query: { limit: 20, offset: 0 },
})

const posts = computed(() => data.value?.data ?? [])
</script>

<template>
  <UContainer class="space-y-8 py-8">
    <PageHeader
      eyebrow="Spotlight"
      :title="title"
      :subtitle="description"
      :breadcrumbs="[{ label: 'Home', to: '/' }, { label: 'Spotlight Blog' }]"
    />

    <div v-if="status === 'pending'" class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <USkeleton v-for="n in 6" :key="n" class="h-52 rounded-2xl" />
    </div>

    <EmptyState
      v-else-if="posts.length === 0"
      title="No posts yet"
      description="The daily spotlight is warming up. Check back tomorrow for the first data-driven article."
      icon="i-lucide-newspaper"
    />

    <div v-else class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <BlogPostCard
        v-for="post in posts"
        :key="post.id"
        :slug="post.slug"
        :title="post.title"
        :excerpt="post.excerpt"
        :angle-name="post.angle_name ?? ''"
        :published-at="post.published_at"
      />
    </div>
  </UContainer>
</template>
