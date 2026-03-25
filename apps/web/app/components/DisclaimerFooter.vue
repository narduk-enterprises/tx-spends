<template>
  <footer class="border-t border-default bg-default/80">
    <UContainer class="space-y-6 py-10">
      <div class="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]">
        <div class="space-y-3">
          <p class="text-lg font-semibold text-default">Texas State Spending Explorer</p>
          <p class="max-w-2xl text-sm leading-6 text-muted">
            Public-interest analysis of Texas state treasury spending, agency payments, expenditure
            categories, and annual county-level distribution.
          </p>
        </div>

        <div class="grid gap-2 sm:grid-cols-2">
          <UButton
            to="/about"
            :prefetch="false"
            color="neutral"
            variant="ghost"
            class="justify-start rounded-2xl"
          >
            About
          </UButton>
          <UButton
            to="/methodology"
            :prefetch="false"
            color="neutral"
            variant="ghost"
            class="justify-start rounded-2xl"
          >
            Methodology
          </UButton>
          <UButton
            to="/data-sources"
            :prefetch="false"
            color="neutral"
            variant="ghost"
            class="justify-start rounded-2xl"
          >
            Data Sources
          </UButton>
          <UButton
            to="/disclaimers"
            :prefetch="false"
            color="neutral"
            variant="ghost"
            class="justify-start rounded-2xl"
          >
            Disclaimers
          </UButton>
        </div>
      </div>

      <USeparator />

      <div
        class="flex flex-col gap-2 text-sm text-muted sm:flex-row sm:items-center sm:justify-between"
      >
        <p>
          Vendor enrichment is based on public procurement files and name matching where available.
        </p>
        <p>tx-spends.org</p>
      </div>
    </UContainer>
  </footer>
</template>
