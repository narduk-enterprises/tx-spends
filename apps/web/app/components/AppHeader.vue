<script setup lang="ts">
const isSearchOpen = ref(false)
const isMobileNavOpen = ref(false)

const navItems = [
  { label: 'Overview', to: '/' },
  { label: 'Agencies', to: '/agencies' },
  { label: 'Payees', to: '/payees' },
  { label: 'Categories', to: '/categories' },
  { label: 'Counties', to: '/counties' },
  { label: 'Transactions', to: '/transactions' },
]
</script>

<template>
  <header class="sticky top-0 z-50 border-b border-default bg-default/85 backdrop-blur-xl">
    <UContainer class="flex min-h-18 items-center justify-between gap-4 py-3">
      <div class="flex min-w-0 items-center gap-3">
        <NuxtLink
          to="/"
          class="group flex min-w-0 items-center gap-3 rounded-full border border-primary/15 bg-primary/5 px-3 py-2 transition-base hover:border-primary/25 hover:bg-primary/10"
        >
          <div
            class="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-card"
          >
            <UIcon name="i-lucide-landmark" class="size-5" />
          </div>
          <div class="min-w-0">
            <p class="truncate text-sm font-semibold text-default">Texas State Spending Explorer</p>
            <p class="truncate text-xs text-muted">
              State treasury spending, county distribution, and payee analysis
            </p>
          </div>
        </NuxtLink>

        <nav class="hidden items-center gap-1 lg:flex">
          <UButton
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            variant="ghost"
            color="neutral"
            class="rounded-full px-3 text-sm text-muted hover:text-default"
            active-class="bg-primary/10 text-default"
          >
            {{ item.label }}
          </UButton>
        </nav>
      </div>

      <div class="flex shrink-0 items-center gap-2">
        <UButton
          color="neutral"
          variant="soft"
          icon="i-lucide-search"
          class="hidden rounded-full md:inline-flex"
          aria-label="Open global search"
          aria-haspopup="dialog"
          @click="isSearchOpen = true"
        >
          Search
        </UButton>
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-lucide-menu"
          class="rounded-full lg:hidden"
          aria-label="Open navigation"
          @click="isMobileNavOpen = true"
        />
      </div>
    </UContainer>

    <GlobalSearch v-model:open="isSearchOpen" />

    <UModal
      v-model:open="isMobileNavOpen"
      title="Explore Texas spending"
      description="Jump to the strongest public views of state treasury spending."
    >
      <template #content>
        <div class="space-y-6 p-6">
          <div class="space-y-1">
            <p class="text-sm font-semibold text-default">Explore Texas spending</p>
            <p class="text-sm text-muted">
              Jump to the strongest public views of state treasury spending.
            </p>
          </div>

          <div class="grid gap-2">
            <UButton
              v-for="item in navItems"
              :key="item.to"
              :to="item.to"
              color="neutral"
              variant="ghost"
              class="justify-start rounded-2xl px-4 py-3"
              @click="isMobileNavOpen = false"
            >
              {{ item.label }}
            </UButton>
          </div>

          <USeparator />

          <div class="flex flex-wrap gap-2">
            <UButton
              to="/data-health"
              color="neutral"
              variant="soft"
              @click="isMobileNavOpen = false"
            >
              Data Health
            </UButton>
            <UButton
              to="/methodology"
              color="neutral"
              variant="soft"
              @click="isMobileNavOpen = false"
            >
              Methodology
            </UButton>
            <UButton
              to="/data-sources"
              color="neutral"
              variant="soft"
              @click="isMobileNavOpen = false"
            >
              Data Sources
            </UButton>
            <UButton
              to="/disclaimers"
              color="neutral"
              variant="soft"
              @click="isMobileNavOpen = false"
            >
              Disclaimers
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </header>
</template>
