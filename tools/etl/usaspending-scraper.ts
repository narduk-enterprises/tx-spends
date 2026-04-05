import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const BASE_URL = 'https://api.usaspending.gov/api/v2/search/spending_by_award/'
const DATA_ROOT = resolve(process.cwd(), '.data/usaspending')
const JSON_DIR = join(DATA_ROOT, 'json')

function ensureDirectories() {
  for (const directory of [DATA_ROOT, JSON_DIR]) {
    mkdirSync(directory, { recursive: true })
  }
}

export async function runUsaspendingEtl() {
  ensureDirectories()
  
  console.log(`Connecting to USAspending Data Catalog...`)
  
  // Minimal payload representing Tx awards to test access
  const requestBody = {
    "filters": {
      "time_period": [
        {
          "start_date": "2024-01-01",
          "end_date": "2024-12-31"
        }
      ],
      "place_of_performance_locations": [
        {
          "country": "USA",
          "state": "TX"
        }
      ]
    },
    "fields": [
      "Award ID",
      "Recipient Name",
      "Award Amount",
      "Funding Agency Name"
    ],
    "page": 1,
    "limit": 5,
    "sort": "Award Amount",
    "order": "desc"
  }

  try {
    const res = await fetch(BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
    })
    
    if (!res.ok) {
        throw new Error(`API returned ${res.status} ${res.statusText}`)
    }

    const data = await res.json()
    
    console.log(`Successfully intercepted USAspending API trace: ${data.results?.length} records found!`)
    
    const dumpFile = join(JSON_DIR, `usaspending_dump_${Date.now()}.json`)
    writeFileSync(dumpFile, JSON.stringify(data, null, 2))
    console.log(`Dumped federal layer tracking to ${dumpFile}.`)
    
    console.log('USAspending Extraction complete!')
  } catch (e) {
    console.error('Failed to fetch USAspending context:', e)
  }
}

if (require.main === module) {
  runUsaspendingEtl()
}
