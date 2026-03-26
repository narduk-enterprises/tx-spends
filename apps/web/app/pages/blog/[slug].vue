<script setup lang="ts">
import { buildFetchKey } from '~/utils/explorer'

const route = useRoute('/blog/[slug]')
const slug = computed(() => String(route.params.slug))

const fetchKey = computed(() => buildFetchKey(`blog-post:${slug.value}`, {}))
const { data, error, status } = await useFetch(() => `/api/blog/${slug.value}`, {
  key: fetchKey,
})

const post = computed(() => data.value?.data)

const postTitle = computed(() => post.value?.title ?? 'Spending Spotlight')
const postExcerpt = computed(
  () => post.value?.excerpt ?? 'A data-backed look at Texas state government spending.',
)
const postPublishedAt = computed(() =>
  post.value?.published_at ? new Date(post.value.published_at).toISOString() : undefined,
)
const postAngleName = computed(() => post.value?.angle_name ?? 'Texas Spending Spotlight')

useSeo({
  title: postTitle,
  description: postExcerpt,
  type: 'article',
  publishedAt: postPublishedAt,
  ogImage: {
    title: postTitle,
    description: postExcerpt,
    icon: 'i-lucide-newspaper',
  },
})

// Article schema using resolved values (post is hydrated after await useFetch)
useArticleSchema({
  headline: postTitle.value,
  description: postExcerpt.value,
  datePublished: postPublishedAt.value ?? new Date().toISOString(),
  author: { name: 'Texas State Spending Explorer' },
  section: postAngleName.value,
})

interface PostSection {
  heading: string
  content: string
}

interface PostBody {
  intro?: string
  sections?: PostSection[]
  dataNotes?: string
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
      <div class="space-y-6">
        <USkeleton class="h-10 w-3/4 rounded-xl" />
        <USkeleton class="h-5 w-full rounded-lg" />
        <USkeleton class="h-5 w-5/6 rounded-lg" />
        <USkeleton class="mt-8 h-48 rounded-2xl" />
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
          <UIcon name="i-lucide-calendar" class="size-4 shrink-0" />
          <time v-if="post.published_at" :datetime="new Date(post.published_at).toISOString()">
            {{ new Date(post.published_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) }}
          </time>
          <USeparator orientation="vertical" class="h-4" />
          <UIcon name="i-lucide-database" class="size-4 shrink-0" />
          <span>Texas Comptroller data</span>
        </div>
      </header>

      <USeparator />

      <!-- Body -->
      <div class="space-y-6 text-base leading-relaxed text-default">
        <!-- Introduction -->
        <p v-if="body.intro" class="text-base leading-relaxed">
          {{ body.intro }}
        </p>

        <!-- Sections -->
        <template v-if="body.sections && body.sections.length > 0">
          <section v-for="(section, i) in body.sections" :key="i" class="space-y-3">
            <h2 class="text-xl font-semibold text-default">
              {{ section.heading }}
            </h2>
            <template v-for="(para, j) in section.content.split('\n\n')" :key="j">
              <p class="leading-relaxed text-default/90">{{ para }}</p>
            </template>
          </section>
        </template>

        <!-- Data Notes -->
        <aside v-if="body.dataNotes" class="rounded-2xl border border-default bg-muted/30 p-4 text-sm text-muted">
          <p class="mb-1 font-semibold text-default">Data Notes</p>
          <p>{{ body.dataNotes }}</p>
        </aside>
      </div>

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
