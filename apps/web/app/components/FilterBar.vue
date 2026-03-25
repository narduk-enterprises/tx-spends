<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()

const fiscalYear = ref(route.query.fiscal_year?.toString() || '')

watch(fiscalYear, (newVal) => {
  router.push({
    query: {
      ...route.query,
      fiscal_year: newVal || undefined,
    },
  })
})
</script>

<template>
  <div
    class="sticky top-16 z-40 bg-[var(--ui-bg)]/90 backdrop-blur border-b border-[var(--ui-border)] py-3"
  >
    <UContainer class="flex items-center gap-4">
      <span class="text-sm font-medium text-[var(--ui-text-muted)]">Filters</span>
      <USelect
        v-model="fiscalYear"
        :options="[
          { label: 'All Years', value: '' },
          { label: '2025', value: '2025' },
          { label: '2024', value: '2024' },
          { label: '2023', value: '2023' },
        ]"
        placeholder="Fiscal Year"
        class="w-48"
      />
    </UContainer>
  </div>
</template>
