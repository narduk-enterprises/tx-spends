import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import postgres from 'postgres'
import type { H3Event } from 'h3'
import { BLOG_ANGLE_DEFINITIONS } from '#server/utils/blog/angles'
import type { SpotlightFindings } from '#server/utils/blog/analyzers'
import { runAnalyzer } from '#server/utils/blog/analyzers'
import {
  BLOG_PROMPT_KEY,
  DEFAULT_BLOG_SYSTEM_PROMPT,
  buildUserMessage,
  parsePostBody,
  type RawPostResponse,
} from '#server/utils/blog/generator'
import { buildPostSlug } from '#server/utils/blog/pure'
import { grokChat } from '#layer/server/utils/xai'

type PromptSource = 'default' | 'stored' | 'file'
type Classification = 'ready' | 'prompt' | 'analyzer' | 'generator'

interface CliOptions {
  angleId: string
  model: string
  promptFile?: string
  promptSource: Exclude<PromptSource, 'file'>
  json: boolean
  includeRaw: boolean
}

interface QualitySignal {
  code: string
  severity: 'info' | 'warn' | 'error'
  message: string
}

interface DryRunReport {
  angleId: string
  angleName: string
  model: string
  promptSource: PromptSource
  promptName: string
  slugPreview: string
  findings: SpotlightFindings
  generated: RawPostResponse
  rawResponse?: string
  signals: QualitySignal[]
  classification: Classification
}

function printUsage(): never {
  console.log(`Usage:
  doppler run --config prd -- pnpm run blog:dry-run -- [options]

Options:
  --angle <id>           Spotlight angle id (default: agency-spend-leaders)
  --model <id>           xAI model id (default: grok-3-mini)
  --prompt-source <id>   default | stored (default: default)
  --prompt-file <path>   Load a local prompt file instead of DB/default
  --json                 Print the full report as JSON
  --raw                  Include the raw model response in stdout output
  --help                 Show this help
`)
  process.exit(0)
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    angleId: 'agency-spend-leaders',
    model: 'grok-3-mini',
    promptSource: 'default',
    json: false,
    includeRaw: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--help' || arg === '-h') {
      printUsage()
    }

    if (arg === '--json') {
      options.json = true
      continue
    }

    if (arg === '--raw') {
      options.includeRaw = true
      continue
    }

    const next = argv[index + 1]

    if (arg === '--angle') {
      if (!next) throw new Error('Missing value for --angle.')
      options.angleId = next
      index += 1
      continue
    }

    if (arg === '--model') {
      if (!next) throw new Error('Missing value for --model.')
      options.model = next
      index += 1
      continue
    }

    if (arg === '--prompt-source') {
      if (!next) throw new Error('Missing value for --prompt-source.')
      if (next !== 'default' && next !== 'stored') {
        throw new Error(`Unsupported prompt source: ${next}`)
      }
      options.promptSource = next
      index += 1
      continue
    }

    if (arg === '--prompt-file') {
      if (!next) throw new Error('Missing value for --prompt-file.')
      options.promptFile = next
      index += 1
      continue
    }

    throw new Error(`Unknown argument: ${arg}`)
  }

  return options
}

function envRequired(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function installNitroGlobals() {
  const runtimeConfig = {
    databaseUrl: envRequired('DATABASE_URL'),
    hyperdriveBinding: 'HYPERDRIVE',
    public: {
      appUrl: process.env.SITE_URL?.trim() || '',
    },
    logLevel: 'warn',
  }

  Object.assign(globalThis, {
    createError: (input: { statusCode?: number; message?: string; statusMessage?: string }) => {
      const message = input.message ?? input.statusMessage ?? 'Unknown error'
      const error = new Error(message) as Error & {
        statusCode?: number
        statusMessage?: string
      }
      error.statusCode = input.statusCode
      error.statusMessage = input.statusMessage
      return error
    },
    useRuntimeConfig: () => runtimeConfig,
  })
}

function createMockEvent(path = '/tools/blog-dry-run'): H3Event {
  return {
    method: 'GET',
    path,
    context: {
      cloudflare: {
        env: {
          DATABASE_URL: envRequired('DATABASE_URL'),
        },
      },
    },
  } as H3Event
}

async function loadStoredPrompt(): Promise<string | null> {
  const databaseUrl = envRequired('DATABASE_URL')
  const db = postgres(databaseUrl, { prepare: false, max: 1 })
  try {
    const rows = await db<{ content: string }[]>`
      select content
      from system_prompts
      where name = ${BLOG_PROMPT_KEY}
      limit 1
    `
    return rows[0]?.content ?? null
  } finally {
    await db.end()
  }
}

async function resolvePrompt(
  options: CliOptions,
): Promise<{ content: string; source: PromptSource }> {
  if (options.promptFile) {
    return {
      content: readFileSync(resolve(process.cwd(), options.promptFile), 'utf8').trim(),
      source: 'file',
    }
  }

  if (options.promptSource === 'stored') {
    const stored = await loadStoredPrompt()
    if (stored) {
      return { content: stored, source: 'stored' }
    }
  }

  return { content: DEFAULT_BLOG_SYSTEM_PROMPT, source: 'default' }
}

function classifyFindings(findings: SpotlightFindings): QualitySignal[] {
  const signals: QualitySignal[] = []

  if (findings.dataPoints.length < 4) {
    signals.push({
      code: 'analyzer_sparse',
      severity: 'warn',
      message: `Analyzer returned only ${findings.dataPoints.length} data points.`,
    })
  }

  if (/insufficient data|no .*?data available/i.test(findings.summary)) {
    signals.push({
      code: 'analyzer_insufficient',
      severity: 'error',
      message: 'Analyzer summary indicates the angle does not have enough usable data.',
    })
  }

  if (findings.limitations.length === 0) {
    signals.push({
      code: 'missing_limitations',
      severity: 'warn',
      message: 'Analyzer returned no limitations, which weakens the data-notes section.',
    })
  }

  return signals
}

function classifyPost(post: RawPostResponse): QualitySignal[] {
  const signals: QualitySignal[] = []
  const bodyText = [post.intro, ...post.sections.map((section) => section.content)].join('\n\n')
  const words = bodyText
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean)
  const hedgingPattern = /\b(?:likely|perhaps|possibly|may suggest|appears to|seems to|probably)\b/i

  if (!post.title.trim()) {
    signals.push({
      code: 'missing_title',
      severity: 'error',
      message: 'Generated post is missing a title.',
    })
  }

  if (!post.excerpt.trim()) {
    signals.push({
      code: 'missing_excerpt',
      severity: 'error',
      message: 'Generated post is missing an excerpt.',
    })
  }

  if (post.sections.length < 2 || post.sections.length > 4) {
    signals.push({
      code: 'section_count',
      severity: 'warn',
      message: `Generated post has ${post.sections.length} sections; target is 2 to 4.`,
    })
  }

  if (words.length < 300 || words.length > 750) {
    signals.push({
      code: 'word_count',
      severity: 'warn',
      message: `Generated article body is ${words.length} words; target is roughly 400 to 600.`,
    })
  }

  if (!/Texas Comptroller/i.test(post.dataNotes)) {
    signals.push({
      code: 'missing_comptroller_reference',
      severity: 'warn',
      message: 'Data notes do not explicitly mention the Texas Comptroller.',
    })
  }

  if (hedgingPattern.test(bodyText)) {
    signals.push({
      code: 'hedging_language',
      severity: 'warn',
      message: 'Generated copy contains hedging language that may need editorial cleanup.',
    })
  }

  return signals
}

function determineClassification(signals: QualitySignal[]): Classification {
  if (
    signals.some((signal) => signal.code.startsWith('analyzer_') && signal.severity === 'error')
  ) {
    return 'analyzer'
  }

  if (signals.some((signal) => signal.code.startsWith('missing_') && signal.severity === 'error')) {
    return 'generator'
  }

  if (signals.some((signal) => signal.severity === 'warn')) {
    return 'prompt'
  }

  return 'ready'
}

function renderReport(report: DryRunReport) {
  console.log(`Angle: ${report.angleName} (${report.angleId})`)
  console.log(`Model: ${report.model}`)
  console.log(`Prompt: ${report.promptSource} (${report.promptName})`)
  console.log(`Slug preview: ${report.slugPreview}`)
  console.log(`Classification: ${report.classification}`)
  console.log('')
  console.log('Findings')
  console.log('--------')
  console.log(report.findings.summary)
  console.log('')
  for (const point of report.findings.dataPoints) {
    console.log(`- ${point.label}: ${point.value}${point.context ? ` (${point.context})` : ''}`)
  }
  console.log('')
  console.log('Limitations')
  console.log('-----------')
  for (const limitation of report.findings.limitations) {
    console.log(`- ${limitation}`)
  }
  console.log('')
  console.log('Quality Signals')
  console.log('---------------')
  if (report.signals.length === 0) {
    console.log('- none')
  } else {
    for (const signal of report.signals) {
      console.log(`- [${signal.severity}] ${signal.code}: ${signal.message}`)
    }
  }
  console.log('')
  console.log('Generated Post')
  console.log('--------------')
  console.log(`# ${report.generated.title}`)
  console.log('')
  console.log(report.generated.excerpt)
  console.log('')
  console.log(report.generated.intro)
  console.log('')
  for (const section of report.generated.sections) {
    console.log(`## ${section.heading}`)
    console.log('')
    console.log(section.content)
    console.log('')
  }
  console.log('Data Notes')
  console.log('')
  console.log(report.generated.dataNotes)
  console.log('')

  if (report.rawResponse) {
    console.log('Raw Model Response')
    console.log('------------------')
    console.log(report.rawResponse)
    console.log('')
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2).filter((arg) => arg !== '--'))
  const definition = BLOG_ANGLE_DEFINITIONS.find((angle) => angle.id === options.angleId)
  if (!definition) {
    throw new Error(`Unknown blog angle: ${options.angleId}`)
  }

  installNitroGlobals()
  const prompt = await resolvePrompt(options)
  const event = createMockEvent()
  const findings = await runAnalyzer(event, options.angleId)
  const rawResponse = await grokChat(
    envRequired('XAI_API_KEY'),
    [
      { role: 'system', content: prompt.content },
      { role: 'user', content: buildUserMessage(findings) },
    ],
    options.model,
  )
  const generated = parsePostBody(rawResponse)
  const signals = [...classifyFindings(findings), ...classifyPost(generated)]
  const report: DryRunReport = {
    angleId: definition.id,
    angleName: definition.name,
    model: options.model,
    promptSource: prompt.source,
    promptName: BLOG_PROMPT_KEY,
    slugPreview: buildPostSlug(definition.id),
    findings,
    generated,
    ...(options.includeRaw ? { rawResponse } : {}),
    signals,
    classification: determineClassification(signals),
  }

  if (options.json) {
    console.log(JSON.stringify(report, null, 2))
    return
  }

  renderReport(report)
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`blog-dry-run failed: ${message}`)
  process.exit(1)
})
