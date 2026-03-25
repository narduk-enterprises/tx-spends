<template>
  <footer
    class="border-t border-[var(--ui-border)] mt-12 py-8 text-sm text-[var(--ui-text-muted)] text-center"
  >
    <UContainer>
      <p>
        Data presented is for informational purposes only. Non-authoritative entity enrichments are
        provided via fuzzy matching.
      </p>
      <div class="flex justify-center gap-4 mt-4">
        <NuxtLink to="/about" class="hover:text-[var(--ui-text)]">About</NuxtLink>
        <NuxtLink to="/methodology" class="hover:text-[var(--ui-text)]">Methodology</NuxtLink>
        <NuxtLink to="/data-sources" class="hover:text-[var(--ui-text)]">Data Sources</NuxtLink>
        <NuxtLink to="/disclaimers" class="hover:text-[var(--ui-text)]">Disclaimers</NuxtLink>
      </div>
    </UContainer>
  </footer>
</template>
