import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const DOPPLER_CONFIG = process.env.DOPPLER_CONFIG || 'dev'
const DATA_ROOT = resolve(process.cwd(), '.data/dir-sales')
const CSV_DIR = join(DATA_ROOT, 'csv')

const DIR_SOCRATA_URL = 'https://data.texas.gov/api/views/w64c-ndf7/rows.csv?accessType=DOWNLOAD'
const STG_COLUMNS = [
  'fiscal_year',
  'customer_name',
  'vendor_name',
  'purchase_amount',
  'contract_number',
  'rfo_description',
  'rfo_number',
  'customer_type',
  'customer_contact',
  'customer_address',
  'customer_city',
  'customer_state',
  'customer_zip',
  'vendor_contact',
  'vendor_hub_type',
  'vendor_address',
  'vendor_city',
  'vendor_state',
  'vendor_zip',
  'reseller_name',
  'reseller_hub_type',
  'reseller_address',
  'reseller_city',
  'reseller_state',
  'reseller_zip',
  'reseller_phone',
  'report_received_month',
  'purchase_month',
  'brand_name',
  'order_quantity',
  'unit_price',
  'invoice_number',
  'po_number',
  'order_date',
  'shipped_date',
  'dir_contract_mgr',
  'contract_type',
  'contract_subtype',
  'contract_start_date',
  'contract_end_date',
  'contract_termination_date',
  'staffing_contractor_name',
  'staffing_technology',
  'staffing_title',
  'staffing_level',
  'staffing_technology_type',
  'staffing_start_date',
  'staffing_acquistion_type',
  'sales_fact_number'
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

async function fetchCsvBatch() {
  const filePath = join(CSV_DIR, 'dir_sales_export.csv')
  const { existsSync, statSync } = require('fs')

  if (existsSync(filePath) && statSync(filePath).size > 100000) {
    console.log(`[ETL] Found existing CSV export at ${filePath}, skipping download.`)
    return filePath
  }

  console.log(`[ETL] Downloading full DIR Sales export to ${filePath}...`)

  execFileSync('curl', [
    '-#', // Show progress bar
    '-o', filePath,
    DIR_SOCRATA_URL
  ], {
    cwd: process.cwd(),
    stdio: ['pipe', 'inherit', 'inherit']
  })

  console.log(`\n[ETL] Download complete: ${filePath}`)
  return filePath
}

function sanitizeCsv(inputPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const outputPath = join(CSV_DIR, 'dir_sales_clean.csv')
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
        
        // Pad or truncate to exactly 49 columns based on STG_COLUMNS size
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
  console.log('[ETL] TRUNCATE stg_dir_sales_raw starting...')
  runDopplerPsql('psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "TRUNCATE stg_dir_sales_raw"')
  console.log('[ETL] TRUNCATE complete.')

  const cleanPath = await sanitizeCsv(csvPath)

  console.log('[ETL] Fast-path \\copy streaming starting...')
  const copySql = `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "\\copy stg_dir_sales_raw(${STG_COLUMNS.join(',')}) FROM '${cleanPath}' WITH (FORMAT csv, HEADER false)"`
  runDopplerPsql(copySql)
  console.log('[ETL] CSV \\copy to PostgreSQL complete.')
}

function runTransform() {
  console.log('[ETL] Executing DWH transformations (dir-ingest.sql)...')
  const sqlPath = resolve(process.cwd(), 'tools/etl/dir-ingest.sql')
  runDopplerPsql(`psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "${sqlPath}"`)
  console.log('[ETL] DWH transformations completed.')
}

async function run() {
  console.log('[ETL] Pipeline initialized.')
  ensureDirectories()
  
  console.log('[ETL] Ensuring DB schema matches targets (dir-init.sql)...')
  runDopplerPsql(`psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "${resolve(process.cwd(), 'tools/etl/dir-init.sql')}"`)

  const csvPath = await fetchCsvBatch()
  
  await copyCsvIntoStaging(csvPath)
  runTransform()
  console.log('[ETL] Pipeline SUCCESS. DIR Sales facts ingestion complete.')
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
