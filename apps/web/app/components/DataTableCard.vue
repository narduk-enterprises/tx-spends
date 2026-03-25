<script setup lang="ts" generic="T extends Record<string, unknown>">
const props = withDefaults(
  defineProps<{
    columns: { key: string; label: string; sortable?: boolean }[]
    rows: T[]
    title?: string
    description?: string
    mobileCards?: boolean
    loading?: boolean
    emptyTitle?: string
    emptyDescription?: string
    meta?: {
      limit: number
      offset: number
      returned?: number
      total: number
    }
  }>(),
  {
    title: '',
    description: '',
    mobileCards: true,
    loading: false,
    emptyTitle: 'No rows to show',
    emptyDescription: 'Adjust the current filters to widen this result set.',
    meta: undefined,
  },
)

const emit = defineEmits<{
  page: [page: number]
  sort: [sortOption: { column: string; direction: 'asc' | 'desc' }]
}>()

const currentPage = computed({
  get: () => {
    if (!props.meta) {
      return 1
    }

    return Math.floor(props.meta.offset / props.meta.limit) + 1
  },
  set: (value) => emit('page', value),
})

const tableColumns = computed(() =>
  props.columns.map((column) => ({
    id: column.key,
    accessorKey: column.key,
    header: column.label,
    enableSorting: column.sortable ?? false,
  })),
)
</script>

<template>
  <UCard class="card-base overflow-hidden">
    <template v-if="title || description" #header>
      <div class="space-y-1">
        <p v-if="title" class="text-lg font-semibold text-default">{{ title }}</p>
        <p v-if="description" class="text-sm text-muted">{{ description }}</p>
      </div>
    </template>

    <div v-if="loading" class="flex min-h-48 items-center justify-center">
      <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin text-primary" />
    </div>

    <div v-else-if="rows.length === 0" class="px-2 py-6">
      <EmptyState :title="emptyTitle" :description="emptyDescription" icon="i-lucide-search-x" />
    </div>

    <div v-else>
      <div v-if="mobileCards" class="space-y-3 md:hidden">
        <article
          v-for="(row, rowIndex) in rows"
          :key="`mobile-row-${rowIndex}`"
          class="rounded-[1.25rem] border border-default bg-elevated/40 p-4 shadow-xs"
        >
          <div class="space-y-3">
            <div
              v-for="(column, columnIndex) in columns"
              :key="`${column.key}-${rowIndex}`"
              class="flex items-start justify-between gap-4"
              :class="columnIndex === 0 ? 'border-b border-default pb-3' : ''"
            >
              <p
                class="shrink-0 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted"
              >
                {{ column.label }}
              </p>
              <div class="min-w-0 text-right text-sm text-default">
                <slot :name="`${column.key}-data`" :row="row">
                  {{ row[column.key] }}
                </slot>
              </div>
            </div>
          </div>
        </article>
      </div>

      <div class="hidden overflow-x-auto md:block">
        <UTable
          class="min-w-[42rem]"
          :columns="tableColumns"
          :data="rows"
          @update:sort="emit('sort', $event)"
        >
          <template v-for="column in columns" :key="column.key" #[`${column.key}-cell`]="{ row }">
            <slot :name="`${column.key}-data`" :row="row.original as T">
              {{ (row.original as T)[column.key] }}
            </slot>
          </template>
        </UTable>
      </div>

      <div
        v-if="meta && meta.total > meta.limit"
        class="flex flex-col gap-4 border-t border-default px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <p class="text-sm text-muted">
          Showing
          <span class="font-semibold text-default">{{ meta.offset + 1 }}</span>
          to
          <span class="font-semibold text-default">
            {{ Math.min(meta.offset + meta.limit, meta.total) }}
          </span>
          of
          <span class="font-semibold text-default">{{ meta.total }}</span>
          results
        </p>

        <UPagination
          v-model="currentPage"
          :page-count="meta.limit"
          :total="meta.total"
          show-edges
        />
      </div>
    </div>
  </UCard>
</template>
