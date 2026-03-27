<script setup lang="ts">
import type {
  AdminInvestigationTopicDetail,
  AdminInvestigationTopicEditorState,
} from '~/composables/useAdminInvestigationTopics'

const props = defineProps<{
  dirty?: boolean
  loading?: boolean
  saving?: boolean
  topic: AdminInvestigationTopicDetail | null
}>()

const emit = defineEmits<{
  refresh: []
  reset: []
  save: []
}>()

const editorState = defineModel<AdminInvestigationTopicEditorState>({ required: true })

function addSourceReference() {
  editorState.value.sourceReferences.push({ label: '', note: '', url: '' })
}

function removeSourceReference(index: number) {
  editorState.value.sourceReferences.splice(index, 1)
}

function addStringItem(field: 'recordsToObtain' | 'reportingSteps' | 'visualIdeas') {
  editorState.value[field].push('')
}

function removeStringItem(
  field: 'recordsToObtain' | 'reportingSteps' | 'visualIdeas',
  index: number,
) {
  editorState.value[field].splice(index, 1)
}

function updatePriorityRank(value: string | number) {
  const parsed = Number.parseInt(String(value), 10)
  editorState.value.priorityRank = Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}
</script>

<template>
  <UCard class="card-base border-default h-full">
    <div
      class="sticky top-0 z-10 flex flex-col gap-3 border-b border-default bg-default/95 px-4 py-3 backdrop-blur supports-backdrop-filter:bg-default/80"
    >
      <div class="space-y-1">
        <p class="text-xs font-semibold uppercase tracking-wider text-primary">Editor</p>
        <h2 class="text-lg font-semibold text-default">
          {{ topic?.title || 'Select an investigation topic' }}
        </h2>
      </div>

      <div v-if="topic" class="flex flex-wrap items-center gap-2 text-sm text-muted">
        <span>#{{ topic.priorityRank }}</span>
        <span>•</span>
        <span class="capitalize">{{ topic.status }}</span>
        <span>•</span>
        <span>{{ topic.lane }}</span>
      </div>

      <div class="flex flex-wrap gap-2">
        <UButton
          color="neutral"
          variant="outline"
          icon="i-lucide-refresh-cw"
          :disabled="loading"
          @click="emit('refresh')"
        >
          Reload
        </UButton>

        <UButton
          color="neutral"
          variant="outline"
          icon="i-lucide-rotate-ccw"
          :disabled="!dirty || saving"
          @click="emit('reset')"
        >
          Reset
        </UButton>

        <UButton
          color="primary"
          icon="i-lucide-save"
          :disabled="!topic || !dirty"
          :loading="saving"
          @click="emit('save')"
        >
          Save
        </UButton>
      </div>
    </div>

    <div v-if="loading" class="flex justify-center py-16">
      <UIcon name="i-lucide-loader-2" class="size-6 animate-spin text-muted" />
    </div>

    <div v-else-if="!topic" class="p-6">
      <p class="text-sm text-muted">
        Open an investigations dossier from the list to edit its status, sourcing notes, and
        reporting plan.
      </p>
    </div>

    <div v-else class="space-y-6 p-4">
      <div class="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <UFormField label="Slug" description="Internal slug for this dossier.">
          <UInput v-model="editorState.slug" />
        </UFormField>

        <UFormField label="Priority rank" description="Lower numbers sort first in admin.">
          <UInput
            type="number"
            min="1"
            :model-value="String(editorState.priorityRank)"
            @update:model-value="updatePriorityRank"
          />
        </UFormField>

        <UFormField label="Status" description="Current editorial state for the topic.">
          <USelect
            v-model="editorState.status"
            :items="[
              { label: 'Backlog', value: 'backlog' },
              { label: 'Reporting', value: 'reporting' },
              { label: 'Drafting', value: 'drafting' },
              { label: 'Published', value: 'published' },
              { label: 'Parked', value: 'parked' },
            ]"
            color="neutral"
          />
        </UFormField>

        <UFormField label="Impact" description="Expected public relevance.">
          <USelect
            v-model="editorState.impact"
            :items="[
              { label: 'Medium', value: 'medium' },
              { label: 'Medium high', value: 'medium_high' },
              { label: 'High', value: 'high' },
              { label: 'Very high', value: 'very_high' },
            ]"
            color="neutral"
          />
        </UFormField>
      </div>

      <UFormField label="Title" description="Working headline for the investigation dossier.">
        <UInput v-model="editorState.title" />
      </UFormField>

      <div class="grid gap-4 lg:grid-cols-3">
        <UFormField label="Lane" description="Primary reporting lane for the topic.">
          <UInput v-model="editorState.lane" />
        </UFormField>

        <UFormField label="Flagged pattern" description="Original anomaly or oversight pattern.">
          <UInput v-model="editorState.flaggedPattern" />
        </UFormField>

        <UFormField label="Difficulty" description="Expected records and analysis friction.">
          <USelect
            v-model="editorState.difficulty"
            :items="[
              { label: 'Medium', value: 'medium' },
              { label: 'Medium high', value: 'medium_high' },
              { label: 'High', value: 'high' },
            ]"
            color="neutral"
          />
        </UFormField>
      </div>

      <UFormField label="Summary" description="Short explainer for why the topic matters.">
        <UTextarea v-model="editorState.summary" :rows="4" autoresize />
      </UFormField>

      <UFormField
        label="Investigative question"
        description="Core reporting question that should guide records and interviews."
      >
        <UTextarea v-model="editorState.investigativeQuestion" :rows="4" autoresize />
      </UFormField>

      <UFormField label="Public impact" description="Why the finished reporting would matter.">
        <UTextarea v-model="editorState.publicImpact" :rows="4" autoresize />
      </UFormField>

      <UFormField label="Notes" description="Editorial cautions, caveats, and framing reminders.">
        <UTextarea v-model="editorState.notes" :rows="5" autoresize />
      </UFormField>

      <UCard variant="subtle">
        <div class="space-y-4">
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="text-sm font-semibold text-default">Source references</p>
              <p class="text-sm text-muted">
                Keep these as human-readable source lanes. URLs can stay empty until verified.
              </p>
            </div>

            <UButton
              color="neutral"
              variant="outline"
              icon="i-lucide-plus"
              @click="addSourceReference"
            >
              Add source
            </UButton>
          </div>

          <div
            v-if="editorState.sourceReferences.length === 0"
            class="rounded-lg border border-dashed border-default p-4"
          >
            <p class="text-sm text-muted">No source references yet.</p>
          </div>

          <div v-else class="space-y-4">
            <UCard
              v-for="(reference, index) in editorState.sourceReferences"
              :key="index"
              variant="outline"
            >
              <div class="space-y-4">
                <div class="flex items-center justify-between gap-3">
                  <p class="text-sm font-semibold text-default">Source {{ index + 1 }}</p>
                  <UButton
                    color="error"
                    variant="ghost"
                    icon="i-lucide-trash-2"
                    @click="removeSourceReference(index)"
                  >
                    Remove
                  </UButton>
                </div>

                <UFormField label="Label">
                  <UInput v-model="reference.label" />
                </UFormField>

                <UFormField label="Note">
                  <UTextarea v-model="reference.note" :rows="3" autoresize />
                </UFormField>

                <UFormField label="URL">
                  <UInput v-model="reference.url" placeholder="Leave blank until verified" />
                </UFormField>
              </div>
            </UCard>
          </div>
        </div>
      </UCard>

      <UCard variant="subtle">
        <div class="space-y-4">
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="text-sm font-semibold text-default">Records to obtain</p>
              <p class="text-sm text-muted">
                Concrete document requests, datasets, or disclosures needed for the story.
              </p>
            </div>

            <UButton
              color="neutral"
              variant="outline"
              icon="i-lucide-plus"
              @click="addStringItem('recordsToObtain')"
            >
              Add record
            </UButton>
          </div>

          <div
            v-if="editorState.recordsToObtain.length === 0"
            class="rounded-lg border border-dashed border-default p-4"
          >
            <p class="text-sm text-muted">No record targets yet.</p>
          </div>

          <div v-else class="space-y-3">
            <div
              v-for="(item, index) in editorState.recordsToObtain"
              :key="`record-${index}`"
              class="flex gap-3"
            >
              <UTextarea v-model="editorState.recordsToObtain[index]" :rows="2" autoresize />
              <UButton
                color="error"
                variant="ghost"
                icon="i-lucide-trash-2"
                class="self-start"
                @click="removeStringItem('recordsToObtain', index)"
              />
            </div>
          </div>
        </div>
      </UCard>

      <UCard variant="subtle">
        <div class="space-y-4">
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="text-sm font-semibold text-default">Reporting steps</p>
              <p class="text-sm text-muted">
                The concrete workflow for validating and advancing the investigation.
              </p>
            </div>

            <UButton
              color="neutral"
              variant="outline"
              icon="i-lucide-plus"
              @click="addStringItem('reportingSteps')"
            >
              Add step
            </UButton>
          </div>

          <div
            v-if="editorState.reportingSteps.length === 0"
            class="rounded-lg border border-dashed border-default p-4"
          >
            <p class="text-sm text-muted">No reporting steps yet.</p>
          </div>

          <div v-else class="space-y-3">
            <div
              v-for="(item, index) in editorState.reportingSteps"
              :key="`step-${index}`"
              class="flex gap-3"
            >
              <UTextarea v-model="editorState.reportingSteps[index]" :rows="2" autoresize />
              <UButton
                color="error"
                variant="ghost"
                icon="i-lucide-trash-2"
                class="self-start"
                @click="removeStringItem('reportingSteps', index)"
              />
            </div>
          </div>
        </div>
      </UCard>

      <UCard variant="subtle">
        <div class="space-y-4">
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="text-sm font-semibold text-default">Visual ideas</p>
              <p class="text-sm text-muted">
                Graphics, charts, and maps that would make the reporting easier to follow.
              </p>
            </div>

            <UButton
              color="neutral"
              variant="outline"
              icon="i-lucide-plus"
              @click="addStringItem('visualIdeas')"
            >
              Add visual
            </UButton>
          </div>

          <div
            v-if="editorState.visualIdeas.length === 0"
            class="rounded-lg border border-dashed border-default p-4"
          >
            <p class="text-sm text-muted">No visual ideas yet.</p>
          </div>

          <div v-else class="space-y-3">
            <div
              v-for="(item, index) in editorState.visualIdeas"
              :key="`visual-${index}`"
              class="flex gap-3"
            >
              <UTextarea v-model="editorState.visualIdeas[index]" :rows="2" autoresize />
              <UButton
                color="error"
                variant="ghost"
                icon="i-lucide-trash-2"
                class="self-start"
                @click="removeStringItem('visualIdeas', index)"
              />
            </div>
          </div>
        </div>
      </UCard>
    </div>
  </UCard>
</template>
