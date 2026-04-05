import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const DOPPLER_CONFIG = process.env.DOPPLER_CONFIG || 'dev'
const DATA_ROOT = resolve(process.cwd(), '.data/beverages')
const CSV_DIR = join(DATA_ROOT, 'csv')

const SOURCE_CSV_PATH = '/Users/narduk/Downloads/Mixed_Beverage_Sales_Receipts_20260402.csv'

const STG_COLUMNS = [
  'taxpayer_number',
  'taxpayer_name',
  'taxpayer_address',
  'taxpayer_city',
  'taxpayer_state',
  'taxpayer_zip',
  'taxpayer_county',
  'location_number',
  'location_name',
  'location_address',
  'location_city',
  'location_state',
  'location_zip',
  'location_county',
  'inside_outside_city_limits',
  'tabc_permit_number',
  'responsibility_begin_date',
  'responsibility_end_date',
  'obligation_end_date',
  'total_sales_receipts',
  'total_taxable_receipts'
]

function ensureDirectories() {
  if (!existsSync(CSV_DIR)) {
    mkdirSync(CSV_DIR, { recursive: true })
  }
}

function runDopplerPsql(command: string) {
  execFileSync('doppler', ['run', '--config', DOPPLER_CONFIG, '--', 'bash', '-lc', command], {
    cwd: process.cwd(),
    stdio: ['pipe', 'inherit', 'inherit'],
  })
}

function sanitizeCsv(inputPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const outputPath = join(CSV_DIR, 'raw_clean.csv')
    console.log(`[ETL] Sanitizing CSV structure to ${outputPath}...`)

    const { parse } = require('csv-parse')
    const { createReadStream, createWriteStream } = require('fs')
    const { stringify } = require('csv-stringify')

    const input = createReadStream(inputPath)
    const output = createWriteStream(outputPath)
    
    let isHeader = true
    const parser = parse({ relax_column_count: true, relax_quotes: true, columns: false })
    const stringifier = stringify()

    stringifier.pipe(output)

    parser.on('readable', function() {
      let record
      while ((record = parser.read()) !== null) {
        if (isHeader) {
          isHeader = false
          continue
        }
        
        const targetLen = STG_COLUMNS.length
        if (record.length < targetLen) {
          record = record.concat(Array(targetLen - record.length).fill(''))
        } else if (record.length > targetLen) {
          record = record.slice(0, targetLen)
        }
        stringifier.write(record)
      }
    })
    
    parser.on('end', () => {
      stringifier.end()
    })

    parser.on('error', reject)
    stringifier.on('error', reject)
    
    output.on('finish', () => resolve(outputPath))
    input.pipe(parser)
  })
}

async function copyCsvIntoStaging(csvPath: string) {
  console.log('[ETL] TRUNCATE stg_beverage_sales_raw starting...')
  runDopplerPsql('psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "TRUNCATE stg_beverage_sales_raw"')
  console.log('[ETL] TRUNCATE complete.')

  const cleanPath = await sanitizeCsv(csvPath)

  console.log('[ETL] Fast-path \\copy streaming starting...')
  const copySql = `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "\\copy stg_beverage_sales_raw(${STG_COLUMNS.join(',')}) FROM '${cleanPath}' WITH (FORMAT csv, HEADER false)"`
  runDopplerPsql(copySql)
  console.log('[ETL] CSV \\copy to PostgreSQL complete.')
}

function runTransform() {
  console.log('[ETL] Executing DWH transformations (beverage-ingest.sql)...')
  const sqlPath = resolve(process.cwd(), 'tools/etl/beverage-ingest.sql')
  runDopplerPsql(`psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "${sqlPath}"`)
  console.log('[ETL] DWH transformations completed.')
}

async function run() {
  console.log('[ETL] Pipeline initialized.')
  ensureDirectories()
  
  if (!existsSync(SOURCE_CSV_PATH)) {
    throw new Error(`Source CSV not found at: ${SOURCE_CSV_PATH}`)
  }
  
  console.log('[ETL] Ensuring DB schema matches targets (beverage-init.sql)...')
  runDopplerPsql(`psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "${resolve(process.cwd(), 'tools/etl/beverage-init.sql')}"`)

  await copyCsvIntoStaging(SOURCE_CSV_PATH)
  runTransform()
  console.log('[ETL] Pipeline SUCCESS. Beverage Sales facts ingestion complete.')
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
