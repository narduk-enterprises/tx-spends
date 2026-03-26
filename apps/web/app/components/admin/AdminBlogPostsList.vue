<script setup lang="ts">
import type { AdminBlogPostSummary } from '~/composables/useAdminBlogPosts'

const props = defineProps<{
  loading?: boolean
  posts: AdminBlogPostSummary[]
  selectedPostId?: string | null
}>()

const searchQuery = shallowRef('')

function editHref(postId: string) {
  return `/admin/blog/${postId}`
}

function badgeColor(status: AdminBlogPostSummary['status']) {
  if (status === 'published') return 'success'
  if (status === 'archived') return 'neutral'
  return 'warning'
}

function onPostRowClick(postId: string, event: MouseEvent) {
  if (event.defaultPrevented || event.button !== 0) return
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  void navigateTo(editHref(postId))
}

const filteredPosts = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return props.posts

  return props.posts.filter((post) =>
    [post.title, post.slug, post.status, post.angleName ?? '', post.excerpt]
      .join(' ')
      .toLowerCase()
      .includes(query),
  )
})
</script>

<template>
  <UCard class="card-base border-default h-full">
    <div
      class="sticky top-0 z-10 flex flex-col gap-3 border-b border-default bg-default/95 px-4 py-3 backdrop-blur supports-backdrop-filter:bg-default/80"
    >
      <div class="space-y-1">
        <p class="text-xs font-semibold uppercase tracking-wider text-primary">Posts</p>
        <h2 class="text-lg font-semibold text-default">Spotlight articles</h2>
      </div>
      <p class="text-sm text-muted">
        Search drafts and published spotlights, then jump into the editor for revisions.
      </p>
      <UInput
        v-model="searchQuery"
        icon="i-lucide-search"
        placeholder="Search by title, slug, angle, or status"
      />
    </div>

    <div class="max-h-[70vh] overflow-y-auto p-3">
      <div v-if="loading" class="flex justify-center py-10">
        <UIcon name="i-lucide-loader-2" class="size-6 animate-spin text-muted" />
      </div>

      <div
        v-else-if="filteredPosts.length === 0"
        class="rounded-lg border border-dashed border-default p-6"
      >
        <p class="text-sm text-muted">No spotlight posts matched that search.</p>
      </div>

      <div v-else class="space-y-2">
        <ULink
          v-for="post in filteredPosts"
          :key="post.id"
          :to="editHref(post.id)"
          class="flex h-auto w-full flex-col gap-3 rounded-lg border px-4 py-3 text-left no-underline outline-none transition hover:border-primary/40 hover:bg-elevated/60 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-default"
          :class="
            post.id === selectedPostId
              ? 'border-primary/40 bg-primary/5'
              : 'border-default bg-default'
          "
          @click="onPostRowClick(post.id, $event)"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0 flex-1 space-y-1">
              <p class="line-clamp-2 font-medium text-default">{{ post.title }}</p>
              <p class="truncate text-xs text-muted">{{ post.slug }}</p>
            </div>

            <UBadge
              :color="badgeColor(post.status)"
              variant="soft"
              :label="post.status"
              class="shrink-0 capitalize"
            />
          </div>

          <div class="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
            <span v-if="post.angleName">{{ post.angleName }}</span>
            <span v-if="post.publishedAt">
              Published
              {{
                new Date(post.publishedAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })
              }}
            </span>
            <span>
              Updated
              {{
                new Date(post.updatedAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })
              }}
            </span>
          </div>

          <p class="line-clamp-2 text-sm leading-snug text-muted">
            {{ post.excerpt }}
          </p>
        </ULink>
      </div>
    </div>
  </UCard>
</template>
