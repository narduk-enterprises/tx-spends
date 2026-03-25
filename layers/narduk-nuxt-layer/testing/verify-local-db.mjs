import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { parse } from 'jsonc-parser'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const layerRoot = join(__dirname, '..')
const appDir = resolve(process.cwd(), process.argv[2] ?? '.')

function run(command, args, cwd) {
  execFileSync(command, args, { cwd, stdio: 'inherit' })
}

function runJson(command, args, cwd) {
  const stdout = execFileSync(command, args, {
    cwd,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  const payload = JSON.parse(stdout)
  return payload.flatMap((entry) => entry.results ?? [])
}

function readLayerSchemaTables() {
  const schemaPath = join(layerRoot, 'server/database/schema.ts')
  const schemaSource = readFileSync(schemaPath, 'utf-8')
  const matches = schemaSource.matchAll(/sqliteTable\('(\w+)'/gi)
  return [...new Set([...matches].map((match) => match[1]))].sort()
}

const wranglerJsonc = join(appDir, 'wrangler.jsonc')
const wranglerJson = join(appDir, 'wrangler.json')
const wranglerPath = existsSync(wranglerJsonc) ? wranglerJsonc : wranglerJson
const parseErrors = []
const wrangler = parse(readFileSync(wranglerPath, 'utf-8'), parseErrors, {
  allowTrailingComma: true,
})
if (parseErrors.length > 0) {
  throw new SyntaxError(`Invalid wrangler config ${wranglerPath}`)
}

const databaseName = wrangler.d1_databases?.[0]?.database_name
if (!databaseName) {
  throw new Error(`Could not determine D1 database name from ${wranglerPath}`)
}

console.log(`\nVerifying local D1 flow for ${appDir}`)
run('pnpm', ['run', 'db:reset'], appDir)

const tableRows = runJson(
  'pnpm',
  [
    'exec',
    'wrangler',
    'd1',
    'execute',
    databaseName,
    '--local',
    '--json',
    '--command',
    "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name;",
  ],
  appDir,
)

const existingTables = new Set(tableRows.map((row) => String(row.name)))
const expectedLayerTables = readLayerSchemaTables()
const missingTables = expectedLayerTables.filter((table) => !existingTables.has(table))

if (missingTables.length > 0) {
  throw new Error(`Missing layer tables after db:reset: ${missingTables.join(', ')}`)
}

const notificationRows = runJson(
  'pnpm',
  [
    'exec',
    'wrangler',
    'd1',
    'execute',
    databaseName,
    '--local',
    '--json',
    '--command',
    'SELECT COUNT(*) AS count FROM notifications;',
  ],
  appDir,
)

const notificationCount = Number(notificationRows[0]?.count ?? 0)
if (notificationCount < 1) {
  throw new Error('Layer seed did not populate notifications after db:reset')
}

console.log(
  `✅ Verified local db:reset path. Layer tables present: ${expectedLayerTables.join(', ')}`,
)
console.log(`✅ Seeded notifications rows: ${notificationCount}`)
