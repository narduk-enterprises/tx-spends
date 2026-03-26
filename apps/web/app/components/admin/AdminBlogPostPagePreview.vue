<script setup lang="ts">
import type { AdminBlogPreviewPost } from '~/composables/useAdminBlogPosts'

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
          <span>By {{ post.author || 'narduk@mac.com' }}</span>
          <USeparator orientation="vertical" class="h-4" />
          <UIcon name="i-lucide-calendar" class="size-4 shrink-0" />
          <span>{{ formattedDate ?? 'Draft preview' }}</span>
          <USeparator orientation="vertical" class="h-4" />
          <UIcon name="i-lucide-database" class="size-4 shrink-0" />
          <span>Texas Comptroller data</span>
        </div>
      </header>

      <USeparator />

      <div class="space-y-6 text-base leading-relaxed text-default">
        <p v-if="post.body.intro">{{ post.body.intro }}</p>

        <section
          v-for="(section, index) in post.body.sections"
          :key="`${section.heading}-${index}`"
          class="space-y-3"
        >
          <h2 class="text-xl font-semibold text-default">
            {{ section.heading || `Section ${index + 1}` }}
          </h2>

          <template
            v-for="(paragraph, paragraphIndex) in section.content.split('\n\n')"
            :key="paragraphIndex"
          >
            <p v-if="paragraph.trim()" class="leading-relaxed text-default/90">
              {{ paragraph }}
            </p>
          </template>
        </section>

        <aside
          v-if="post.body.dataNotes"
          class="rounded-2xl border border-default bg-muted/30 p-4 text-sm text-muted"
        >
          <p class="mb-1 font-semibold text-default">Data Notes</p>
          <p>{{ post.body.dataNotes }}</p>
        </aside>
      </div>
    </article>
  </div>

  <p v-else class="text-sm text-muted">Select a spotlight post to load the preview.</p>
</template>
