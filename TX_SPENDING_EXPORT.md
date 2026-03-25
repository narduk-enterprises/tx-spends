# Texas Spending Data — SQLite → PostgreSQL Export

## Source Database

The source is a **369 MB SQLite** database at:

```
/Users/narduk/new-code/texas-spending/data/texas_spending.db
```

You can query it with `sqlite3 data/texas_spending.db` or programmatically via
the `better-sqlite3` npm package (already installed in this project).

## Row Counts

| Table                            | Rows      | Description                                                |
| -------------------------------- | --------- | ---------------------------------------------------------- |
| `stg_expenditures_by_county_raw` | 527,341   | State expenditures broken down by county, FY2007–2024      |
| `stg_annual_cash_report_raw`     | 1,398,882 | Treasury fund detail from Annual Cash Reports, FY2018–2025 |
| `stg_vendor_master_raw`          | 11,697    | Active CMBL/VetHUB vendor records                          |
| `stg_comptroller_objects_raw`    | 103       | Expenditure/revenue object code reference data             |
| `stg_expenditure_categories_raw` | 18        | Expenditure category code reference data                   |
| `stg_payments_to_payee_raw`      | 0         | (Empty — requires Playwright browser scraper)              |
| `ingestion_log`                  | ~5        | Pipeline run metadata                                      |

**Total: ~1,938,041 rows**

## Schema

Every staging table (`stg_*`) shares a common provenance contract with these
trailing columns:

```sql
source_file_name TEXT,    -- origin filename or identifier
source_url TEXT,          -- URL the data was fetched from
source_loaded_at TEXT,    -- ISO timestamp of ingestion (auto-set)
source_snapshot_date TEXT, -- date the source data was captured
row_number INTEGER        -- row position within the source file
```

### stg_expenditures_by_county_raw

The largest and most useful fact table. Each row is a state agency expenditure
in a county.

```sql
id INTEGER PRIMARY KEY AUTOINCREMENT,
fiscal_year INTEGER,            -- e.g. 2024
agency_number TEXT,             -- state agency code
agency_name TEXT,               -- e.g. 'DEPARTMENT OF TRANSPORTATION'
county TEXT,                    -- e.g. 'TRAVIS', 'HARRIS' (nullable for statewide)
major_spending_category TEXT,   -- e.g. 'SALARIES AND WAGES'
amount REAL                     -- dollar amount (nullable for summary rows)
```

### stg_annual_cash_report_raw

Parsed from Comptroller Annual Cash Report XLSX files. Each row is a line item
from a fund detail or summary sheet.

```sql
id INTEGER PRIMARY KEY AUTOINCREMENT,
fiscal_year INTEGER,     -- e.g. 2025
sheet_name TEXT,         -- e.g. 'fund_detail:Treasury Fund Detail'
fund_number TEXT,        -- e.g. '0001' (General Revenue)
fund_name TEXT,          -- e.g. 'General Revenue Fund'
line_item TEXT,          -- description of the line
amount REAL              -- dollar amount
```

### stg_vendor_master_raw

Active CMBL (Centralized Master Bidders List) / VetHUB vendors registered with
the Comptroller.

```sql
id INTEGER PRIMARY KEY AUTOINCREMENT,
web_vendor_name TEXT,       -- business name
web_vid TEXT,               -- vendor ID
web_vendor_no TEXT,         -- vendor number
web_city TEXT,
web_county TEXT,
web_state TEXT,
web_zip TEXT,
web_hub_status INTEGER,     -- 1 = HUB certified
web_small_bus_flag INTEGER, -- 1 = small business
web_desc TEXT               -- commodity description
```

### stg_comptroller_objects_raw

Reference table mapping 4-digit comptroller object codes to titles.

```sql
id INTEGER PRIMARY KEY AUTOINCREMENT,
object_code TEXT,    -- e.g. '7001'
title TEXT,          -- e.g. 'REGULAR SALARIES AND WAGES'
object_group TEXT    -- e.g. 'SALARIES AND WAGES'
```

### stg_expenditure_categories_raw

Reference table for expenditure category codes.

```sql
id INTEGER PRIMARY KEY AUTOINCREMENT,
category_code TEXT,   -- e.g. '1'
category_title TEXT   -- e.g. 'SALARIES AND WAGES'
```

### stg_payments_to_payee_raw

Individual payment transactions (currently empty — requires Playwright scraper).

```sql
id INTEGER PRIMARY KEY AUTOINCREMENT,
agency_name TEXT,
payee_name TEXT,
payment_date TEXT,
amount REAL,
object_category TEXT,
comptroller_object TEXT,
appropriation_number TEXT,
appropriation_year TEXT,
fund TEXT,
is_confidential INTEGER DEFAULT 0,
fiscal_year INTEGER
```

### ingestion_log

Pipeline metadata — tracks each scraper run.

```sql
id INTEGER PRIMARY KEY AUTOINCREMENT,
source TEXT NOT NULL,
started_at TEXT NOT NULL,
ended_at TEXT,
rows_processed INTEGER DEFAULT 0,
rows_failed INTEGER DEFAULT 0,
file_checksum TEXT,
duration_ms INTEGER,
status TEXT NOT NULL DEFAULT 'running',
error_message TEXT
```

## Export Instructions

### 1. Create the PostgreSQL schema

Map SQLite types to Postgres:

- `INTEGER PRIMARY KEY AUTOINCREMENT` → `SERIAL PRIMARY KEY`
- `TEXT` → `TEXT`
- `REAL` → `DOUBLE PRECISION` (or `NUMERIC(15,2)` for money columns)
- `INTEGER` (booleans) → `BOOLEAN`
- `datetime('now')` default → `NOW()`

### 2. Export from SQLite

The fastest approach is CSV export via `sqlite3`:

```bash
# Export each table to CSV
for table in stg_expenditures_by_county_raw stg_annual_cash_report_raw stg_vendor_master_raw stg_comptroller_objects_raw stg_expenditure_categories_raw stg_payments_to_payee_raw ingestion_log; do
  sqlite3 -header -csv data/texas_spending.db "SELECT * FROM $table;" > "data/export_${table}.csv"
  echo "Exported $table"
done
```

### 3. Import into PostgreSQL

```bash
# After creating the PG tables, use COPY for fast bulk import:
for table in stg_expenditures_by_county_raw stg_annual_cash_report_raw stg_vendor_master_raw stg_comptroller_objects_raw stg_expenditure_categories_raw ingestion_log; do
  psql -d YOUR_DB -c "\COPY $table FROM 'data/export_${table}.csv' WITH (FORMAT csv, HEADER true)"
  echo "Imported $table"
done
```

### 4. Alternative: programmatic export

Use the `better-sqlite3` (already installed) + `pg` packages to stream rows
directly:

```typescript
import Database from 'better-sqlite3'
import { Pool } from 'pg'

const sqlite = new Database('data/texas_spending.db', { readonly: true })
const pg = new Pool({ connectionString: process.env.DATABASE_URL })

const BATCH_SIZE = 5000
const rows = sqlite
  .prepare('SELECT * FROM stg_expenditures_by_county_raw')
  .iterate()
let batch = []

for (const row of rows) {
  batch.push(row)
  if (batch.length >= BATCH_SIZE) {
    await insertBatch(pg, 'stg_expenditures_by_county_raw', batch)
    batch = []
  }
}
if (batch.length > 0)
  await insertBatch(pg, 'stg_expenditures_by_county_raw', batch)
```

### Key Considerations

- **Money columns**: `amount` is stored as `REAL` (float64). For Postgres,
  consider `NUMERIC(15,2)` to avoid floating point issues.
- **Provenance columns**: Keep `source_file_name`, `source_url`,
  `source_loaded_at`, `source_snapshot_date`, `row_number` — they track data
  lineage.
- **Indexes**: Add indexes on `fiscal_year`, `agency_name`, `county` in the
  county table, and `fiscal_year`, `fund_number` in the cash report table.
- **The `id` column**: Auto-generated SQLite rowids. You can either preserve
  them or let Postgres generate new serial IDs.
