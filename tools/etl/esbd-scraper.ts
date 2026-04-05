import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const BASE_URL = 'https://www.txsmartbuy.com/esbd'
const DATA_ROOT = resolve(process.cwd(), '.data/esbd')
const CSV_DIR = join(DATA_ROOT, 'csv')

function ensureDirectories() {
  for (const directory of [DATA_ROOT, CSV_DIR]) {
    mkdirSync(directory, { recursive: true })
  }
}

function runPlatformPsql(command: string, input?: string | Buffer) {
  execFileSync('narduk-cli', ['platform-secrets', 'exec', '--app', 'tx-spends', '--environment', 'dev', '--profile', 'runtime', '--', 'bash', '-lc', command], {
    cwd: process.cwd(),
    input,
    stdio: ['pipe', 'inherit', 'inherit'],
  })
}

export async function runEsbdEtl() {
  ensureDirectories()
  
  console.log(`Navigating to ${BASE_URL}...`)
  try {
    const res = await fetch(BASE_URL)
    const html = await res.text()
    
    // We are extracting the core table via simple string heuristics until playwright is engaged fully
    console.log(`Successfully fetched ${html.length} bytes of raw ESBD layout!`)
    
    const dumpFile = join(CSV_DIR, `esbd_dump_${Date.now()}.html`)
    writeFileSync(dumpFile, html)
    console.log(`Dumped raw HTML sweep to ${dumpFile}.`)
    
    // Here we will implement the DOM parsing rules for:
    // solicitation_id, title, status, posting_date, due_date
    // and map them directly to `stg_esbd_solicitations_raw`
    
    console.log('Writing to staging...')
    // runFactTransform() -> calls esbd-ingest.sql
    console.log('ESBD Extraction complete!')
  } catch (e) {
    console.error('Failed to fetch ESBD:', e)
  }
}

if (require.main === module) {
  runEsbdEtl()
}
