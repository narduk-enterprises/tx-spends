<template>
  <div class="min-h-screen bg-[var(--ui-bg)] font-sans text-[var(--ui-text)] flex flex-col">
    <AppHeader />
    <main class="flex-1">
      <slot />
    </main>
    <DisclaimerFooter />
  </div>
</template>
