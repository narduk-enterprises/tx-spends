export type AdminBlogStatus = 'draft' | 'published' | 'archived'

export interface AdminBlogSection {
  heading: string
  content: string
}

export interface AdminBlogBody {
  intro: string
  sections: AdminBlogSection[]
  dataNotes: string
}

export interface AdminBlogFindingPoint {
  label: string
  value: string
  context?: string
}

export interface AdminBlogFindings {
  angleId?: string
  angleName?: string
  fiscalYear?: number | null
  summary?: string
  dataPoints?: AdminBlogFindingPoint[]
  limitations?: string[]
}

export interface AdminBlogPostSummary {
  id: string
  slug: string
  title: string
  excerpt: string
  status: AdminBlogStatus
  angleId: string | null
  angleName: string | null
  publishedAt: string | null
  indexNowSubmitted: boolean
  createdAt: string
  updatedAt: string
}

export interface AdminBlogPostDetail extends AdminBlogPostSummary {
  body: AdminBlogBody
  analyzerRunId: string | null
  findingsJson: AdminBlogFindings | null
  generationModel: string | null
  generationPromptKey: string | null
}

export interface AdminBlogEditorState {
  slug: string
  title: string
  excerpt: string
  intro: string
  dataNotes: string
  sections: AdminBlogSection[]
}

export interface AdminBlogPreviewPost {
  id: string
  slug: string
  title: string
  excerpt: string
  status: AdminBlogStatus
  angleName: string | null
  publishedAt: string | null
  body: AdminBlogBody
}

interface AdminBlogPostSummaryResponse {
  id: string
  slug: string
  title: string
  excerpt: string
  status: AdminBlogStatus
  angle_id: string | null
  angle_name: string | null
  published_at: string | null
  index_now_submitted: boolean
  created_at: string
  updated_at: string
}

interface AdminBlogPostDetailResponse extends AdminBlogPostSummaryResponse {
  body: AdminBlogBody
  analyzer_run_id: string | null
  findings_json: AdminBlogFindings | null
  generation_model: string | null
  generation_prompt_key: string | null
}

interface AdminBlogListApiResponse {
  data: AdminBlogPostSummaryResponse[]
}

interface AdminBlogDetailApiResponse {
  data: AdminBlogPostDetailResponse
}

interface AdminBlogStatusApiResponse {
  data: AdminBlogPostDetailResponse
  meta: {
    changed: boolean
    index_now: { success: boolean; submitted: number } | null
  }
}

interface AdminBlogGenerateApiResponse {
  ok: boolean
  skipped?: boolean
  reason?: string
  post_id?: string
  slug?: string
  status?: AdminBlogStatus
  title?: string
}

function emptyBody(): AdminBlogBody {
  return {
    intro: '',
    sections: [],
    dataNotes: '',
  }
}

function emptyEditorState(): AdminBlogEditorState {
  return {
    slug: '',
    title: '',
    excerpt: '',
    intro: '',
    dataNotes: '',
    sections: [],
  }
}

function normalizeBody(body: AdminBlogBody | null | undefined): AdminBlogBody {
  if (!body) return emptyBody()

  return {
    intro: body.intro ?? '',
    sections: Array.isArray(body.sections)
      ? body.sections.map((section) => ({
          heading: section.heading ?? '',
          content: section.content ?? '',
        }))
      : [],
    dataNotes: body.dataNotes ?? '',
  }
}

function normalizeSummary(post: AdminBlogPostSummaryResponse): AdminBlogPostSummary {
  return {
    id: post.id,
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    status: post.status,
    angleId: post.angle_id,
    angleName: post.angle_name,
    publishedAt: post.published_at,
    indexNowSubmitted: post.index_now_submitted,
    createdAt: post.created_at,
    updatedAt: post.updated_at,
  }
}

function normalizeDetail(post: AdminBlogPostDetailResponse): AdminBlogPostDetail {
  return {
    ...normalizeSummary(post),
    body: normalizeBody(post.body),
    analyzerRunId: post.analyzer_run_id,
    findingsJson: post.findings_json ?? null,
    generationModel: post.generation_model,
    generationPromptKey: post.generation_prompt_key,
  }
}

function toEditorState(post: AdminBlogPostDetail | null): AdminBlogEditorState {
  if (!post) return emptyEditorState()

  return {
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    intro: post.body.intro,
    dataNotes: post.body.dataNotes,
    sections: post.body.sections.map((section) => ({ ...section })),
  }
}

function normalizeEditorState(state: AdminBlogEditorState) {
  return {
    slug: state.slug.trim(),
    title: state.title.trim(),
    excerpt: state.excerpt.trim(),
    body: {
      intro: state.intro.trim(),
      dataNotes: state.dataNotes.trim(),
      sections: state.sections
        .map((section) => ({
          heading: section.heading.trim(),
          content: section.content.trim(),
        }))
        .filter((section) => section.heading.length > 0 || section.content.length > 0),
    },
  }
}

export function useAdminBlogPosts() {
  const appFetch = useAppFetch()
  const toast = useToast()

  const selectedPostId = useState<string | null>('admin-blog-selected-post-id', () => null)
  const editorState = ref<AdminBlogEditorState>(emptyEditorState())
  const isSaving = shallowRef(false)
  const generateAction = shallowRef<'draft' | 'published' | null>(null)
  const statusAction = shallowRef<AdminBlogStatus | null>(null)

  const {
    data: posts,
    status: postsStatus,
    refresh: refreshPosts,
  } = useAsyncData(
    'admin-blog-posts',
    async () => {
      const response = await appFetch<AdminBlogListApiResponse>('/api/admin/blog/posts')
      return response.data.map(normalizeSummary)
    },
    {
      default: () => [],
    },
  )

  watch(
    posts,
    (items) => {
      if (items.length === 0) {
        selectedPostId.value = null
        return
      }

      if (selectedPostId.value && !items.some((item) => item.id === selectedPostId.value)) {
        selectedPostId.value = null
      }
    },
    { immediate: true },
  )

  const {
    data: selectedPost,
    status: selectedPostStatus,
    refresh: refreshSelectedPost,
  } = useAsyncData<AdminBlogPostDetail | null>(
    () => `admin-blog-post-${selectedPostId.value ?? 'none'}`,
    async () => {
      if (!selectedPostId.value) return null

      const response = await appFetch<AdminBlogDetailApiResponse>(
        `/api/admin/blog/posts/${selectedPostId.value}`,
      )
      return normalizeDetail(response.data)
    },
    {
      watch: [selectedPostId],
      default: () => null,
    },
  )

  watch(
    selectedPost,
    (post) => {
      editorState.value = toEditorState(post)
    },
    { immediate: true },
  )

  const isDirty = computed(() => {
    return (
      JSON.stringify(normalizeEditorState(editorState.value)) !==
      JSON.stringify(normalizeEditorState(toEditorState(selectedPost.value)))
    )
  })

  const draftCount = computed(() => posts.value.filter((post) => post.status === 'draft').length)
  const publishedCount = computed(
    () => posts.value.filter((post) => post.status === 'published').length,
  )
  const archivedCount = computed(
    () => posts.value.filter((post) => post.status === 'archived').length,
  )

  const previewPost = computed<AdminBlogPreviewPost | null>(() => {
    if (!selectedPost.value) return null

    const normalized = normalizeEditorState(editorState.value)
    return {
      id: selectedPost.value.id,
      slug: normalized.slug,
      title: normalized.title,
      excerpt: normalized.excerpt,
      status: selectedPost.value.status,
      angleName: selectedPost.value.angleName,
      publishedAt: selectedPost.value.publishedAt,
      body: normalized.body,
    }
  })

  function selectPost(postId: string | null) {
    selectedPostId.value = postId
  }

  function resetEditor() {
    editorState.value = toEditorState(selectedPost.value)
  }

  function addSection() {
    editorState.value.sections.push({ heading: '', content: '' })
  }

  function removeSection(index: number) {
    editorState.value.sections.splice(index, 1)
  }

  async function saveCurrentPost() {
    if (!selectedPost.value) return

    isSaving.value = true
    try {
      const response = await appFetch<AdminBlogDetailApiResponse>(
        `/api/admin/blog/posts/${selectedPost.value.id}`,
        {
          method: 'PUT',
          body: normalizeEditorState(editorState.value),
        },
      )

      selectedPost.value = normalizeDetail(response.data)
      editorState.value = toEditorState(selectedPost.value)
      await refreshPosts()

      toast.add({
        title: 'Spotlight post saved',
        description: 'Your edits are live in the admin workspace.',
        color: 'success',
      })
    } catch (error: unknown) {
      toast.add({
        title: 'Save failed',
        description: error instanceof Error ? error.message : 'Unable to save this blog post.',
        color: 'error',
      })
    } finally {
      isSaving.value = false
    }
  }

  async function updateStatus(status: AdminBlogStatus) {
    if (!selectedPost.value) return

    statusAction.value = status
    try {
      const response = await appFetch<AdminBlogStatusApiResponse>(
        `/api/admin/blog/posts/${selectedPost.value.id}/status`,
        {
          method: 'POST',
          body: { status },
        },
      )

      selectedPost.value = normalizeDetail(response.data)
      editorState.value = toEditorState(selectedPost.value)
      await refreshPosts()

      toast.add({
        title: status === 'published' ? 'Post published' : 'Status updated',
        description:
          status === 'published'
            ? 'The spotlight article is now visible on the public blog.'
            : `Post moved to ${status}.`,
        color: 'success',
      })
    } catch (error: unknown) {
      toast.add({
        title: 'Status update failed',
        description:
          error instanceof Error ? error.message : 'Unable to update the blog post status.',
        color: 'error',
      })
    } finally {
      statusAction.value = null
    }
  }

  async function generatePost(options: { publish?: boolean } = {}) {
    const publish = Boolean(options.publish)
    generateAction.value = publish ? 'published' : 'draft'

    try {
      const response = await appFetch<AdminBlogGenerateApiResponse>('/api/blog/preview', {
        method: 'POST',
        body: { publish },
      })

      await refreshPosts()

      if (response.post_id) {
        selectedPostId.value = response.post_id
        await navigateTo(`/admin/blog/${response.post_id}`)
      }

      toast.add({
        title: publish ? 'Spotlight publish requested' : 'Draft generated',
        description:
          response.reason ??
          (publish
            ? 'The daily spotlight flow completed from the admin console.'
            : 'A fresh spotlight draft is ready to edit.'),
        color: 'success',
      })

      return response
    } catch (error: unknown) {
      toast.add({
        title: publish ? 'Publish failed' : 'Generation failed',
        description:
          error instanceof Error ? error.message : 'Unable to generate a spotlight post.',
        color: 'error',
      })
      throw error
    } finally {
      generateAction.value = null
    }
  }

  return {
    archivedCount,
    addSection,
    draftCount,
    editorState,
    generateAction,
    generatePost,
    isDirty,
    isSaving,
    posts,
    postsStatus,
    previewPost,
    publishedCount,
    refreshPosts,
    refreshSelectedPost,
    removeSection,
    resetEditor,
    saveCurrentPost,
    selectPost,
    selectedPost,
    selectedPostId,
    selectedPostStatus,
    statusAction,
    updateStatus,
  }
}
