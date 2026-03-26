/**
 * Blog post generator.
 *
 * Uses the xAI Grok model (via the layer helper) to turn structured
 * SpotlightFindings into a structured PostBody stored in the database.
 *
 * Content is intentionally conservative: every claim is grounded in the
 * provided data points, and limitations are surfaced in the output.
 */
import type { H3Event } from 'h3'
import { grokChat } from '#layer/server/utils/xai'
import { getSystemPrompt } from '#layer/server/utils/systemPrompts'
import type { SpotlightFindings } from '#server/utils/blog/analyzers'
import { buildPostSlug } from '#server/utils/blog/pure'

export { buildPostSlug } from '#server/utils/blog/pure'

export interface PostSection {
  heading: string
  content: string
}

export interface PostBody {
  intro: string
  sections: PostSection[]
  dataNotes: string
}

export interface GeneratedPost {
  title: string
  excerpt: string
  slug: string
  body: PostBody
  model: string
  promptKey: string
}

export const BLOG_PROMPT_KEY = 'blog-post-generator'

const DEFAULT_BLOG_SYSTEM_PROMPT = `You are a data journalist writing for "Texas State Spending Explorer", a public transparency tool covering Texas state government finances.

Your task: write a factual spotlight article based on the spending data findings supplied by the user. Output a single valid JSON object — no markdown fences, no extra text.

Required JSON schema:
{
  "title": "<concise H1 headline, max 80 chars>",
  "excerpt": "<1-2 sentence summary, max 200 chars>",
  "intro": "<opening paragraph, 2-4 sentences>",
  "sections": [
    { "heading": "<H2 section heading>", "content": "<1-3 paragraphs separated by \\n\\n>" }
  ],
  "dataNotes": "<one paragraph noting data source (Texas Comptroller), fiscal year coverage, and any limitations mentioned in the findings>"
}

Writing rules:
- Ground every claim in the data points provided. Do not invent numbers.
- Use evidence language: "the data shows", "records indicate", "according to state spending records".
- Do not invent county-specific details, vendor identities, or causal relationships not supported by the data.
- Do not make partisan claims or allege corruption without explicit evidence.
- Include 2 to 4 H2 sections. Target total length: 400-600 words across intro + sections.
- Reflect all limitations noted in the findings in the dataNotes field.
- Do not add markdown formatting inside the JSON string values.`

/**
 * Seed and retrieve the blog system prompt from D1 (layer system-prompts table).
 */
async function getBlogSystemPrompt(event: H3Event): Promise<string> {
  return getSystemPrompt(event, BLOG_PROMPT_KEY, {
    [BLOG_PROMPT_KEY]: {
      content: DEFAULT_BLOG_SYSTEM_PROMPT,
      description:
        'System prompt for the daily Texas spending spotlight blog post generator. Controls tone, structure, and accuracy guardrails.',
    },
  })
}

/**
 * Generate a blog post from structured findings using the xAI Grok model.
 *
 * Returns a GeneratedPost with structured body data and a slug.
 * Throws if the model returns malformed JSON.
 */
export async function generateBlogPost(
  event: H3Event,
  findings: SpotlightFindings,
): Promise<GeneratedPost> {
  const config = useRuntimeConfig(event)
  // xaiApiKey is an app-specific runtime config key — cast required since layer types don't include it
  const apiKey = (config as Record<string, string | undefined>).xaiApiKey
  const model = 'grok-3-mini'

  if (!apiKey) {
    throw createError({ statusCode: 500, message: 'XAI_API_KEY is not configured.' })
  }

  const systemPrompt = await getBlogSystemPrompt(event)

  const userMessage = buildUserMessage(findings)

  const rawResponse = await grokChat(apiKey, [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ], model)

  const postBody = parsePostBody(rawResponse)

  const slug = buildPostSlug(findings.angleId)

  return {
    title: postBody.title,
    excerpt: postBody.excerpt,
    slug,
    body: {
      intro: postBody.intro,
      sections: postBody.sections,
      dataNotes: postBody.dataNotes,
    },
    model,
    promptKey: BLOG_PROMPT_KEY,
  }
}

/**
 * Build the user message that describes the findings to Grok.
 */
function buildUserMessage(findings: SpotlightFindings): string {
  const lines: string[] = [
    `Spotlight angle: ${findings.angleName}`,
    `Fiscal year scope: ${findings.fiscalYear ?? 'All years'}`,
    '',
    'Summary sentence to expand: ' + findings.summary,
    '',
    'Data points (use these, do not invent others):',
    ...findings.dataPoints.map((dp) => {
      const ctx = dp.context ? ` [${dp.context}]` : ''
      return `  - ${dp.label}: ${dp.value}${ctx}`
    }),
    '',
    'Known limitations to reflect in dataNotes:',
    ...findings.limitations.map((l) => `  - ${l}`),
  ]
  return lines.join('\n')
}

interface RawPostResponse {
  title: string
  excerpt: string
  intro: string
  sections: Array<{ heading: string; content: string }>
  dataNotes: string
}

/**
 * Parse and validate the JSON body returned by the model.
 */
function parsePostBody(raw: string): RawPostResponse {
  // Strip potential markdown code fences if model ignores the instruction
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw createError({
      statusCode: 500,
      message: `Blog generator returned invalid JSON. Raw: ${cleaned.slice(0, 200)}`,
    })
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw createError({ statusCode: 500, message: 'Blog generator returned a non-object response.' })
  }

  const obj = parsed as Record<string, unknown>

  const title = typeof obj.title === 'string' ? obj.title.slice(0, 120) : 'Texas Spending Spotlight'
  const excerpt = typeof obj.excerpt === 'string' ? obj.excerpt.slice(0, 300) : ''
  const intro = typeof obj.intro === 'string' ? obj.intro : ''
  const dataNotes = typeof obj.dataNotes === 'string' ? obj.dataNotes : ''

  const sections: Array<{ heading: string; content: string }> = []
  if (Array.isArray(obj.sections)) {
    for (const s of obj.sections as unknown[]) {
      if (typeof s === 'object' && s !== null) {
        const sec = s as Record<string, unknown>
        sections.push({
          heading: typeof sec.heading === 'string' ? sec.heading : '',
          content: typeof sec.content === 'string' ? sec.content : '',
        })
      }
    }
  }

  return { title, excerpt, intro, sections, dataNotes }
}
