<script setup lang="ts">
const adminBlog = useAdminBlogPosts()
</script>

<template>
  <div class="space-y-4">
    <div class="grid gap-4 xl:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
      <AdminBlogGenerateCard
        :busy-action="adminBlog.generateAction.value"
        @generate-draft="adminBlog.generatePost()"
        @publish-now="adminBlog.generatePost({ publish: true })"
      />

      <UCard class="card-base border-default">
        <div class="grid gap-4 sm:grid-cols-3">
          <div class="rounded-xl border border-default bg-default p-4">
            <p class="text-xs font-semibold uppercase tracking-wider text-primary">Drafts</p>
            <p class="mt-2 text-3xl font-semibold text-default">{{ adminBlog.draftCount.value }}</p>
          </div>

          <div class="rounded-xl border border-default bg-default p-4">
            <p class="text-xs font-semibold uppercase tracking-wider text-primary">Published</p>
            <p class="mt-2 text-3xl font-semibold text-default">
              {{ adminBlog.publishedCount.value }}
            </p>
          </div>

          <div class="rounded-xl border border-default bg-default p-4">
            <p class="text-xs font-semibold uppercase tracking-wider text-primary">Archived</p>
            <p class="mt-2 text-3xl font-semibold text-default">
              {{ adminBlog.archivedCount.value }}
            </p>
          </div>
        </div>

        <div class="mt-4 flex flex-wrap gap-3">
          <UButton to="/admin/blog" color="primary" icon="i-lucide-square-pen">
            Open full editor
          </UButton>
          <UButton to="/blog" color="neutral" variant="soft" icon="i-lucide-newspaper">
            View public blog
          </UButton>
        </div>
      </UCard>
    </div>

    <AdminBlogPostsList
      :posts="adminBlog.posts.value"
      :loading="adminBlog.postsStatus.value === 'pending'"
      :selected-post-id="adminBlog.selectedPostId.value"
    />
  </div>
</template>
