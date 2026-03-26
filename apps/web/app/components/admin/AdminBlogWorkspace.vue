<script setup lang="ts">
const route = useRoute()
const adminBlog = useAdminBlogPosts()

const routePostId = computed(() => {
  const raw = route.params.postId
  return typeof raw === 'string' ? raw : null
})

watch(
  routePostId,
  (postId) => {
    adminBlog.selectPost(postId)
  },
  { immediate: true },
)
</script>

<template>
  <div class="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
    <div class="space-y-4">
      <AdminBlogGenerateCard
        :busy-action="adminBlog.generateAction.value"
        @generate-draft="adminBlog.generatePost()"
        @publish-now="adminBlog.generatePost({ publish: true })"
      />

      <AdminBlogPostsList
        :posts="adminBlog.posts.value"
        :loading="adminBlog.postsStatus.value === 'pending'"
        :selected-post-id="adminBlog.selectedPostId.value"
      />
    </div>

    <AdminBlogPostEditor
      v-model="adminBlog.editorState.value"
      :post="adminBlog.selectedPost.value"
      :preview-post="adminBlog.previewPost.value"
      :loading="adminBlog.selectedPostStatus.value === 'pending'"
      :dirty="adminBlog.isDirty.value"
      :saving="adminBlog.isSaving.value"
      :status-action="adminBlog.statusAction.value"
      @add-section="adminBlog.addSection()"
      @archive="adminBlog.updateStatus('archived')"
      @move-to-draft="adminBlog.updateStatus('draft')"
      @publish="adminBlog.updateStatus('published')"
      @refresh="adminBlog.refreshSelectedPost()"
      @remove-section="adminBlog.removeSection"
      @reset="adminBlog.resetEditor()"
      @save="adminBlog.saveCurrentPost()"
    />
  </div>
</template>
