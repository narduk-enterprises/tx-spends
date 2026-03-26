<script setup lang="ts" generic="T extends Record<string, unknown>">
import { h, resolveComponent } from 'vue'

/** TanStack Table sorting state shape (matches @tanstack/vue-table). */
type SortingState = { id: string; desc: boolean }[]

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
    /** Column id matching `columns[].key`; drives header sort UI for server-sorted lists. */
    sortColumn?: string
    sortOrder?: 'asc' | 'desc'
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
    sortColumn: undefined,
    sortOrder: undefined,
    meta: undefined,
  },
)

const emit = defineEmits<{
  page: [page: number]
  sort: [sortOption: { column: string; direction: 'asc' | 'desc' }]
}>()

const UButtonResolved = resolveComponent('UButton')

type TableMeta = NonNullable<typeof props.meta>

function isAmountColumnKey(key: string) {
  return (
    key === 'amount' || key === 'total_spend' || key.endsWith('_amount') || key.endsWith('_spend')
  )
}

const lastStableRows = shallowRef<T[]>([])
const lastStableMeta = shallowRef<TableMeta | undefined>()

watch(
  () => [props.loading, props.rows] as const,
  ([loading, rows]) => {
    if (!loading) {
      if (rows.length > 0) {
        lastStableRows.value = rows.slice() as T[]
      } else {
        lastStableRows.value = []
      }
    }
  },
  { immediate: true },
)

watch(
  () => props.meta,
  (meta) => {
    if (meta) {
      lastStableMeta.value = { ...meta }
    }
  },
  { immediate: true },
)

/** Placeholder row count when there is no prior page to mirror (initial load). */
const SKELETON_PLACEHOLDER_ROWS = 10

const skeletonRowCount = computed(() => SKELETON_PLACEHOLDER_ROWS)

const skeletonDataRows = computed((): T[] => {
  return Array.from({ length: skeletonRowCount.value }, (_, rowIndex) => {
    const row = { _skeletonRow: rowIndex } as Record<string, unknown>
    for (const column of props.columns) {
      row[column.key] = ''
    }
    return row as T
  })
})

const displayRows = computed((): T[] => {
  if (!props.loading) {
    return props.rows
  }
  if (props.rows.length > 0) {
    return props.rows
  }
  if (lastStableRows.value.length > 0) {
    return lastStableRows.value
  }
  return skeletonDataRows.value
})

const showCellSkeletons = computed(() => props.loading)

const effectiveMeta = computed(() => props.meta ?? lastStableMeta.value)

const currentPage = computed({
  get: () => {
    const meta = effectiveMeta.value
    if (!meta) {
      return 1
    }

    return Math.floor(meta.offset / meta.limit) + 1
  },
  set: (value) => emit('page', value),
})

const tableColumns = computed(() =>
  props.columns.map((column) => {
    const sortable = (column.sortable ?? false) && !props.loading
    const rightAlign = isAmountColumnKey(column.key)
    const alignMeta = rightAlign ? { meta: { class: { th: 'text-end', td: 'text-end' } } } : {}

    if (!sortable) {
      return {
        id: column.key,
        accessorKey: column.key,
        header: column.label,
        enableSorting: false,
        ...alignMeta,
      }
    }

    return {
      id: column.key,
      accessorKey: column.key,
      enableSorting: true,
      header: ({
        column: col,
      }: {
        column: {
          getIsSorted: () => false | 'asc' | 'desc'
          toggleSorting: (desc?: boolean) => void
        }
      }) => {
        const isSorted = col.getIsSorted()
        const btn = h(UButtonResolved, {
          color: 'neutral',
          variant: 'ghost',
          label: column.label,
          size: 'xs',
          icon: isSorted
            ? isSorted === 'asc'
              ? 'i-lucide-arrow-up-narrow-wide'
              : 'i-lucide-arrow-down-wide-narrow'
            : 'i-lucide-arrow-up-down',
          class: 'min-h-7 -mx-2 px-2 text-xs font-semibold text-highlighted',
          onClick: () => col.toggleSorting(col.getIsSorted() === 'asc'),
        })
        return rightAlign ? h('div', { class: 'flex w-full justify-end' }, [btn]) : btn
      },
      ...alignMeta,
    }
  }),
)

const firstSortableColumnKey = computed(
  () => props.columns.find((column) => column.sortable)?.key ?? '',
)

const resolvedSortColumn = computed(() => props.sortColumn || firstSortableColumnKey.value)

const resolvedSortOrder = computed(() => props.sortOrder ?? 'desc')

const tableSorting = computed((): SortingState => {
  const id = resolvedSortColumn.value
  if (!id) {
    return []
  }
  return [{ id, desc: resolvedSortOrder.value === 'desc' }]
})

function onTableSortingUpdate(next?: SortingState) {
  const first = next?.[0]
  if (!first) {
    const fallback = firstSortableColumnKey.value
    if (!fallback) {
      return
    }
    emit('sort', { column: fallback, direction: 'desc' })
    return
  }
  emit('sort', { column: String(first.id), direction: first.desc ? 'desc' : 'asc' })
}

/** Tighter than Nuxt UI defaults (`p-4` / `py-3.5`) so rows stay short; skeletons align to this. */
const tableUi = {
  th: 'px-3 py-2 text-xs text-highlighted text-left rtl:text-right font-semibold [&:has([role=checkbox])]:pe-0',
  td: 'px-3 py-2 text-sm text-muted align-middle whitespace-nowrap [&:has([role=checkbox])]:pe-0',
}

/** Keeps scroll position / card height steady while row cells swap to skeletons. */
const TABLE_HEADER_REM = 2.625
/** Matches compact padding + typical cell (incl. stacked amount lines). */
const COMPACT_ROW_REM = 2.375

const desktopTableAreaStyle = computed((): { minHeight?: string } => {
  const n = displayRows.value.length
  if (n < 1) {
    return {}
  }
  return { minHeight: `${TABLE_HEADER_REM + n * COMPACT_ROW_REM}rem` }
})

function skeletonClassForColumn(key: string) {
  const base = 'h-3.5 max-w-full shrink-0 rounded-md'
  if (key.includes('date') || key.endsWith('_at')) {
    return `${base} w-24`
  }
  return `${base} w-full max-w-[12rem]`
}
</script>

<template>
  <UCard class="card-base overflow-hidden">
    <template v-if="title || description" #header>
      <div class="space-y-1">
        <p v-if="title" class="text-lg font-semibold text-default">{{ title }}</p>
        <p v-if="description" class="text-sm text-muted">{{ description }}</p>
      </div>
    </template>

    <div v-if="!loading && rows.length === 0" class="px-2 py-6">
      <slot name="empty">
        <EmptyState :title="emptyTitle" :description="emptyDescription" icon="i-lucide-search-x" />
      </slot>
    </div>

    <div
      v-else
      class="relative"
      :aria-busy="loading ? true : undefined"
      :aria-live="loading ? 'polite' : undefined"
    >
      <div
        class="transition-opacity duration-150"
        :class="loading ? 'pointer-events-none select-none' : ''"
      >
        <div v-if="mobileCards" class="space-y-2 md:hidden">
          <article
            v-for="(row, rowIndex) in displayRows"
            :key="`mobile-row-${rowIndex}`"
            class="rounded-[1.25rem] border border-default bg-elevated/40 p-3 shadow-xs"
          >
            <div class="space-y-2">
              <div
                v-for="(column, columnIndex) in columns"
                :key="`${column.key}-${rowIndex}`"
                class="flex items-start justify-between gap-3"
                :class="columnIndex === 0 ? 'border-b border-default pb-2' : ''"
              >
                <p
                  class="shrink-0 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted"
                >
                  {{ column.label }}
                </p>
                <div
                  class="min-w-0 text-right text-sm text-default"
                  :class="showCellSkeletons ? 'flex w-full justify-end' : ''"
                >
                  <div
                    v-if="showCellSkeletons && isAmountColumnKey(column.key)"
                    class="flex flex-col items-end gap-0.5"
                  >
                    <USkeleton class="h-3.5 w-[4.5rem] shrink-0 rounded-md" />
                    <USkeleton class="h-3 w-[3.25rem] shrink-0 rounded-md" />
                  </div>
                  <USkeleton
                    v-else-if="showCellSkeletons"
                    :class="skeletonClassForColumn(column.key)"
                  />
                  <slot v-else :name="`${column.key}-data`" :row="row">
                    {{ row[column.key] }}
                  </slot>
                </div>
              </div>
            </div>
          </article>
        </div>

        <div class="hidden overflow-x-auto md:block" :style="desktopTableAreaStyle">
          <UTable
            class="min-w-[42rem]"
            :columns="tableColumns"
            :data="displayRows"
            :sorting="tableSorting"
            :sorting-options="{ manualSorting: true }"
            :ui="tableUi"
            @update:sorting="onTableSortingUpdate"
          >
            <template v-for="column in columns" :key="column.key" #[`${column.key}-cell`]="{ row }">
              <div
                v-if="showCellSkeletons && isAmountColumnKey(column.key)"
                class="flex flex-col items-end gap-0.5"
              >
                <USkeleton class="h-3.5 w-[4.5rem] shrink-0 rounded-md" />
                <USkeleton class="h-3 w-[3.25rem] shrink-0 rounded-md" />
              </div>
              <USkeleton
                v-else-if="showCellSkeletons"
                :class="skeletonClassForColumn(column.key)"
              />
              <slot v-else :name="`${column.key}-data`" :row="row.original as T">
                {{ (row.original as T)[column.key] }}
              </slot>
            </template>
          </UTable>
        </div>

        <div
          v-if="effectiveMeta && effectiveMeta.total > effectiveMeta.limit"
          class="flex flex-col gap-4 border-t border-default px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <p v-if="loading" class="text-sm text-muted">Updating results…</p>
          <p v-else class="text-sm text-muted">
            Showing
            <span class="font-semibold text-default">{{ effectiveMeta.offset + 1 }}</span>
            to
            <span class="font-semibold text-default">
              {{ Math.min(effectiveMeta.offset + effectiveMeta.limit, effectiveMeta.total) }}
            </span>
            of
            <span class="font-semibold text-default">{{ effectiveMeta.total }}</span>
            results
          </p>

          <UPagination
            v-model:page="currentPage"
            :disabled="loading"
            :items-per-page="effectiveMeta.limit"
            :total="effectiveMeta.total"
            show-edges
          />
        </div>
      </div>
    </div>
  </UCard>
</template>
