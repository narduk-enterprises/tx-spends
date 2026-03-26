<script setup lang="ts">
definePageMeta({ middleware: ['admin'] })

useSeo({
  title: 'Admin',
  description: 'Manage spotlight blog posts, AI settings, and operator tooling.',
  robots: 'noindex, nofollow',
  ogImage: {
    title: 'Texas State Spending Explorer Admin',
    description: 'Manage spotlight posts, prompts, and operator controls.',
    icon: 'i-lucide-shield-check',
  },
})

useWebPageSchema({
  name: 'Texas State Spending Explorer Admin',
  description: 'Manage spotlight posts, prompts, and operator tooling.',
})

const { user } = useAuth()

const adminTabs = [
  { label: 'Spotlight', value: 'blog', icon: 'i-lucide-newspaper', slot: 'blog' },
  { label: 'AI', value: 'ai', icon: 'i-lucide-bot', slot: 'ai' },
  { label: 'Users', value: 'users', icon: 'i-lucide-users', slot: 'users' },
  { label: 'OG Images', value: 'og', icon: 'i-lucide-image', slot: 'og' },
]

const activeTab = shallowRef('blog')
</script>

<template>
  <UPage>
    <UPageHero
      title="Admin Control Panel"
      description="Edit spotlight posts, trigger the analyzer pipeline, and manage shared operator tooling from one protected surface."
      :ui="{
        container: 'flex flex-col items-center !py-6 sm:!py-8 !gap-4 !pb-4 sm:!pb-5',
        footer: '!mt-3',
        title: 'text-3xl sm:text-4xl lg:text-5xl text-pretty tracking-tight font-bold text-highlighted',
        description: 'text-base sm:text-lg/8 text-muted',
      }"
    >
      <template #links>
        <UBadge
          v-if="user?.email"
          color="neutral"
          variant="soft"
          :label="`Signed in as ${user.email}`"
        />
      </template>
    </UPageHero>

    <UPageSection :ui="{ container: 'flex flex-col !pt-0 !pb-6 sm:!pb-8 !gap-3' }">
      <AppTabs
        v-model="activeTab"
        :items="adminTabs"
        color="primary"
        variant="link"
        persist-key="tx-spends-admin-tab"
      >
        <template #blog>
          <AdminBlogPostsTab />
        </template>

        <template #ai>
          <AdminAiTab />
        </template>

        <template #users>
          <AdminUsersTab />
        </template>

        <template #og>
          <AdminOgImagesTab />
        </template>
      </AppTabs>
    </UPageSection>
  </UPage>
</template>
