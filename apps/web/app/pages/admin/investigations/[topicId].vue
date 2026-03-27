<script setup lang="ts">
definePageMeta({ middleware: ['admin'] })

const route = useRoute()
const topicId = computed(() => String(route.params.topicId ?? ''))

useSeo({
  title: 'Edit Investigation Topic — Admin',
  description: 'Edit a private investigation topic in the protected admin workspace.',
  robots: 'noindex, nofollow',
  ogImage: {
    title: 'Edit Investigation Topic',
    description: 'Edit a private investigation topic in the admin workspace.',
    icon: 'i-lucide-search-code',
  },
})

useWebPageSchema({
  name: 'Edit Investigation Topic',
  description: 'Edit a private investigation topic in the protected admin workspace.',
})
</script>

<template>
  <UPage>
    <UPageHero
      title="Edit investigation topic"
      :description="topicId ? `Editing topic ${topicId}` : 'Edit a private investigation dossier.'"
    >
      <template #links>
        <UButton
          to="/admin/investigations"
          color="neutral"
          variant="soft"
          icon="i-lucide-arrow-left"
        >
          Back to investigations
        </UButton>
      </template>
    </UPageHero>

    <UPageSection>
      <AdminInvestigationsWorkspace />
    </UPageSection>
  </UPage>
</template>
