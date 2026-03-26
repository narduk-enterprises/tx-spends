import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import postgres from 'postgres'
import { BLOG_PROMPT_KEY, DEFAULT_BLOG_SYSTEM_PROMPT } from '#server/utils/blog/generator'
import { runCommand } from './command'

interface CliOptions {
  email?: string
  name: string
  promptFile?: string
  storeDopplerSecret: boolean
  dopplerConfig: string
  dopplerProject?: string
}

interface BootstrapSummary {
  email: string
  userCreated: boolean
  userPromoted: boolean
  apiKeyName: string
  apiKeyPrefix: string
  promptUpdated: boolean
  dopplerStored: boolean
}

function printUsage(): never {
  console.log(`Usage:
  doppler run --config prd -- pnpm run blog:bootstrap-admin -- [options]

Options:
  --email <address>      Service account email (default: agents-admin@<site-host>)
  --name <value>         Service account display name (default: Agent Admin)
  --prompt-file <path>   Use a local prompt file instead of the code default
  --store-doppler        Store the generated AGENT_ADMIN_API_KEY in Doppler
  --doppler-config <id>  Doppler config for secret storage (default: $DOPPLER_CONFIG or prd)
  --doppler-project <id> Doppler project override (default: current project)
  --help                 Show this help
`)
  process.exit(0)
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    name: 'Agent Admin',
    storeDopplerSecret: false,
    dopplerConfig: process.env.DOPPLER_CONFIG?.trim() || 'prd',
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--help' || arg === '-h') {
      printUsage()
    }

    if (arg === '--store-doppler') {
      options.storeDopplerSecret = true
      continue
    }

    const next = argv[index + 1]
    if (arg === '--email') {
      if (!next) throw new Error('Missing value for --email.')
      options.email = next
      index += 1
      continue
    }

    if (arg === '--name') {
      if (!next) throw new Error('Missing value for --name.')
      options.name = next
      index += 1
      continue
    }

    if (arg === '--prompt-file') {
      if (!next) throw new Error('Missing value for --prompt-file.')
      options.promptFile = next
      index += 1
      continue
    }

    if (arg === '--doppler-config') {
      if (!next) throw new Error('Missing value for --doppler-config.')
      options.dopplerConfig = next
      index += 1
      continue
    }

    if (arg === '--doppler-project') {
      if (!next) throw new Error('Missing value for --doppler-project.')
      options.dopplerProject = next
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

function resolveEmail(options: CliOptions): string {
  if (options.email) return options.email

  const siteUrl = envRequired('SITE_URL')
  const hostname = new URL(siteUrl).hostname.replace(/^www\./, '')
  return `agents-admin@${hostname || 'tx-spends.org'}`
}

function resolvePrompt(options: CliOptions): string {
  if (!options.promptFile) return DEFAULT_BLOG_SYSTEM_PROMPT
  return readFileSync(resolve(process.cwd(), options.promptFile), 'utf8').trim()
}

function sha256Hex(input: string) {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(input)).then((buffer) =>
    Array.from(new Uint8Array(buffer))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join(''),
  )
}

async function generateRawApiKey() {
  const randomBytes = new Uint8Array(32)
  crypto.getRandomValues(randomBytes)
  const rawKey = `nk_${Array.from(randomBytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')}`
  const keyHash = await sha256Hex(rawKey)

  return {
    rawKey,
    keyHash,
    keyPrefix: rawKey.slice(0, 11),
  }
}

function storeKeyInDoppler(options: CliOptions, rawKey: string) {
  const args = [
    'secrets',
    'set',
    `AGENT_ADMIN_API_KEY=${rawKey}`,
    '--config',
    options.dopplerConfig,
  ]
  if (options.dopplerProject) {
    args.push('--project', options.dopplerProject)
  }

  runCommand('doppler', args, {
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

async function main() {
  const options = parseArgs(process.argv.slice(2).filter((arg) => arg !== '--'))
  const databaseUrl = envRequired('DATABASE_URL')
  const email = resolveEmail(options)
  const promptContent = resolvePrompt(options)
  const now = new Date().toISOString()
  const db = postgres(databaseUrl, { prepare: false, max: 1 })
  const apiKeyName = 'agents-admin'

  let userCreated = false
  let userPromoted = false

  try {
    const existingUsers = await db<{ id: string; isAdmin: boolean | null }[]>`
      select id, is_admin as "isAdmin"
      from users
      where email = ${email}
      limit 1
    `

    let userId = existingUsers[0]?.id
    if (!userId) {
      userId = crypto.randomUUID()
      userCreated = true
      userPromoted = true
      await db`
        insert into users (id, email, password_hash, name, is_admin, created_at, updated_at)
        values (${userId}, ${email}, ${null}, ${options.name}, ${true}, ${now}, ${now})
      `
    } else if (!existingUsers[0]?.isAdmin) {
      userPromoted = true
      await db`
        update users
        set is_admin = ${true}, updated_at = ${now}
        where id = ${userId}
      `
    }

    await db`
      delete from api_keys
      where user_id = ${userId}
        and name = ${apiKeyName}
    `

    const generated = await generateRawApiKey()

    await db`
      insert into api_keys (id, user_id, name, key_hash, key_prefix, created_at)
      values (
        ${crypto.randomUUID()},
        ${userId},
        ${apiKeyName},
        ${generated.keyHash},
        ${generated.keyPrefix},
        ${now}
      )
    `

    await db`
      insert into system_prompts (name, content, description, updated_at)
      values (
        ${BLOG_PROMPT_KEY},
        ${promptContent},
        ${'System prompt for the daily Texas spending spotlight blog post generator. Controls tone, structure, and accuracy guardrails.'},
        ${now}
      )
      on conflict (name)
      do update set
        content = excluded.content,
        description = excluded.description,
        updated_at = excluded.updated_at
    `

    if (options.storeDopplerSecret) {
      storeKeyInDoppler(options, generated.rawKey)
    }

    const summary: BootstrapSummary = {
      email,
      userCreated,
      userPromoted,
      apiKeyName,
      apiKeyPrefix: generated.keyPrefix,
      promptUpdated: true,
      dopplerStored: options.storeDopplerSecret,
    }

    console.log(JSON.stringify(summary, null, 2))
  } finally {
    await db.end()
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`blog-admin-bootstrap failed: ${message}`)
  process.exit(1)
})
