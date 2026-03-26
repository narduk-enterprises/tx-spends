<script setup lang="ts">
definePageMeta({ middleware: ['admin'] })

const route = useRoute()
const postId = computed(() => String(route.params.postId ?? ''))

useSeo({
  title: 'Edit Spotlight Post — Admin',
  description: 'Edit a spotlight blog post in the protected admin workspace.',
  robots: 'noindex, nofollow',
  ogImage: {
    title: 'Edit Spotlight Post',
    description: 'Edit a spotlight post in the admin workspace.',
    icon: 'i-lucide-square-pen',
  },
})

useWebPageSchema({
  name: 'Edit Spotlight Post',
  description: 'Edit a spotlight blog post in the protected admin workspace.',
})
</script>

<template>
  <UPage>
    <UPageHero
      title="Edit spotlight post"
      :description="postId ? `Editing post ${postId}` : 'Edit a spotlight blog post.'"
    >
      <template #links>
        <UButton to="/admin/blog" color="neutral" variant="soft" icon="i-lucide-arrow-left">
          Back to blog admin
        </UButton>
      </template>
    </UPageHero>

    <UPageSection>
      <AdminBlogWorkspace />
    </UPageSection>
  </UPage>
</template>
