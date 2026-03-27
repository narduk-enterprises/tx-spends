<script setup lang="ts">
import type {
  AdminInvestigationDifficulty,
  AdminInvestigationStatus,
  AdminInvestigationTopicSummary,
} from '~/composables/useAdminInvestigationTopics'

const props = defineProps<{
  loading?: boolean
  topics: AdminInvestigationTopicSummary[]
  selectedTopicId?: string | null
}>()

const searchQuery = shallowRef('')
const statusFilter = shallowRef<'all' | AdminInvestigationStatus>('all')
const laneFilter = shallowRef('all')
const difficultyFilter = shallowRef<'all' | AdminInvestigationDifficulty>('all')

function editHref(topicId: string) {
  return `/admin/investigations/${topicId}`
}

function statusBadgeColor(status: AdminInvestigationStatus) {
  if (status === 'published') return 'success'
  if (status === 'reporting') return 'info'
  if (status === 'drafting') return 'primary'
  if (status === 'parked') return 'neutral'
  return 'warning'
}

function difficultyBadgeColor(difficulty: AdminInvestigationDifficulty) {
  if (difficulty === 'high') return 'error'
  if (difficulty === 'medium_high') return 'warning'
  return 'neutral'
}

function impactLabel(impact: AdminInvestigationTopicSummary['impact']) {
  return impact.replaceAll('_', ' ')
}

function onTopicRowClick(topicId: string, event: MouseEvent) {
  if (event.defaultPrevented || event.button !== 0) return
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  void navigateTo(editHref(topicId))
}

const laneOptions = computed(() => [
  { label: 'All lanes', value: 'all' },
  ...[...new Set(props.topics.map((topic) => topic.lane))]
    .sort((left, right) => left.localeCompare(right))
    .map((lane) => ({ label: lane, value: lane })),
])

const filteredTopics = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()

  return props.topics.filter((topic) => {
    if (statusFilter.value !== 'all' && topic.status !== statusFilter.value) return false
    if (laneFilter.value !== 'all' && topic.lane !== laneFilter.value) return false
    if (difficultyFilter.value !== 'all' && topic.difficulty !== difficultyFilter.value) {
      return false
    }

    if (!query) return true

    return [topic.title, topic.slug, topic.status, topic.lane, topic.flaggedPattern, topic.impact]
      .join(' ')
      .toLowerCase()
      .includes(query)
  })
})
</script>

<template>
  <UCard class="card-base border-default h-full">
    <div
      class="sticky top-0 z-10 flex flex-col gap-3 border-b border-default bg-default/95 px-4 py-3 backdrop-blur supports-backdrop-filter:bg-default/80"
    >
      <div class="space-y-1">
        <p class="text-xs font-semibold uppercase tracking-wider text-primary">Topics</p>
        <h2 class="text-lg font-semibold text-default">Investigations backlog</h2>
      </div>

      <p class="text-sm text-muted">
        Filter the private dossier queue by status, lane, and difficulty, then open a topic in the
        full editor.
      </p>

      <UInput
        v-model="searchQuery"
        icon="i-lucide-search"
        placeholder="Search by title, slug, lane, or flagged pattern"
      />

      <div class="grid gap-3 sm:grid-cols-3">
        <USelect
          v-model="statusFilter"
          :items="[
            { label: 'All statuses', value: 'all' },
            { label: 'Backlog', value: 'backlog' },
            { label: 'Reporting', value: 'reporting' },
            { label: 'Drafting', value: 'drafting' },
            { label: 'Published', value: 'published' },
            { label: 'Parked', value: 'parked' },
          ]"
          color="neutral"
        />

        <USelect v-model="laneFilter" :items="laneOptions" color="neutral" />

        <USelect
          v-model="difficultyFilter"
          :items="[
            { label: 'All difficulties', value: 'all' },
            { label: 'Medium', value: 'medium' },
            { label: 'Medium high', value: 'medium_high' },
            { label: 'High', value: 'high' },
          ]"
          color="neutral"
        />
      </div>
    </div>

    <div class="max-h-[70vh] overflow-y-auto p-3">
      <div v-if="loading" class="flex justify-center py-10">
        <UIcon name="i-lucide-loader-2" class="size-6 animate-spin text-muted" />
      </div>

      <div
        v-else-if="filteredTopics.length === 0"
        class="rounded-lg border border-dashed border-default p-6"
      >
        <p class="text-sm text-muted">No investigation topics matched those filters.</p>
      </div>

      <div v-else class="space-y-2">
        <ULink
          v-for="topic in filteredTopics"
          :key="topic.id"
          :to="editHref(topic.id)"
          class="flex h-auto w-full flex-col gap-3 rounded-lg border px-4 py-3 text-left no-underline outline-none transition hover:border-primary/40 hover:bg-elevated/60 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-default"
          :class="
            topic.id === selectedTopicId
              ? 'border-primary/40 bg-primary/5'
              : 'border-default bg-default'
          "
          @click="onTopicRowClick(topic.id, $event)"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0 flex-1 space-y-1">
              <p class="line-clamp-2 font-medium text-default">
                #{{ topic.priorityRank }} {{ topic.title }}
              </p>
              <p class="truncate text-xs text-muted">{{ topic.slug }}</p>
            </div>

            <UBadge
              :color="statusBadgeColor(topic.status)"
              variant="soft"
              :label="topic.status"
              class="shrink-0 capitalize"
            />
          </div>

          <div class="flex flex-wrap gap-2 text-xs text-muted">
            <UBadge color="neutral" variant="soft" class="capitalize">{{ topic.lane }}</UBadge>
            <UBadge :color="difficultyBadgeColor(topic.difficulty)" variant="soft">
              {{ topic.difficulty.replaceAll('_', ' ') }}
            </UBadge>
            <UBadge color="primary" variant="soft" class="capitalize">
              {{ impactLabel(topic.impact) }}
            </UBadge>
          </div>

          <div class="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
            <span>{{ topic.flaggedPattern }}</span>
            <span>
              Updated
              {{
                new Date(topic.updatedAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })
              }}
            </span>
          </div>
        </ULink>
      </div>
    </div>
  </UCard>
</template>
