<script setup lang="ts">
import { buildFetchKey } from '~/utils/explorer'
import { BLOG_AUTHOR_NAME } from '~/utils/blog'

const route = useRoute('/blog/[slug]')
const slug = computed(() => String(route.params.slug))

interface PostSection {
  heading: string
  content: string
}

interface PostBody {
  intro?: string
  sections?: PostSection[]
  dataNotes?: string
}

interface BlogPostRecord {
  id: string
  slug: string
  author: string
  title: string
  excerpt: string
  body: PostBody
  angle_id: string
  angle_name: string | null
  angle_description: string | null
  published_at: string | null
  updated_at: string | null
}

interface BlogPostResponse {
  data: BlogPostRecord
}

const fetchKey = computed(() => buildFetchKey(`blog-post:${slug.value}`, {}))
const { data, error, status } = await useFetch<BlogPostResponse>(() => `/api/blog/${slug.value}`, {
  key: fetchKey,
})

const post = computed<BlogPostRecord | null>(() => data.value?.data ?? null)

const postTitle = computed(() => post.value?.title ?? 'Spending Spotlight')
const postExcerpt = computed(
  () => post.value?.excerpt ?? 'A data-backed look at Texas state government spending.',
)
const postAuthor = computed(() => post.value?.author?.trim() || BLOG_AUTHOR_NAME)
const postPublishedAt = computed(() =>
  post.value?.published_at ? new Date(post.value.published_at).toISOString() : undefined,
)
const postAngleName = computed(() => post.value?.angle_name ?? 'Texas Spending Spotlight')

useSeo({
  title: postTitle,
  description: postExcerpt,
  // Only emit 'article' type when the post actually loaded; fall back to
  // 'website' on 404 so error pages don't get incorrect Open Graph metadata.
  type: post.value ? 'article' : 'website',
  publishedAt: postPublishedAt,
  ogImage: {
    title: postTitle,
    description: postExcerpt,
    icon: 'i-lucide-newspaper',
  },
})

// Schema injection — only when the post is available
if (post.value) {
  // Article schema — only inject when we have a real published date
  if (postPublishedAt.value) {
    useArticleSchema({
      headline: postTitle.value,
      description: postExcerpt.value,
      datePublished: postPublishedAt.value,
      author: { name: postAuthor.value },
      section: postAngleName.value,
    })
  } else {
    useWebPageSchema({
      name: postTitle.value,
      description: postExcerpt.value,
      type: 'ItemPage',
    })
  }
}

const body = computed<PostBody>(() => {
  const raw = post.value?.body
  if (!raw || typeof raw !== 'object') return {}
  return raw as PostBody
})
</script>

<template>
  <UContainer class="max-w-3xl py-8">
    <template v-if="status === 'pending'">
      <div class="flex items-center justify-center py-16">
        <UIcon name="i-lucide-loader-2" class="size-8 animate-spin text-muted" />
      </div>
    </template>

    <template v-else-if="error || !post">
      <EmptyState
        title="Post not found"
        description="This spotlight article may have been removed or the link is incorrect."
        icon="i-lucide-file-x"
      />
      <div class="mt-6">
        <UButton to="/blog" variant="soft" color="neutral" icon="i-lucide-arrow-left">
          Back to Spotlight Blog
        </UButton>
      </div>
    </template>

    <article v-else class="space-y-8">
      <!-- Header -->
      <header class="space-y-4">
        <nav class="flex items-center gap-2 text-sm text-muted">
          <NuxtLink to="/" class="hover:text-default">Home</NuxtLink>
          <UIcon name="i-lucide-chevron-right" class="size-4" />
          <NuxtLink to="/blog" class="hover:text-default">Spotlight Blog</NuxtLink>
          <UIcon name="i-lucide-chevron-right" class="size-4" />
          <span class="text-default">{{ post.angle_name }}</span>
        </nav>

        <div class="space-y-2">
          <UBadge color="primary" variant="soft" size="sm">
            {{ post.angle_name }}
          </UBadge>
          <h1 class="text-3xl font-bold tracking-tight text-default">
            {{ post.title }}
          </h1>
          <p class="text-lg text-muted">{{ post.excerpt }}</p>
        </div>

        <div class="flex items-center gap-3 text-sm text-muted">
          <UIcon name="i-lucide-user-round" class="size-4 shrink-0" />
          <span>By {{ postAuthor }}</span>
          <USeparator orientation="vertical" class="h-4" />
          <UIcon name="i-lucide-calendar" class="size-4 shrink-0" />
          <NuxtTime
            v-if="post.published_at"
            :datetime="post.published_at"
            year="numeric"
            month="long"
            day="numeric"
          />
          <USeparator orientation="vertical" class="h-4" />
          <UIcon name="i-lucide-database" class="size-4 shrink-0" />
          <span>Texas Comptroller data</span>
        </div>
      </header>

      <USeparator />

      <BlogPostContent :body="body" />

      <USeparator />

      <!-- Footer navigation -->
      <footer class="flex flex-wrap items-center justify-between gap-4">
        <UButton to="/blog" variant="soft" color="neutral" icon="i-lucide-arrow-left">
          All Spotlight Articles
        </UButton>
        <UButton to="/" variant="ghost" color="neutral" icon="i-lucide-landmark">
          Explore the data
        </UButton>
      </footer>
    </article>
  </UContainer>
</template>
