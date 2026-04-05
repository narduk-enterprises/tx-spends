import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { chromium } from '@playwright/test'

const BASE_URL = 'https://www.lbb.texas.gov/Contract_Reporting.aspx'
const DATA_ROOT = resolve(process.cwd(), '.data/lbb')
const RAW_DIR = join(DATA_ROOT, 'raw')

function ensureDirectories() {
  for (const directory of [DATA_ROOT, RAW_DIR]) {
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

export async function runLbbEtl() {
  ensureDirectories()
  
  console.log(`Spinning up Playwright for LBB Hub: ${BASE_URL}...`)
  
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 60000 })
    
    // Attempt to scrape the rendered contract reporting hub state
    const html = await page.content()
    
    console.log(`Successfully intercepted ${html.length} bytes of LBB DOM!`)
    
    const dumpFile = join(RAW_DIR, `lbb_dump_${Date.now()}.html`)
    writeFileSync(dumpFile, html)
    console.log(`Dumped rendering sweep to ${dumpFile}.`)
    
    console.log('LBB Extraction complete!')
  } catch (e) {
    console.error('Failed to fetch LBB context:', e)
  } finally {
    await browser.close()
  }
}

if (require.main === module) {
  runLbbEtl()
}
