<template>
  <div class="min-h-screen bg-default text-default">
    <AppHeader />
    <main class="relative flex-1">
      <div
        class="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.18),transparent_28%),radial-gradient(circle_at_top_right,rgba(14,165,233,0.14),transparent_24%),linear-gradient(180deg,#fffdf7_0%,#f8fafc_100%)]"
      />
      <slot />
    </main>
    <DisclaimerFooter />
  </div>
</template>
