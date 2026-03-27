<script setup lang="ts">
import type { AdminBlogPreviewPost } from '~/composables/useAdminBlogPosts'
import { BLOG_AUTHOR_NAME } from '~/utils/blog'

defineOptions({ inheritAttrs: false })

const props = defineProps<{
  post: AdminBlogPreviewPost | null
}>()

const formattedDate = computed(() => {
  if (!props.post?.publishedAt) return null
  return new Date(props.post.publishedAt).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
})
</script>

<template>
  <div
    v-if="post"
    class="max-h-[72vh] overflow-y-auto rounded-xl border border-default bg-default p-5"
  >
    <article class="space-y-8">
      <header class="space-y-4">
        <div class="flex flex-wrap items-center gap-2">
          <UBadge color="primary" variant="soft" size="sm">
            {{ post.angleName || 'Spotlight' }}
          </UBadge>
          <UBadge
            :color="post.status === 'published' ? 'success' : 'warning'"
            variant="soft"
            size="sm"
            class="capitalize"
          >
            {{ post.status }}
          </UBadge>
        </div>

        <div class="space-y-2">
          <h1 class="text-3xl font-bold tracking-tight text-default">
            {{ post.title || 'Untitled spotlight' }}
          </h1>
          <p class="text-lg text-muted">
            {{ post.excerpt || 'Add an excerpt to see the public preview take shape.' }}
          </p>
        </div>

        <div class="flex items-center gap-3 text-sm text-muted">
          <UIcon name="i-lucide-user-round" class="size-4 shrink-0" />
          <span>By {{ post.author || BLOG_AUTHOR_NAME }}</span>
          <USeparator orientation="vertical" class="h-4" />
          <UIcon name="i-lucide-calendar" class="size-4 shrink-0" />
          <span>{{ formattedDate ?? 'Draft preview' }}</span>
          <USeparator orientation="vertical" class="h-4" />
          <UIcon name="i-lucide-database" class="size-4 shrink-0" />
          <span>Texas Comptroller data</span>
        </div>
      </header>

      <USeparator />

      <BlogPostContent :body="post.body" />
    </article>
  </div>

  <p v-else class="text-sm text-muted">Select a spotlight post to load the preview.</p>
</template>
