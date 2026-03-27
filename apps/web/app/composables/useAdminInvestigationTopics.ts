export type AdminInvestigationStatus = 'backlog' | 'reporting' | 'drafting' | 'published' | 'parked'

export type AdminInvestigationImpact = 'medium' | 'medium_high' | 'high' | 'very_high'
export type AdminInvestigationDifficulty = 'medium' | 'medium_high' | 'high'

export interface AdminInvestigationSourceReference {
  label: string
  note: string
  url: string
}

export interface AdminInvestigationTopicSummary {
  id: string
  slug: string
  title: string
  priorityRank: number
  status: AdminInvestigationStatus
  lane: string
  flaggedPattern: string
  impact: AdminInvestigationImpact
  difficulty: AdminInvestigationDifficulty
  createdAt: string
  updatedAt: string
}

export interface AdminInvestigationTopicDetail extends AdminInvestigationTopicSummary {
  summary: string
  investigativeQuestion: string
  publicImpact: string
  notes: string
  sourceReferences: AdminInvestigationSourceReference[]
  recordsToObtain: string[]
  reportingSteps: string[]
  visualIdeas: string[]
}

export interface AdminInvestigationTopicEditorState {
  slug: string
  title: string
  priorityRank: number
  status: AdminInvestigationStatus
  lane: string
  flaggedPattern: string
  impact: AdminInvestigationImpact
  difficulty: AdminInvestigationDifficulty
  summary: string
  investigativeQuestion: string
  publicImpact: string
  notes: string
  sourceReferences: AdminInvestigationSourceReference[]
  recordsToObtain: string[]
  reportingSteps: string[]
  visualIdeas: string[]
}

interface AdminInvestigationTopicSummaryResponse {
  id: string
  slug: string
  title: string
  priority_rank: number
  status: AdminInvestigationStatus
  lane: string
  flagged_pattern: string
  impact: AdminInvestigationImpact
  difficulty: AdminInvestigationDifficulty
  created_at: string
  updated_at: string
}

interface AdminInvestigationTopicDetailResponse extends AdminInvestigationTopicSummaryResponse {
  summary: string
  investigative_question: string
  public_impact: string
  notes: string
  source_references: Array<{ label: string; note: string; url: string | null }>
  records_to_obtain: string[]
  reporting_steps: string[]
  visual_ideas: string[]
}

interface AdminInvestigationTopicListApiResponse {
  data: AdminInvestigationTopicSummaryResponse[]
}

interface AdminInvestigationTopicDetailApiResponse {
  data: AdminInvestigationTopicDetailResponse
}

function emptyEditorState(): AdminInvestigationTopicEditorState {
  return {
    slug: '',
    title: '',
    priorityRank: 1,
    status: 'backlog',
    lane: '',
    flaggedPattern: '',
    impact: 'medium',
    difficulty: 'medium',
    summary: '',
    investigativeQuestion: '',
    publicImpact: '',
    notes: '',
    sourceReferences: [],
    recordsToObtain: [],
    reportingSteps: [],
    visualIdeas: [],
  }
}

function normalizeSourceReferences(
  value: Array<{ label: string; note: string; url: string | null }> | null | undefined,
) {
  return Array.isArray(value)
    ? value.map((reference) => ({
        label: reference.label ?? '',
        note: reference.note ?? '',
        url: reference.url ?? '',
      }))
    : []
}

function normalizeStringList(value: string[] | null | undefined) {
  return Array.isArray(value) ? value.map((item) => item ?? '') : []
}

function normalizeSummary(
  topic: AdminInvestigationTopicSummaryResponse,
): AdminInvestigationTopicSummary {
  return {
    id: topic.id,
    slug: topic.slug,
    title: topic.title,
    priorityRank: topic.priority_rank,
    status: topic.status,
    lane: topic.lane,
    flaggedPattern: topic.flagged_pattern,
    impact: topic.impact,
    difficulty: topic.difficulty,
    createdAt: topic.created_at,
    updatedAt: topic.updated_at,
  }
}

function normalizeDetail(
  topic: AdminInvestigationTopicDetailResponse,
): AdminInvestigationTopicDetail {
  return {
    ...normalizeSummary(topic),
    summary: topic.summary,
    investigativeQuestion: topic.investigative_question,
    publicImpact: topic.public_impact,
    notes: topic.notes,
    sourceReferences: normalizeSourceReferences(topic.source_references),
    recordsToObtain: normalizeStringList(topic.records_to_obtain),
    reportingSteps: normalizeStringList(topic.reporting_steps),
    visualIdeas: normalizeStringList(topic.visual_ideas),
  }
}

function toEditorState(
  topic: AdminInvestigationTopicDetail | null,
): AdminInvestigationTopicEditorState {
  if (!topic) return emptyEditorState()

  return {
    slug: topic.slug,
    title: topic.title,
    priorityRank: topic.priorityRank,
    status: topic.status,
    lane: topic.lane,
    flaggedPattern: topic.flaggedPattern,
    impact: topic.impact,
    difficulty: topic.difficulty,
    summary: topic.summary,
    investigativeQuestion: topic.investigativeQuestion,
    publicImpact: topic.publicImpact,
    notes: topic.notes,
    sourceReferences: topic.sourceReferences.map((reference) => ({ ...reference })),
    recordsToObtain: [...topic.recordsToObtain],
    reportingSteps: [...topic.reportingSteps],
    visualIdeas: [...topic.visualIdeas],
  }
}

function normalizeEditorState(state: AdminInvestigationTopicEditorState) {
  return {
    slug: state.slug.trim(),
    title: state.title.trim(),
    priorityRank: state.priorityRank,
    status: state.status,
    lane: state.lane.trim(),
    flaggedPattern: state.flaggedPattern.trim(),
    impact: state.impact,
    difficulty: state.difficulty,
    summary: state.summary.trim(),
    investigativeQuestion: state.investigativeQuestion.trim(),
    publicImpact: state.publicImpact.trim(),
    notes: state.notes.trim(),
    sourceReferences: state.sourceReferences
      .map((reference) => ({
        label: reference.label.trim(),
        note: reference.note.trim(),
        url: reference.url.trim() || null,
      }))
      .filter((reference) => reference.label || reference.note || reference.url),
    recordsToObtain: state.recordsToObtain
      .map((item) => item.trim())
      .filter((item) => item.length > 0),
    reportingSteps: state.reportingSteps
      .map((item) => item.trim())
      .filter((item) => item.length > 0),
    visualIdeas: state.visualIdeas.map((item) => item.trim()).filter((item) => item.length > 0),
  }
}

export function useAdminInvestigationTopics() {
  const appFetch = useAppFetch()
  const toast = useToast()

  const selectedTopicId = useState<string | null>(
    'admin-investigation-selected-topic-id',
    () => null,
  )
  const editorState = ref<AdminInvestigationTopicEditorState>(emptyEditorState())
  const isSaving = shallowRef(false)

  const {
    data: topics,
    status: topicsStatus,
    refresh: refreshTopics,
  } = useAsyncData(
    'admin-investigation-topics',
    async () => {
      const response = await appFetch<AdminInvestigationTopicListApiResponse>(
        '/api/admin/investigations/topics',
      )
      return response.data.map(normalizeSummary)
    },
    {
      default: () => [],
    },
  )

  watch(
    topics,
    (items) => {
      if (items.length === 0) {
        selectedTopicId.value = null
        return
      }

      if (selectedTopicId.value && !items.some((item) => item.id === selectedTopicId.value)) {
        selectedTopicId.value = null
      }
    },
    { immediate: true },
  )

  const {
    data: selectedTopic,
    status: selectedTopicStatus,
    refresh: refreshSelectedTopic,
  } = useAsyncData<AdminInvestigationTopicDetail | null>(
    () => `admin-investigation-topic-${selectedTopicId.value ?? 'none'}`,
    async () => {
      if (!selectedTopicId.value) return null

      const response = await appFetch<AdminInvestigationTopicDetailApiResponse>(
        `/api/admin/investigations/topics/${selectedTopicId.value}`,
      )
      return normalizeDetail(response.data)
    },
    {
      watch: [selectedTopicId],
      default: () => null,
    },
  )

  watch(
    selectedTopic,
    (topic) => {
      editorState.value = toEditorState(topic)
    },
    { immediate: true },
  )

  const isDirty = computed(() => {
    return (
      JSON.stringify(normalizeEditorState(editorState.value)) !==
      JSON.stringify(normalizeEditorState(toEditorState(selectedTopic.value)))
    )
  })

  const statusCounts = computed(() => ({
    backlog: topics.value.filter((topic) => topic.status === 'backlog').length,
    reporting: topics.value.filter((topic) => topic.status === 'reporting').length,
    drafting: topics.value.filter((topic) => topic.status === 'drafting').length,
    published: topics.value.filter((topic) => topic.status === 'published').length,
    parked: topics.value.filter((topic) => topic.status === 'parked').length,
  }))

  function selectTopic(topicId: string | null) {
    selectedTopicId.value = topicId
  }

  function resetEditor() {
    editorState.value = toEditorState(selectedTopic.value)
  }

  async function saveCurrentTopic() {
    if (!selectedTopic.value) return

    isSaving.value = true
    try {
      const response = await appFetch<AdminInvestigationTopicDetailApiResponse>(
        `/api/admin/investigations/topics/${selectedTopic.value.id}`,
        {
          method: 'PUT',
          body: normalizeEditorState(editorState.value),
        },
      )

      selectedTopic.value = normalizeDetail(response.data)
      editorState.value = toEditorState(selectedTopic.value)
      await refreshTopics()

      toast.add({
        title: 'Investigation topic saved',
        description: 'Your dossier edits are now stored in the investigations backlog.',
        color: 'success',
      })
    } catch (error: unknown) {
      toast.add({
        title: 'Save failed',
        description:
          error instanceof Error ? error.message : 'Unable to save this investigation topic.',
        color: 'error',
      })
    } finally {
      isSaving.value = false
    }
  }

  return {
    editorState,
    isDirty,
    isSaving,
    refreshSelectedTopic,
    refreshTopics,
    resetEditor,
    saveCurrentTopic,
    selectTopic,
    selectedTopic,
    selectedTopicId,
    selectedTopicStatus,
    statusCounts,
    topics,
    topicsStatus,
  }
}
