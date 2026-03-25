<script setup lang="ts" generic="T extends Record<string, any>">
import { computed } from 'vue'

const props = defineProps<{
  columns: { key: string; label: string; sortable?: boolean }[]
  rows: T[]
  meta?: {
    limit: number
    offset: number
    returned?: number
    total: number
  }
}>()

const emit = defineEmits<{
  page: [page: number]
  sort: [sortOption: { column: string; direction: 'asc' | 'desc' }]
}>()

const currentPage = computed({
  get: () => {
    if (!props.meta) return 1
    return Math.floor(props.meta.offset / props.meta.limit) + 1
  },
  set: (val) => {
    emit('page', val)
  },
})
</script>

<template>
  <UCard class="w-full">
    <UTable :columns="columns as any" :data="rows" @update:sort="emit('sort', $event)">
      <template v-for="col in columns" :key="col.key" #[`${col.key}-data`]="{ row }">
        <slot :name="`${col.key}-data`" :row="row as unknown as T">
          {{ (row as unknown as T)[col.key] }}
        </slot>
      </template>
    </UTable>

    <div
      v-if="meta && meta.total > meta.limit"
      class="flex justify-between items-center px-4 py-3 border-t border-gray-200 dark:border-gray-800"
    >
      <div class="text-sm text-gray-500 dark:text-gray-400">
        Showing
        <span class="font-medium text-gray-900 dark:text-white">{{ meta.offset + 1 }}</span>
        to
        <span class="font-medium text-gray-900 dark:text-white">{{
          Math.min(meta.offset + meta.limit, meta.total)
        }}</span>
        of
        <span class="font-medium text-gray-900 dark:text-white">{{ meta.total }}</span>
        results
      </div>

      <UPagination v-model="currentPage" :page-count="meta.limit" :total="meta.total" show-edges />
    </div>
  </UCard>
</template>
