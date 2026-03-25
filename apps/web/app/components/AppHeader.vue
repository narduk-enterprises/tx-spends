<script setup lang="ts">
import { ref } from 'vue'

const isSearchOpen = ref(false)
</script>

<template>
  <header
    class="sticky top-0 z-50 w-full backdrop-blur flex-none border-b border-[var(--ui-border)] bg-[var(--ui-bg)]/75"
  >
    <UContainer class="flex items-center justify-between h-16">
      <div class="flex items-center gap-4">
        <NuxtLink to="/" class="font-bold text-xl flex items-center gap-2">
          <UIcon name="i-heroicons-banknotes" class="w-6 h-6 text-[var(--ui-primary)]" />
          Texas Spends
        </NuxtLink>
        <nav class="hidden md:flex gap-6 ml-6 text-sm font-medium text-[var(--ui-text-muted)]">
          <NuxtLink to="/agencies" active-class="text-[var(--ui-text)]">Agencies</NuxtLink>
          <NuxtLink to="/payees" active-class="text-[var(--ui-text)]">Payees</NuxtLink>
          <NuxtLink to="/categories" active-class="text-[var(--ui-text)]">Categories</NuxtLink>
          <NuxtLink to="/counties" active-class="text-[var(--ui-text)]">Counties</NuxtLink>
          <NuxtLink to="/transactions" active-class="text-[var(--ui-text)]">Transactions</NuxtLink>
        </nav>
      </div>
      <div>
        <UButton
          icon="i-heroicons-magnifying-glass"
          color="neutral"
          variant="ghost"
          @click="isSearchOpen = true"
        >
          Search...
        </UButton>
      </div>
      <GlobalSearch v-model:open="isSearchOpen" />
    </UContainer>
  </header>
</template>
