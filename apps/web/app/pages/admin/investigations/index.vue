<script setup lang="ts">
definePageMeta({ middleware: ['admin'] })

useSeo({
  title: 'Investigations — Admin',
  description: 'Manage private investigation topics and research dossiers.',
  robots: 'noindex, nofollow',
  ogImage: {
    title: 'Investigations Admin',
    description: 'Manage private investigation topics and research dossiers.',
    icon: 'i-lucide-search-code',
  },
})

useWebPageSchema({
  name: 'Investigations Admin',
  description: 'Manage private investigation topics and research dossiers.',
})
</script>

<template>
  <UPage>
    <UPageHero
      title="Investigations workspace"
      description="Review the seeded sleuthing backlog, edit dossier fields, and track newsroom status without touching the public blog."
    >
      <template #links>
        <UButton to="/admin" color="neutral" variant="soft" icon="i-lucide-arrow-left">
          Back to admin
        </UButton>
      </template>
    </UPageHero>

    <UPageSection>
      <AdminInvestigationsWorkspace />
    </UPageSection>
  </UPage>
</template>
