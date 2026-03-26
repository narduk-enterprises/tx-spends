<script setup lang="ts">
import type {
  AdminBlogEditorState,
  AdminBlogFindings,
  AdminBlogPostDetail,
  AdminBlogPreviewPost,
  AdminBlogStatus,
} from '~/composables/useAdminBlogPosts'

const props = defineProps<{
  dirty?: boolean
  loading?: boolean
  post: AdminBlogPostDetail | null
  previewPost: AdminBlogPreviewPost | null
  saving?: boolean
  statusAction?: AdminBlogStatus | null
}>()

const emit = defineEmits<{
  addSection: []
  archive: []
  moveToDraft: []
  publish: []
  refresh: []
  removeSection: [index: number]
  reset: []
  save: []
}>()

const editorState = defineModel<AdminBlogEditorState>({ required: true })
const activeTab = shallowRef<'edit' | 'preview'>('edit')

const findings = computed<AdminBlogFindings | null>(() => props.post?.findingsJson ?? null)
const livePath = computed(() =>
  props.post?.status === 'published' ? `/blog/${props.post.slug}` : null,
)
</script>

<template>
  <UCard class="card-base border-default h-full">
    <div
      class="sticky top-0 z-10 flex flex-col gap-3 border-b border-default bg-default/95 px-4 py-3 backdrop-blur supports-backdrop-filter:bg-default/80"
    >
      <div class="space-y-1">
        <p class="text-xs font-semibold uppercase tracking-wider text-primary">Editor</p>
        <h2 class="text-lg font-semibold text-default">
          {{ post?.title || 'Select a spotlight post' }}
        </h2>
      </div>

      <div v-if="post" class="flex flex-wrap items-center gap-2 text-sm text-muted">
        <span>{{ post.angleName || 'No angle assigned' }}</span>
        <span>•</span>
        <span class="capitalize">{{ post.status }}</span>
        <span v-if="post.generationModel">• {{ post.generationModel }}</span>
      </div>

      <div class="flex flex-wrap gap-2">
        <UButton
          v-if="livePath"
          :to="livePath"
          target="_blank"
          color="neutral"
          variant="soft"
          icon="i-lucide-external-link"
        >
          View live page
        </UButton>

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
          :disabled="!post || !dirty"
          :loading="saving"
          @click="emit('save')"
        >
          Save
        </UButton>

        <UButton
          v-if="post?.status !== 'published'"
          color="success"
          variant="soft"
          icon="i-lucide-send"
          :disabled="!post"
          :loading="statusAction === 'published'"
          @click="emit('publish')"
        >
          Publish
        </UButton>

        <UButton
          v-if="post?.status !== 'draft'"
          color="warning"
          variant="soft"
          icon="i-lucide-file-pen"
          :disabled="!post"
          :loading="statusAction === 'draft'"
          @click="emit('moveToDraft')"
        >
          Move to draft
        </UButton>

        <UButton
          v-if="post?.status !== 'archived'"
          color="neutral"
          variant="soft"
          icon="i-lucide-archive"
          :disabled="!post"
          :loading="statusAction === 'archived'"
          @click="emit('archive')"
        >
          Archive
        </UButton>
      </div>
    </div>

    <div v-if="loading" class="flex justify-center py-16">
      <UIcon name="i-lucide-loader-2" class="size-6 animate-spin text-muted" />
    </div>

    <div v-else-if="!post" class="p-6">
      <p class="text-sm text-muted">
        Open a spotlight article from the list to edit its slug, copy, and structured body.
      </p>
    </div>

    <div v-else class="p-4">
      <UTabs
        v-model="activeTab"
        :items="[
          { label: 'Edit', value: 'edit', icon: 'i-lucide-square-pen' },
          { label: 'Preview', value: 'preview', icon: 'i-lucide-eye' },
        ]"
        class="w-full"
      >
        <template #content="{ item }">
          <div v-if="item.value === 'edit'" class="space-y-6 pt-4">
            <div class="grid gap-4 md:grid-cols-3">
              <UFormField label="Slug" description="Used in the public `/blog/...` URL.">
                <UInput v-model="editorState.slug" />
              </UFormField>

              <UFormField label="Title" description="Keep headlines concise and evidence-backed.">
                <UInput v-model="editorState.title" />
              </UFormField>

              <UFormField
                label="Byline"
                description="Shown on the public article page and blog cards."
              >
                <UInput v-model="editorState.author" />
              </UFormField>
            </div>

            <UFormField
              label="Excerpt"
              description="Short deck used on the blog index and social previews."
            >
              <UTextarea v-model="editorState.excerpt" :rows="3" autoresize />
            </UFormField>

            <UFormField label="Introduction" description="Opening paragraph for the article page.">
              <UTextarea v-model="editorState.intro" :rows="5" autoresize />
            </UFormField>

            <div class="space-y-4">
              <div class="flex items-center justify-between gap-3">
                <div>
                  <p class="text-sm font-semibold text-default">Sections</p>
                  <p class="text-sm text-muted">
                    Mirror the public article structure with clear headings and 1-3 paragraphs per
                    section.
                  </p>
                </div>

                <UButton
                  color="neutral"
                  variant="outline"
                  icon="i-lucide-plus"
                  @click="emit('addSection')"
                >
                  Add section
                </UButton>
              </div>

              <div
                v-if="editorState.sections.length === 0"
                class="rounded-lg border border-dashed border-default p-4"
              >
                <p class="text-sm text-muted">No sections yet. Add one to build the body.</p>
              </div>

              <div v-else class="space-y-4">
                <UCard
                  v-for="(section, index) in editorState.sections"
                  :key="index"
                  variant="subtle"
                >
                  <div class="space-y-4">
                    <div class="flex items-center justify-between gap-3">
                      <p class="text-sm font-semibold text-default">Section {{ index + 1 }}</p>
                      <UButton
                        color="error"
                        variant="ghost"
                        icon="i-lucide-trash-2"
                        @click="emit('removeSection', index)"
                      >
                        Remove
                      </UButton>
                    </div>

                    <UFormField label="Heading">
                      <UInput v-model="section.heading" />
                    </UFormField>

                    <UFormField label="Content" description="Separate paragraphs with blank lines.">
                      <UTextarea v-model="section.content" :rows="8" autoresize />
                    </UFormField>
                  </div>
                </UCard>
              </div>
            </div>

            <UFormField
              label="Data notes"
              description="Cite the data source, fiscal-year scope, and key limitations."
            >
              <UTextarea v-model="editorState.dataNotes" :rows="4" autoresize />
            </UFormField>

            <div
              v-if="findings?.dataPoints?.length"
              class="rounded-xl border border-default bg-muted/20 p-4"
            >
              <div class="mb-3 space-y-1">
                <p class="text-xs font-semibold uppercase tracking-wider text-primary">Evidence</p>
                <h3 class="text-base font-semibold text-default">Analyzer snapshot</h3>
                <p v-if="findings.summary" class="text-sm text-muted">
                  {{ findings.summary }}
                </p>
              </div>

              <ul class="space-y-2 text-sm text-default">
                <li v-for="(point, index) in findings.dataPoints" :key="`${point.label}-${index}`">
                  <span class="font-medium">{{ point.label }}:</span>
                  {{ point.value }}
                  <span v-if="point.context" class="text-muted">({{ point.context }})</span>
                </li>
              </ul>
            </div>
          </div>

          <div v-else class="pt-4">
            <AdminBlogPostPagePreview :post="previewPost" />
          </div>
        </template>
      </UTabs>
    </div>
  </UCard>
</template>
