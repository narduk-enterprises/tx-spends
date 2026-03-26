<script setup lang="ts">
definePageMeta({ middleware: ['admin'] })

useSeo({
  title: 'Spotlight Blog — Admin',
  description: 'Browse, generate, and edit spotlight blog posts.',
  robots: 'noindex, nofollow',
  ogImage: {
    title: 'Spotlight Blog Admin',
    description: 'Browse, generate, and edit spotlight posts.',
    icon: 'i-lucide-newspaper',
  },
})

useWebPageSchema({
  name: 'Spotlight Blog Admin',
  description: 'Browse, generate, and edit spotlight posts.',
})
</script>

<template>
  <UPage>
    <UPageHero
      title="Spotlight blog editor"
      description="This is the Austin Grouch-style full workspace: searchable list on the left, focused editor on the right, and live page preview inside the editor."
    >
      <template #links>
        <UButton to="/admin" color="neutral" variant="soft" icon="i-lucide-arrow-left">
          Back to admin
        </UButton>
      </template>
    </UPageHero>

    <UPageSection>
      <AdminBlogWorkspace />
    </UPageSection>
  </UPage>
</template>
