# Texas State Spending Explorer — Implementation Specification (v1)

**Audience:** coding agents, implementers, reviewers.  
**Stack assumption:** PostgreSQL accessed from deployed Cloudflare Workers
through Hyperdrive, read-only JSON API (`/api/v1`), Nuxt 4.3+ inside
`apps/web/`, shared Nuxt layer in `layers/narduk-nuxt-layer/`, `@nuxt/ui` v4,
`@nuxtjs/seo`, and optional ETL in Node/TypeScript.  
**Non-negotiable:** Do not claim capabilities the public Comptroller / open data
does not support.

---

## Table of contents

1. [How to use this document](#1-how-to-use-this-document)
2. [Product definition and scope](#2-product-definition-and-scope)
3. [Source data reality (assessment summary)](#3-source-data-reality-assessment-summary)
4. [Canonical data model and PostgreSQL DDL](#4-canonical-data-model-and-postgresql-ddl)
5. [Staging layer](#5-staging-layer)
6. [Ingestion contract](#6-ingestion-contract)
7. [Data source implementation layer](#7-data-source-implementation-layer)
8. [Vendor matching policy](#8-vendor-matching-policy)
9. [MVP product contract](#9-mvp-product-contract)
10. [API contract](#10-api-contract)
11. [Frontend route contract (Nuxt)](#11-frontend-route-contract-nuxt)
12. [UI contract](#12-ui-contract)
13. [Component and data-binding contract](#13-component-and-data-binding-contract)
14. [SSR vs client loading](#14-ssr-vs-client-loading)
15. [SEO, indexing, and metadata](#15-seo-indexing-and-metadata)
16. [Required disclaimers (exact product language)](#16-required-disclaimers-exact-product-language)
17. [Caching and performance](#17-caching-and-performance)
18. [Errors and edge cases](#18-errors-and-edge-cases)
19. [Non-goals and forbidden claims](#19-non-goals-and-forbidden-claims)
20. [Build order](#20-build-order)
21. [Acceptance criteria](#21-acceptance-criteria)
22. [Resolved data inventory](#22-resolved-data-inventory)
23. [source_row_hash specification](#23-source_row_hash-specification)
24. [include_confidential semantics](#24-include_confidential-semantics)
25. [Runtime topology, environments, and secrets](#25-runtime-topology-environments-and-secrets)
26. [ETL operational contract, migrations, and seed](#26-etl-operational-contract-migrations-and-seed)
27. [Performance strategy](#27-performance-strategy)
28. [Attribution and automation terms](#28-attribution-and-automation-terms)
29. [Static page outlines](#29-static-page-outlines)
30. [Testing matrix](#30-testing-matrix)
31. [Analytics and privacy](#31-analytics-and-privacy)
32. [Column mapping skeletons](#32-column-mapping-skeletons)

---

## 1. How to use this document

- Treat this file as the **single source of truth** for v1 behavior, schema, and
  boundaries.
- If implementation reality conflicts with a source file, **fix ingestion or
  document the exception**—do not silently change product claims.
- **Transaction-level payments** and **annual county expenditures** are
  **parallel fact pipelines**. Never imply they are row-level joinable.

---

## 2. Product definition and scope

### 2.1 Name and positioning

- **Product name (v1):** Texas State Spending Explorer (or equivalent; avoid
  “Local Government Spending Explorer”).
- **What it is:** A public explorer for **Texas state treasury / state
  accounting–oriented spending**: who agencies pay, how spend is categorized,
  trends over time, and **where state dollars land by county** via a **separate
  annual aggregate layer**.

### 2.2 Core user questions (MVP)

1. Which agencies spend the most?
2. Who are the biggest payees?
3. What is Texas spending money on (category / object)?
4. How has agency spending changed over time?
5. How much state spending lands in my county?
6. Which agencies drive spending in a county?

### 2.3 Hard product truths

| Truth                                                                                                                    | Implication                                                                                |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Public payments outputs **do not** include payee/vendor numbers usable as stable join keys to procurement vendor masters | Vendor enrichment is **name-based** and **probabilistic**; store match metadata            |
| Public payments **do not** expose payee address                                                                          | **No** transaction-level county/city geography                                             |
| County “where money lands” data is **annual aggregated** state expenditure by county                                     | **Separate** `county_expenditure_facts`; never attach `county_id` to `state_payment_facts` |
| Confidentiality rules may mask payees (“CONFIDENTIAL”) and affect row grain                                              | Model `is_confidential`; never auto-match vendors for confidential payees                  |
| Comptroller cash report is **treasury / cash-basis** macro context                                                       | Use for reconciliation panels, not row-level truth for payments                            |

---

## 3. Source data reality (assessment summary)

### 3.1 Primary sources (conceptual)

1. **Payments to Payee** — State Revenue and Expenditure transparency (“Where
   the Money Goes” lineage). Transaction-level **for public rows**;
   daily/near-daily intent; ~10 fiscal years coverage (validate at ingest).
2. **Expenditures by County** — Texas Open Data Portal; **annual**; county ×
   agency × expenditure type (and variants by year).
3. **Comptroller object codes** — Authoritative 4-digit codes (+ titles, object
   group where available).
4. **Expenditure category codes** — Broad 2-digit categories used in
   reporting/UI.
5. **Object → category map** — May require published crosswalk, reconstruction
   from documentation, or inferred mapping (`is_inferred = true`).
6. **Vendor master (CMBL / VetHUB)** — Structured vendor file(s); **nightly
   refresh** documented for typical layouts; **not** joinable by ID to payments.
7. **Annual Cash Report** — Annual XLSX/ZIP; fund-level
   revenue/expenditure/balances; not transactional.

### 3.2 Final verdict

- **Production app:** **Yes**, scoped as **Texas state spending + annual county
  distribution**, with explicit UX for confidentiality and join limitations.
- **Not supported without additional local datasets:** City/county/school
  **local ledger** “checkbook” explorer.

---

## 4. Canonical data model and PostgreSQL DDL

### 4.1 Design principles

- **Two fact tables:** `state_payment_facts` (transactions) and
  `county_expenditure_facts` (annual geo aggregates).
- **Dimensions** for agency, payee, taxonomy, county, fiscal year.
- **Optional** `vendor_enrichment` + `payee_vendor_matches` for soft enrichment
  only.

### 4.2 Extensions and conventions

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
```

- All timestamps: `timestamptz`.
- Money in API as JSON **numbers**; in DB use `numeric` with explicit precision.
- UUIDs: `gen_random_uuid()` (pgcrypto).

### 4.3 DDL

```sql
-- ========== DIMENSIONS ==========

CREATE TABLE fiscal_years (
  fiscal_year     integer PRIMARY KEY,
  start_date      date NOT NULL,
  end_date        date NOT NULL,
  label           text NOT NULL
);

CREATE TABLE agencies (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_code               text,
  agency_name               text NOT NULL,
  agency_name_normalized    text NOT NULL,
  source_system             text NOT NULL DEFAULT 'texas_comptroller',
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agency_name_normalized)
);

CREATE INDEX idx_agencies_name ON agencies (agency_name);
CREATE INDEX idx_agencies_normalized ON agencies (agency_name_normalized);

CREATE TABLE payees (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payee_name_raw            text NOT NULL,
  payee_name_normalized     text NOT NULL,
  is_confidential           boolean NOT NULL DEFAULT false,
  entity_type               text,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  UNIQUE (payee_name_normalized, is_confidential)
);

CREATE INDEX idx_payees_normalized ON payees (payee_name_normalized);

CREATE TABLE geographies_counties (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state_code                text NOT NULL DEFAULT 'TX',
  county_name               text NOT NULL,
  county_name_normalized    text NOT NULL,
  fips_code                 text,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  UNIQUE (state_code, county_name_normalized)
);

CREATE TABLE comptroller_objects (
  code          text PRIMARY KEY,
  title         text NOT NULL,
  object_group  text,
  is_expenditure boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE expenditure_categories (
  code          text PRIMARY KEY,
  title         text NOT NULL,
  display_order integer,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE comptroller_object_category_map (
  comptroller_object_code   text NOT NULL REFERENCES comptroller_objects (code),
  expenditure_category_code text NOT NULL REFERENCES expenditure_categories (code),
  mapping_source            text NOT NULL,
  is_inferred               boolean NOT NULL DEFAULT false,
  created_at                timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (comptroller_object_code, expenditure_category_code)
);

CREATE TABLE vendor_enrichment (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_name_raw           text NOT NULL,
  vendor_name_normalized    text NOT NULL,
  cmbl_vendor_no            text,
  web_vid                   text,
  hub_status                text,
  small_business_flag       boolean,
  sdv_flag                  boolean,
  city                      text,
  county                    text,
  state                     text,
  zip                       text,
  email                     text,
  phone                     text,
  description               text,
  source_snapshot_date      date,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_vendor_enrichment_normalized ON vendor_enrichment (vendor_name_normalized);
CREATE UNIQUE INDEX uq_vendor_enrichment_ids ON vendor_enrichment (COALESCE(web_vid, ''), COALESCE(cmbl_vendor_no, ''));

CREATE TABLE payee_vendor_matches (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payee_id              uuid NOT NULL REFERENCES payees (id),
  vendor_enrichment_id  uuid NOT NULL REFERENCES vendor_enrichment (id),
  match_method          text NOT NULL,
  match_confidence      numeric(5,4) NOT NULL,
  is_manual_override    boolean NOT NULL DEFAULT false,
  review_status         text NOT NULL DEFAULT 'unreviewed',
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (payee_id)
);

CREATE INDEX idx_payee_vendor_matches_vendor ON payee_vendor_matches (vendor_enrichment_id);

-- Manual agency name alignment for county facts (see §6.7)
CREATE TABLE agency_name_crosswalk (
  county_agency_name_normalized text PRIMARY KEY,
  agency_id                     uuid NOT NULL REFERENCES agencies (id),
  source                        text NOT NULL DEFAULT 'manual',
  created_at                    timestamptz NOT NULL DEFAULT now()
);

-- ========== FACTS ==========

CREATE TABLE state_payment_facts (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_row_hash           text NOT NULL UNIQUE,
  payment_date              date NOT NULL,
  fiscal_year               integer NOT NULL REFERENCES fiscal_years (fiscal_year),
  agency_id                 uuid NOT NULL REFERENCES agencies (id),
  payee_id                  uuid REFERENCES payees (id),
  payee_name_raw            text NOT NULL,
  amount                    numeric(16,2) NOT NULL,
  object_category_raw       text,
  comptroller_object_code   text REFERENCES comptroller_objects (code),
  appropriated_fund_raw     text,
  appropriation_number      text,
  appropriation_year        text,
  is_confidential           boolean NOT NULL DEFAULT false,
  confidentiality_note      text,
  source_loaded_at          timestamptz NOT NULL,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_spf_agency_fy ON state_payment_facts (agency_id, fiscal_year);
CREATE INDEX idx_spf_payee_fy ON state_payment_facts (payee_id, fiscal_year);
CREATE INDEX idx_spf_fy_date ON state_payment_facts (fiscal_year, payment_date DESC);
CREATE INDEX idx_spf_object ON state_payment_facts (comptroller_object_code);
CREATE INDEX idx_spf_confidential ON state_payment_facts (is_confidential);
CREATE INDEX idx_spf_payment_date_desc ON state_payment_facts (payment_date DESC);
CREATE INDEX idx_spf_amount_desc ON state_payment_facts (amount DESC);
CREATE INDEX idx_spf_agency_payment_date ON state_payment_facts (agency_id, payment_date DESC);
CREATE INDEX idx_spf_payee_payment_date ON state_payment_facts (payee_id, payment_date DESC);
CREATE INDEX idx_spf_agency_payee_fy ON state_payment_facts (agency_id, payee_id, fiscal_year);

CREATE TABLE county_expenditure_facts (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_year               integer NOT NULL REFERENCES fiscal_years (fiscal_year),
  county_id                 uuid NOT NULL REFERENCES geographies_counties (id),
  agency_id                 uuid REFERENCES agencies (id),
  agency_name_raw           text NOT NULL,
  expenditure_type_raw      text NOT NULL,
  expenditure_category_code text REFERENCES expenditure_categories (code),
  amount                    numeric(16,2) NOT NULL,
  source_dataset_key        text,
  source_loaded_at          timestamptz NOT NULL,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fiscal_year, county_id, agency_name_raw, expenditure_type_raw)
);

CREATE INDEX idx_cef_county_fy ON county_expenditure_facts (county_id, fiscal_year);
CREATE INDEX idx_cef_agency_fy ON county_expenditure_facts (agency_id, fiscal_year);
CREATE INDEX idx_cef_fy_county_amount ON county_expenditure_facts (fiscal_year, county_id, amount DESC);

CREATE TABLE annual_cash_report_facts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_year       integer NOT NULL REFERENCES fiscal_years (fiscal_year),
  fund_number       text,
  fund_name         text,
  cash_balance      numeric(18,2),
  revenue_amount    numeric(18,2),
  expenditure_amount numeric(18,2),
  source_table_name text,
  source_loaded_at  timestamptz NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fiscal_year, fund_number, source_table_name)
);

CREATE INDEX idx_acrf_fy ON annual_cash_report_facts (fiscal_year);

-- ETL run ledger (see §26)
CREATE TABLE ingestion_runs (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name                text NOT NULL,
  source_name             text NOT NULL,
  source_url              text,
  source_dataset_id       text,
  source_file_name        text,
  artifact_checksum_sha256 text,
  rows_in                 integer,
  rows_staged             integer,
  rows_inserted           integer,
  rows_updated            integer,
  rows_rejected           integer,
  status                  text NOT NULL CHECK (status IN ('running', 'succeeded', 'failed', 'partial')),
  error_text              text,
  started_at              timestamptz NOT NULL DEFAULT now(),
  finished_at             timestamptz
);

CREATE INDEX idx_ingestion_runs_job_started ON ingestion_runs (job_name, started_at DESC);
```

**Trigram search (optional but recommended):** add GIN indexes on
`agencies(agency_name_normalized gin_trgm_ops)` and
`payees(payee_name_normalized gin_trgm_ops)` if `/search` and `q` filters are
implemented in-database.

**Rollup / materialized views (see §27):** `mv_overview_by_fy`,
`mv_agency_rollup_by_fy`, `mv_payee_rollup_by_fy`, `mv_county_rollup_by_fy`,
`mv_category_rollup_by_fy`, `mv_object_rollup_by_fy` — define in raw SQL
migrations; refresh after ETL.

### 4.4 Notes on the DDL

- `payees` uniqueness: confidential and non-confidential names may need
  different rows; adjust unique strategy if duplicates arise (e.g. partial
  unique index).
- `vendor_enrichment` unique index: refine if `web_vid` / `cmbl_vendor_no`
  nullability breaks uniqueness—use surrogate dedupe per ingest job.
- **Never add** `county_id` to `state_payment_facts`.

---

## 5. Staging layer

Every raw ingest lands in **staging** before core tables.

### 5.1 Required staging metadata columns

For each `stg_*` table (or wide JSON + metadata):

- `source_file_name`, `source_url`, `source_loaded_at`, `source_snapshot_date`,
  `row_number`
- Original columns preserved **as text** where type ambiguity exists

### 5.2 Staging table names

| Staging                          | Source                   |
| -------------------------------- | ------------------------ |
| `stg_payments_to_payee_raw`      | Payments export          |
| `stg_expenditures_by_county_raw` | County open data         |
| `stg_comptroller_objects_raw`    | Object code list         |
| `stg_expenditure_categories_raw` | Category list            |
| `stg_vendor_master_raw`          | CMBL / vendor master     |
| `stg_annual_cash_report_raw`     | Cash report spreadsheets |

---

## 6. Ingestion contract

### 6.1 Source → target mapping

| Source                 | Role                 | Target tables                                                  |
| ---------------------- | -------------------- | -------------------------------------------------------------- |
| Payments to Payee      | Primary transactions | `state_payment_facts`, `agencies`, `payees`, optional taxonomy |
| Expenditures by County | Annual geo facts     | `county_expenditure_facts`, `geographies_counties`, `agencies` |
| Object codes           | Taxonomy             | `comptroller_objects`                                          |
| Category codes         | Taxonomy             | `expenditure_categories`                                       |
| Object–category map    | Crosswalk            | `comptroller_object_category_map`                              |
| Vendor master          | Enrichment           | `vendor_enrichment`, `payee_vendor_matches` (via job)          |
| Annual cash report     | Macro reconciliation | `annual_cash_report_facts`, `fiscal_years`                     |

**Required fields (payments):** `payment_date`, agency, payee name, amount,
object category and/or comptroller object (as available).  
**Raw passthrough:** agency name, payee name, object fields, appropriation/fund
fields.  
**Derived:** `agency_id`, `payee_id`, `fiscal_year`, `is_confidential`,
`source_row_hash`.

**Required fields (county):** `fiscal_year`, county name, agency name,
expenditure type, amount.

### 6.2 Grain and deduplication

| Entity                     | Grain                                   | Dedupe / upsert                                    |
| -------------------------- | --------------------------------------- | -------------------------------------------------- |
| `state_payment_facts`      | One public payment row                  | `source_row_hash` UNIQUE; skip duplicates on rerun |
| `county_expenditure_facts` | FY × county × agency × expenditure type | Replace or upsert **per fiscal year** slice        |
| Taxonomy                   | One code per row                        | Upsert by code                                     |
| `vendor_enrichment`        | One row per vendor ID per snapshot      | Upsert on vendor identifiers                       |
| `annual_cash_report_facts` | FY × fund × source table                | Upsert composite key                               |

**`source_row_hash` (payments):** normative algorithm in
[§23](#23-source_row_hash-specification).

### 6.3 Normalization rules

- **Agency:** uppercase, trim, collapse whitespace, punctuation normalization,
  `&` → `AND`; **do not** merge distinct agency names without manual review.
- **Payee:** uppercase, trim, collapse whitespace, strip punctuation; strip
  suffix tokens: INC, LLC, LTD, CO, CORP, CORPORATION, LP, LLP. If raw payee is
  `CONFIDENTIAL` → `is_confidential = true`, **no** vendor matching.
- **County:** uppercase, strip optional `COUNTY` suffix, trim; map to Texas
  county dimension.
- **Fiscal year (Texas):** if month ≥ 9 → `fiscal_year = calendar_year + 1`,
  else `fiscal_year = calendar_year`.
- **Categories:** retain `object_category_raw`; map to codes when reliable.

### 6.4 Data quality gates

**Payments — reject/quarantine:** missing `payment_date`, missing agency,
missing/non-numeric amount.  
**Warn allow:** missing object/category fields; confidential payee edge cases.  
**County — reject:** missing FY, county, or amount.  
**Taxonomy — reject:** missing code or title.  
**Vendor — reject:** missing both name and ID.

### 6.5 Refresh cadence

| Dataset             | Target cadence      | Mode                               |
| ------------------- | ------------------- | ---------------------------------- |
| Payments            | Daily               | Incremental append + hash dedupe   |
| Vendor master       | Nightly             | Full refresh or versioned snapshot |
| Taxonomy            | Monthly / on change | Upsert                             |
| County expenditures | Annual              | Replace FY slice                   |
| Cash report         | Annual              | Replace FY slice                   |

### 6.6 Failure handling

- On failed run: **do not** wipe prior successful facts; log and retry.
- Log: start/end, rows processed/failed, checksum, duration; persist structured
  rows in `ingestion_runs`
  ([§26](#26-etl-operational-contract-migrations-and-seed)).

### 6.7 County / agency alignment (county facts)

**Rule:** `county_expenditure_facts.agency_id` remains **nullable**.

**ETL resolution order** when populating `agency_id` from county file
`agency_name_raw`:

1. **Exact normalized match:** `normalize(agency_name_raw)` =
   `agencies.agency_name_normalized` → set `agency_id`.
2. **Manual crosswalk:** lookup
   `agency_name_crosswalk.county_agency_name_normalized` → use mapped
   `agency_id`.
3. **Else:** leave `agency_id` **null** (no fuzzy auto-link).

**Rationale:** avoids split-brain UI from silent fuzzy merges; matches caution
against merging agencies without review. Human operators add rows to
`agency_name_crosswalk` via versioned CSV seed
([§26](#26-etl-operational-contract-migrations-and-seed)).

---

## 7. Data source implementation layer

Normative inventory and URLs are in [§22](#22-resolved-data-inventory). This
section summarizes **how** to ingest each source.

### 7.1 Payments to Payee (primary fact)

- **Confirmed public entry:** State Revenue and Expenditure Dashboard, linked
  from Comptroller transparency; host **`bivisual.cpa.texas.gov`**; dashboard
  replaces legacy “Where the Money Goes / Where the Money Comes From” tools and
  offers **downloadable tables/data**.
- **Lock — URLs:**
  - `human_entry_url`: https://comptroller.texas.gov/transparency/revenue/
  - `dashboard_index_url`:
    https://comptroller.texas.gov/transparency/open-data/dashboards.php
  - `dashboard_url`: https://bivisual.cpa.texas.gov/
- **Lock — ingest method:** **Playwright** + devtools-assisted discovery of
  export/network calls (no stable bulk API guaranteed).
- **Lock — artifact pattern:** one export per fiscal year per view, e.g.
  `payments_to_payee_fy{YYYY}.csv`.
- **Still unresolved (blockers):** exact download endpoint; exact CSV column
  names; whether export is direct CSV, Power BI export, or JSON behind the
  dashboard — **record in repo config after inspection**
  ([§22.H](#22h-remaining-hard-blockers)).

### 7.2 Expenditures by County (geo fact)

- **Portal:** Texas Open Data (`data.texas.gov`).
- **Lock — API pattern:** `https://data.texas.gov/resource/{dataset_id}.csv`
- **Lock — staging artifact pattern:**
  `tx_county_expenditures_{fiscal_year}_{dataset_id}.csv`
- **Confirmed dataset IDs** (FY → id): see [§22.B](#22b-expenditures-by-county).
- **Still unresolved:** FY **2013–2017, 2022, 2024+** dataset IDs; per-year
  column drift — validate during ETL ([§22.H](#22h-remaining-hard-blockers)).

### 7.3 Comptroller object codes

- **Dataset:** Comptroller Object Numbers and Titles — id **`gern-2bvs`**
- **Catalog:**
  https://data.texas.gov/Government-and-Taxes/Comptroller-Object-Numbers-and-Titles/gern-2bvs
- **CSV:** https://data.texas.gov/resource/gern-2bvs.csv

### 7.4 Expenditure category codes

- **Dataset:** Expenditure Category Numbers and Titles — id **`d57d-zxw6`**
- **Catalog:**
  https://data.texas.gov/Government-and-Taxes/Expenditure-Category-Numbers-and-Titles/d57d-zxw6
- **CSV:** https://data.texas.gov/resource/d57d-zxw6.csv

### 7.5 Object → category mapping

- Prefer published crosswalk; else `comptroller_object_category_map` with
  `is_inferred = true` and seed from
  `data-seed/taxonomy/object_category_map_manual.csv`
  ([§26](#26-etl-operational-contract-migrations-and-seed)).

### 7.6 Vendor master (CMBL / VetHUB)

- **Lock — landing page:** https://comptroller.texas.gov/purchasing/downloads/
  (**Downloadable Files**).
- **Lock — format:** vendor files are exposed as **CSV** (not
  `WEB_NAME.DAT`-only); multiple files exist (active master, alternate CSV,
  class/VIDs, HUBs/VetHUBs active FY, all active+inactive, etc.).
- **Lock — record layout:** companion **File Information & Record Layout
  (.txt)** on the same page — use for column positions/names.
- **Ingest:** direct HTTP download of chosen CSV; load `stg_vendor_master_raw` →
  `vendor_enrichment`.
- **Do not** assume `WEB_NAME.DAT` as the primary artifact.

### 7.7 Annual Cash Report

- **Lock — page:**
  https://comptroller.texas.gov/transparency/reports/cash-report/
- **Lock — artifacts:** prefer annual **“Download all data files” ZIP**;
  fallback individual XLSX (e.g. “Revenues, Expenditures and Cash Balances of
  State Funds, pages 8–114”; multiple Treasury Fund Detail XLSX files).
- **Lock — naming pattern:** `annual_cash_report_fy{YYYY}_all_data.zip`,
  `annual_cash_report_fy{YYYY}_rev_exp_cash_balances.xlsx`
- **Scope:** cash-basis state treasury reporting per Comptroller documentation.
- **Still unresolved:** per-FY sheet names and header rows until files are
  opened ([§22.H](#22h-remaining-hard-blockers)).

### 7.8 County geometry (map layer)

- **Lock — primary geometry:** **U.S. Census cartographic boundary** county
  files (simplified thematic boundaries; county identifiers such as GEOID /
  county FIPS).
- **Lock — backup / reference:** Texas ODP **TX Counties** dataset id
  **`vazh-2ajc`**; also “Texas Counties Cartographic Boundary Map” where useful.
- **Join key:** **5-digit county FIPS** — must match
  `geographies_counties.fips_code`. Map features join on **FIPS**, not internal
  UUID ([§11.10](#1110-texas-county-geometry-and-map-api-contract)).

### 7.9 Pipeline flow (all sources)

1. Download → 2. Validate artifact → 3. Load staging → 4. Normalize dimensions
   → 5. Load facts → 6. Post-process (vendor match, rollups) → 7. Log
   `ingestion_runs` + refresh materialized views
   ([§27](#27-performance-strategy)).

### 7.10 Forbidden automations

- Do not scrape behind auth or violate terms of use; prefer official exports and
  open data endpoints.
- Do not fabricate vendor IDs or counties for payment rows.

---

## 8. Vendor matching policy

### 8.1 Eligibility

- **Eligible payees:** `is_confidential = false` only. Confidential rows are
  **never** vendor-matched ([§24](#24-include_confidential-semantics)).

### 8.2 Database and scoring

- **Extension:** `pg_trgm` enabled
  ([§4](#4-canonical-data-model-and-postgresql-ddl)).
- **Candidate generation:** use trigram similarity in SQL (e.g. `similarity()`
  on normalized names) for vendor ↔ payee candidates.
- **Tokenization / normalization (match pipeline):** uppercase; trim; collapse
  whitespace; remove punctuation; strip suffixes INC, LLC, LTD, CO, CORP,
  CORPORATION, LP, LLP; `&` → `AND` (align with payee normalization).

### 8.3 Thresholds and storage

| Condition                              | Action                                        |
| -------------------------------------- | --------------------------------------------- |
| Exact normalized name match            | Auto-accept (`match_confidence` = 1.0)        |
| Trigram `similarity` ≥ 0.92 and < 0.98 | **Tentative** — `review_status` internal only |
| Below 0.92                             | Unmatched                                     |

- Persist matches in `payee_vendor_matches` with `match_method`,
  `match_confidence`, `is_manual_override`, `review_status`.
- **Never** overwrite a manual override with automation.
- **One active approved match per `payee_id`** for v1.

### 8.4 API exposure

- **Public API:** expose only **approved / auto-accepted** active match, or **no
  match**.
- **Tentative / unreviewed** candidates are **internal** (ops tooling only).
  Optional app-side token-set tie-break **only** for review tooling, not for
  live public API.

### 8.5 Optional review tooling

- Non-normative: use token-set ratio or similar in a **review queue** only to
  rank tentative candidates.

---

## 9. MVP product contract

### 9.1 First five pages

1. **State Spending Overview** (`/`) — totals, trends, top
   agencies/payees/categories, county preview, transactions preview.
2. **Agency Explorer** (`/agencies`, `/agencies/[id]`) — agency trends, payees,
   objects, **county distribution from county facts only**.
3. **Category Explorer** (`/categories`, `/categories/[code]`) — rollups,
   agencies, payees, objects, trends.
4. **County Spending Map** (`/counties`, `/counties/[id]`) — choropleth +
   tables; **explicit annual aggregate disclaimer**.
5. **Payee Explorer** (`/payees`, `/payees/[id]`) — trends, agencies,
   categories; enrichment labeled non-authoritative.

**Plus:** `/transactions` (table explorer), `/search`, static `/about`,
`/methodology`, `/data-sources`, `/disclaimers`.

### 9.2 First ten filters (MVP)

Fiscal year; agency; payee; expenditure category; comptroller object; county;
amount range; payment date range; include confidential; matched vendor only.

**Note:** On `/transactions`, **omit** county filter and any geography column.

### 9.3 First ten supported questions (acceptance anchors)

Listed in §21; align copy and tests with product contract.

### 9.4 KPI cards (minimum)

- **Home:** total spend, agency count, payee count, top agency, top payee, top
  category, county with highest landed spend.
- **Agency / payee / county pages:** per §2.2 and UI contract below.

### 9.5 Naming lock

v1 = **Texas State Spending Explorer**, not a generic local checkbook product.

---

## 10. API contract

**Base path:** `/api/v1`  
**Format:** JSON. **Money:** numbers. **Dates:** ISO `YYYY-MM-DD`.

### 10.1 Global query parameters

Where applicable:

`fiscal_year`, `fiscal_year_start`, `fiscal_year_end`, `agency_id`, `payee_id`,
`category_code`, `object_code`, `county_id`, `date_start`, `date_end`,
`min_amount`, `max_amount`, `include_confidential` (default `false`),
`matched_vendor_only`, `q`, `limit` (default 25, max 100), `offset` (default 0),
`sort`, `order` (`asc`|`desc`, default `desc`).

### 10.2 Aggregate response wrapper

Aggregates return:

```json
{
  "filters_applied": {},
  "data": {},
  "meta": { "currency": "USD" }
}
```

### 10.3 Pagination meta

```json
"meta": {
  "limit": 25,
  "offset": 0,
  "returned": 25,
  "total": 1243
}
```

### 10.4 Sort defaults

| Resource     | Default sort        |
| ------------ | ------------------- |
| agencies     | `total_spend` desc  |
| payees       | `amount` desc       |
| categories   | `amount` desc       |
| objects      | `amount` desc       |
| counties     | `amount` desc       |
| transactions | `payment_date` desc |

### 10.5 Endpoints (summary)

| Method | Path                                     | Notes                                     |
| ------ | ---------------------------------------- | ----------------------------------------- | ------ |
| GET    | `/overview`                              | Homepage summary                          |
| GET    | `/agencies`                              | List/search agencies                      |
| GET    | `/agencies/:agency_id`                   | Agency header stats                       |
| GET    | `/agencies/:agency_id/trends`            | FY series                                 |
| GET    | `/agencies/:agency_id/payees`            | Top payees                                |
| GET    | `/agencies/:agency_id/objects`           | By comptroller object                     |
| GET    | `/agencies/:agency_id/counties`          | **From `county_expenditure_facts` only**  |
| GET    | `/payees`                                | List/search payees                        |
| GET    | `/payees/:payee_id`                      | Payee header + optional enrichment        |
| GET    | `/payees/:payee_id/trends`               | `grain=year                               | month` |
| GET    | `/payees/:payee_id/agencies`             | Payers breakdown                          |
| GET    | `/payees/:payee_id/categories`           | Category breakdown                        |
| GET    | `/categories`                            | List categories                           |
| GET    | `/categories/:category_code`             | Detail                                    |
| GET    | `/categories/:category_code/trends`      |                                           |
| GET    | `/categories/:category_code/agencies`    |                                           |
| GET    | `/categories/:category_code/payees`      |                                           |
| GET    | `/categories/:category_code/objects`     |                                           |
| GET    | `/objects`                               | List objects                              |
| GET    | `/objects/:object_code`                  | Detail                                    |
| GET    | `/counties`                              | List/rank counties                        |
| GET    | `/counties/:county_id`                   | County header                             |
| GET    | `/counties/:county_id/agencies`          |                                           |
| GET    | `/counties/:county_id/expenditure-types` |                                           |
| GET    | `/counties/:county_id/trends`            |                                           |
| GET    | `/transactions`                          | **No `county_id`; no county in response** |
| GET    | `/transactions/:transaction_id`          | Single payment                            |
| GET    | `/search`                                | `q` required; `types=` optional           |

### 10.6 Overview response (example)

```json
{
  "filters_applied": {
    "fiscal_year": 2025,
    "include_confidential": false
  },
  "data": {
    "total_spend": 1234567890.12,
    "agency_count": 142,
    "payee_count": 58231,
    "top_agency": {
      "agency_id": "uuid",
      "agency_name": "Health and Human Services Commission",
      "amount": 123456789.12
    },
    "top_payee": {
      "payee_id": "uuid",
      "payee_name": "Example Vendor",
      "amount": 98765432.1
    },
    "top_category": {
      "category_code": "12",
      "category_title": "Salaries and Wages",
      "amount": 456789123.45
    },
    "top_county": {
      "county_id": "uuid",
      "county_name": "Travis",
      "amount": 76543210.11
    }
  },
  "meta": { "currency": "USD" }
}
```

### 10.7 Transaction list item (example)

```json
{
  "transaction_id": "uuid",
  "payment_date": "2025-01-15",
  "fiscal_year": 2025,
  "agency_id": "uuid",
  "agency_name": "…",
  "payee_id": "uuid",
  "payee_name": "…",
  "amount": 12345.67,
  "object_category_raw": "…",
  "object_code": "7211",
  "object_title": "…",
  "appropriated_fund_raw": null,
  "appropriation_number": null,
  "appropriation_year": null,
  "is_confidential": false
}
```

When `is_confidential` is true and `include_confidential=true`, `payee_id` must
be **null** and `payee_name` **`CONFIDENTIAL`**
([§24](#24-include_confidential-semantics)).

### 10.8 Error shape

```json
{
  "error": {
    "code": "INVALID_QUERY",
    "message": "category_code is invalid"
  }
}
```

**Codes:** `INVALID_QUERY`, `NOT_FOUND`, `UNSUPPORTED_COMBINATION`,
`INTERNAL_ERROR`.

**Example unsupported:** `GET /transactions?county_id=…` →
`UNSUPPORTED_COMBINATION` with message that **county_id is not supported** on
transaction endpoints.

### 10.9 Forbidden API behavior

- No `county_id` / city on transaction responses.
- No “local government ledger” labeling for state-only sources.
- Do not expose withheld vendor IDs from payments (there are none).

### 10.10 Implementation priority

1. `/overview`, `/agencies`, `/agencies/:id`, `/agencies/:id/payees`,
   `/categories`, `/counties`, `/counties/:id`, `/transactions`, `/search`
2. Remaining breakdown + trends endpoints
3. Payee + objects depth

### 10.11 Detailed endpoint contracts (normative)

**Shared conventions**

- `limit`: default `25`, max `100`. `offset`: default `0`. `order`: `asc` |
  `desc`.
- **List endpoints:** response shape `{ "data": [], "meta": { …pagination… } }`
  unless otherwise specified; include `filters_applied` where useful.
- **Detail endpoints:** `{ "data": { … } }` + non-pagination `meta`.
- Invalid `sort` key → `INVALID_QUERY`. Unsupported filter combination →
  `UNSUPPORTED_COMBINATION`.

**`GET /agencies`**

- **Allowed filters:** `fiscal_year`, `fiscal_year_start`, `fiscal_year_end`,
  `q`, `category_code`, `object_code`, `min_amount`, `max_amount`,
  `include_confidential` (semantics [§24](#24-include_confidential-semantics)).
- **Sort:** `agency_name`, `total_spend`, `payment_count`, `distinct_payees`.
- **Response fields (each row):** `agency_id`, `agency_code`, `agency_name`,
  `total_spend`, `payment_count`, `distinct_payees`, `latest_payment_date`.

**`GET /agencies/:agency_id`**

- **Response fields:** `agency_id`, `agency_code`, `agency_name`, `total_spend`,
  `payment_count`, `distinct_payees`, `top_payee`, `top_category`,
  `first_payment_date`, `last_payment_date`.

**`GET /agencies/:agency_id/payees`**

- **Filters:** `fiscal_year` (required unless FY implied by global default —
  implementer must document default FY behavior), `date_start`, `date_end`,
  `min_amount`, `max_amount`, `include_confidential`, `matched_vendor_only`.
- **Sort:** `amount`, `payment_count`, `payee_name`.
- **Fields:** `payee_id`, `payee_name`, `is_confidential`, `amount`,
  `payment_count`, `match_status`.

**`GET /agencies/:agency_id/objects`**

- **Filters:** `fiscal_year`, `include_confidential`.
- **Sort:** `amount`, `payment_count`, `object_code`.
- **Fields:** `object_code`, `object_title`, `object_group`, `amount`,
  `payment_count`.

**`GET /agencies/:agency_id/counties`**

- **Source:** `county_expenditure_facts` only.
- **Filters:** `fiscal_year`, `category_code`.
- **Sort:** `amount`, `county_name`.
- **Fields:** `county_id`, `county_name`, `fips_code`, `amount`.

**`GET /counties`**

- **Filters:** `fiscal_year`, `agency_id`, `category_code`, `q`.
- **Sort:** `amount`, `county_name`.
- **Fields:** `county_id`, `county_name`, `fips_code`, `amount`, `agency_count`,
  `top_agency`.

**`GET /counties/:county_id/agencies`**

- **Filters:** `fiscal_year`, `category_code`.
- **Sort:** `amount`, `agency_name`.
- **Fields:** `agency_id`, `agency_name`, `amount` (nullable `agency_id` allowed
  when county file row unresolved — surface `agency_name` from county facts).

**`GET /counties/:county_id/expenditure-types`**

- **Filters:** `fiscal_year`.
- **Sort:** `amount`, `expenditure_type`.
- **Fields:** `expenditure_type_raw`, `category_code`, `category_title`,
  `amount`.

**`GET /transactions`**

- **Allowed filters:** `fiscal_year`, `agency_id`, `payee_id`, `category_code`,
  `object_code`, `date_start`, `date_end`, `min_amount`, `max_amount`,
  `include_confidential`, `matched_vendor_only`, `q`.
- **Forbidden:** `county_id` → `UNSUPPORTED_COMBINATION`.
- **Sort:** `payment_date`, `amount`, `agency_name`, `payee_name`.
- **Fields:** `transaction_id`, `payment_date`, `fiscal_year`, `agency_id`,
  `agency_name`, `payee_id`, `payee_name`, `amount`, `object_category_raw`,
  `object_code`, `object_title`, `appropriated_fund_raw`,
  `appropriation_number`, `appropriation_year`, `is_confidential`.

Full **OpenAPI** may be added later; this subsection is sufficient for v1
implementation.

---

## 11. Frontend route contract (Nuxt)

### 11.1 Repository implementation paths (locked)

All v1 application work lands in `apps/web/`:

```text
apps/web/
  app/
    app.vue
    assets/css/
    components/
    pages/
    layouts/
  server/
    api/v1/
    database/
    utils/
  nuxt.config.ts
```

Implementation must prefer layer-provided helpers before creating app-local
alternatives:

- SEO: `useSeo(...)`
- Schema.org: `useWebPageSchema(...)` and sibling helpers from
  `layers/narduk-nuxt-layer/app/composables/useSchemaOrg.ts`
- Tabs: `AppTabs` and `usePersistentTab`
- Server imports: `#server/*`

### 11.2 Locked page files

Target page surface for v1:

```text
apps/web/app/pages/
  index.vue
  about.vue
  methodology.vue
  data-sources.vue
  disclaimers.vue
  search/index.vue
  transactions/index.vue
  agencies/index.vue
  agencies/[agencyId].vue
  payees/index.vue
  payees/[payeeId].vue
  categories/index.vue
  categories/[categoryCode].vue
  objects/index.vue
  objects/[objectCode].vue
  counties/index.vue
  counties/[countyId].vue
```

Current placeholder param files such as `[id].vue` or `[code].vue` may exist in
the repo. When an agent edits those routes, it should converge them to
**descriptive param names** that match Nuxt 4 routing guidance:

- `[agencyId].vue`
- `[payeeId].vue`
- `[categoryCode].vue`
- `[objectCode].vue`
- `[countyId].vue`

### 11.3 Locked API file targets

Server handlers live under `apps/web/server/api/v1/`:

```text
overview.get.ts
search.get.ts
agencies/index.get.ts
agencies/[agencyId].get.ts
agencies/[agencyId]/payees.get.ts
agencies/[agencyId]/objects.get.ts
agencies/[agencyId]/counties.get.ts
agencies/[agencyId]/trends.get.ts
payees/index.get.ts
payees/[payeeId].get.ts
payees/[payeeId]/agencies.get.ts
payees/[payeeId]/categories.get.ts
payees/[payeeId]/trends.get.ts
categories/index.get.ts
categories/[categoryCode].get.ts
categories/[categoryCode]/agencies.get.ts
categories/[categoryCode]/payees.get.ts
categories/[categoryCode]/objects.get.ts
categories/[categoryCode]/trends.get.ts
objects/index.get.ts
objects/[objectCode].get.ts
counties/index.get.ts
counties/[countyId].get.ts
counties/[countyId]/agencies.get.ts
counties/[countyId]/expenditure-types.get.ts
counties/[countyId]/trends.get.ts
transactions/index.get.ts
transactions/[transactionId].get.ts
```

### 11.4 Nuxt page implementation rules

- Use `<script setup lang="ts">` on every page.
- Every page must call `useSeo(...)` and a Schema.org helper such as
  `useWebPageSchema(...)`.
- Page data must use `await useFetch(...)`, `useLazyFetch(...)`,
  `useAsyncData(...)`, or `useLazyAsyncData(...)`. Do **not** use raw `$fetch`
  directly in page `script setup`.
- Use Nuxt’s `useRoute()` composable, not the `vue-router` import directly.
- Use `useRequestURL()` to derive canonical URLs, absolute OG image links, and
  SSR-safe origin/path data.
- Do not drive SSR-rendered markup from `route.fullPath`; URL fragments are
  client-only.
- Keep the first SSR render deterministic. Browser-only logic belongs behind
  `onMounted`, `ClientOnly`, or a `.client.vue` component.

### 11.5 Server route implementation rules

- Read query parameters with `getValidatedQuery(event, schema.parse)`.
- Route-specific query schemas may extend `globalQuerySchema` from
  `apps/web/server/utils/query.ts`.
- Use `createError(...)` for `400`, `404`, and unsupported filter combinations.
- Read DB access through `useAppDatabase(event)` from
  `apps/web/server/utils/database.ts`; this is the Hyperdrive-backed PostgreSQL
  entry point for deployed app requests.
- Use `#server/database/schema` and `#server/utils/*` imports only.
- Future mutation routes must use the layer mutation wrappers
  (`withValidatedBody`, `withOptionalValidatedBody`, `define*Mutation`), but v1
  of this product is read-only and should not invent writes.

### 11.6 URL query parameters (public)

Shared URL params:

`fy`, `fyStart`, `fyEnd`, `agency`, `payee`, `category`, `object`, `county`,
`dateStart`, `dateEnd`, `minAmount`, `maxAmount`, `includeConfidential`,
`matchedVendorOnly`, `q`, `sort`, `order`, `page`.

Mapping rules:

- `fy` → `fiscal_year`
- `fyStart` → `fiscal_year_start`
- `fyEnd` → `fiscal_year_end`
- `page` → `offset = (page - 1) * limit`
- `agency`, `payee`, `county` map to UUID filters when present

### 11.7 Tabs and navigation

- Detail pages use in-page tabs only. Do **not** create nested tab routes in v1.
- Prefer the layer `AppTabs` + `usePersistentTab` over custom tab persistence.
- Primary navigation: Overview, Agencies, Payees, Categories, Counties,
  Transactions.
- Secondary/global navigation: search, fiscal year selector, methodology,
  disclaimers, data sources.

### 11.8 SEO indexing

- **Index:** `/`, `/agencies`, `/agencies/[agencyId]`, `/payees`,
  `/payees/[payeeId]`, `/categories`, `/categories/[categoryCode]`, `/objects`,
  `/objects/[objectCode]`, `/counties`, `/counties/[countyId]`, `/about`,
  `/methodology`, `/data-sources`.
- **Noindex:** `/transactions`, `/search`, `/disclaimers`.

### 11.9 Canonical policy

- Canonical URLs for entity detail pages omit non-essential query params by
  default.
- Fiscal-year filters may alter visible page state, but do not become canonical
  variants in v1.

### 11.10 Metadata examples

- **Agency title:** `{Agency Name} Spending in Texas`
- **County title:** `Texas State Spending in {County Name} County`
- **Payee title:** `{Payee Name} Payments from Texas Agencies`
- **Category title:** `{Category Title} Spending in Texas`
- **Object title:** `Texas Spending for Comptroller Object {Object Code}`

### 11.11 Errors and empty states

- 404 for missing entities with explicit copy: `Agency not found`,
  `Payee not found`, `County not found`, `Category not found`.
- Empty states must include a clear message, a reset action, and one relevant
  navigation CTA.

### 11.12 Build order (frontend)

`/`, `/agencies`, `/agencies/[agencyId]`, `/categories`, `/counties`,
`/counties/[countyId]`, `/transactions`, then payee and object pages.

### 11.13 Texas county geometry and map API contract

- **Primary map layer:** U.S. Census cartographic boundary county geometries.
- **Backup / reference:** Texas Open Data `vazh-2ajc` (TX Counties).
- **Join key:** **5-digit county FIPS** stored as
  `geographies_counties.fips_code` and returned by county APIs as `fips_code`.
- **Map components:** join GeoJSON features to API metrics using `fips_code`,
  not internal `county_id`.
- **Entity URLs:** user-facing routes continue to use internal UUID `county_id`;
  client resolves `county_id` ↔ `fips_code` from API payload.
- **API:** list/detail county responses include both `county_id` and
  `fips_code`.

---

## 12. UI contract

### 12.1 Global principles

- Editorial, data-first, trust-forward, minimal decoration.
- Summary first, breakdown second, raw rows last.
- Every chart needs a numeric anchor.
- The map is never the only county interface; always pair it with a ranked
  table.

### 12.2 Nuxt UI foundation (locked)

- App root is already wrapped in `<UApp>` via `apps/web/app/app.vue`.
- Use Nuxt UI primitives for interactive and structural UI: `UButton`, `UCard`,
  `UTable`, `UTabs`, `UInput`, `USelectMenu`, `UCheckbox` or `USwitch`,
  `UAlert`, `UBadge`, `UPagination`, `USkeleton`, `UContainer`, `UDrawer` or
  `USlideover`.
- Prefer semantic colors (`primary`, `neutral`, `success`, `warning`, `error`)
  and semantic text/background utilities from the layer (`text-default`,
  `text-muted`, `bg-default`, `border-default`, etc.).
- Inputs do not auto-stretch; add `class="w-full"` unless a narrower layout is
  intentional.
- Use `i-lucide-*` icons only.

### 12.3 Shell

- Header: product name, global search, fiscal year selector, methodology link.
- Sticky `FilterBar` on desktop.
- Mobile filters open in `UDrawer` or `USlideover`.
- Use `DisclaimerStrip` on sensitive views.

### 12.4 Filter visibility

- Hide unsupported filters entirely instead of showing disabled controls.
- `/transactions` must not show county filters.
- County detail pages may replace the county selector with compare controls.

### 12.5 Page anatomy (by route)

- **`/`:** KPI row → trend chart + top categories → top agencies / payees →
  county choropleth preview → latest transactions preview.
- **`/agencies`:** searchable, sortable table of agencies.
- **`/agencies/[agencyId]`:** header KPIs + tabs (Overview, Payees, Objects,
  Counties, Trends). County tab always includes the county-layer disclaimer.
- **`/payees/[payeeId]`:** header + vendor enrichment badge row with tooltip;
  tabs: Overview, Agencies, Categories, Trends.
- **`/categories/[categoryCode]`:** analytical layout: trend, top agencies, top
  payees, object breakdown.
- **`/objects/[objectCode]`:** compact detail page in v1; trends and related
  entities may remain below the fold.
- **`/counties`:** map-first + ranked table + compare.
- **`/counties/[countyId]`:** header + tabs (Overview, Agencies, Expenditure
  Types, Trends); optional locator highlight.
- **`/transactions`:** table-first, no map, no county column, confidentiality
  disclaimer.

### 12.6 Charts allowed (v1)

Use only:

- line charts for trends
- horizontal bars for rankings
- stacked bars for composition
- choropleth for county geography
- simple donuts for small composition views

Avoid sankey, treemap, radar, packed bubbles, or novelty charts.

### 12.7 Tables

- Sortable and paginated.
- Sticky header on desktop.
- Responsive card-list fallback on small screens when needed.
- Abbreviated currency on cards/charts; full precision in tables and tooltips.
- Explicit copy for `Unknown`, `Not available`, `Confidential`, and
  `No enrichment match`.

### 12.8 Search UX

- Grouped autocomplete results: agencies, payees, categories, objects, counties.
- Enter routes to `/search?q=...`.
- Click routes directly to the entity page.

### 12.9 Accessibility

- Keyboard-accessible filters, tabs, drawers, and tables.
- Visible focus states.
- Correct header cell semantics for tables.
- Charts require accessible summary text or a data-table fallback.
- County map must have a readable paired table.

---

## 13. Component and data-binding contract

### 13.1 Component file map (locked)

| File                                              | Responsibility                  | Nuxt UI / layer primitives                                                                      | API source / data owner              | SSR vs client                                        |
| ------------------------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------ | ---------------------------------------------------- |
| `apps/web/app/components/PageHeader.vue`          | Title, subtitle, breadcrumbs    | `UPageHeader`, `UBreadcrumb`, `UButton`                                                         | Page-level props                     | SSR                                                  |
| `apps/web/app/components/AppHeader.vue`           | Global top nav                  | `UContainer`, `UButton`, `UInputMenu`                                                           | Global navigation/search             | SSR shell + client interactions                      |
| `apps/web/app/components/DisclaimerStrip.vue`     | Short scope/data warning        | `UAlert`, `UBadge`, `ULink`                                                                     | Static copy from §16                 | SSR                                                  |
| `apps/web/app/components/FilterBar.vue`           | URL-synced page filters         | `UCard`, `UFormField`, `USelectMenu`, `UInput`, `USwitch`, `UButton`, `UDrawer` or `USlideover` | Route query + page config            | SSR default state, client updates                    |
| `apps/web/app/components/KpiCard.vue`             | Single KPI                      | `UCard`, `UBadge`, `UIcon`                                                                      | Overview/detail header endpoints     | SSR                                                  |
| `apps/web/app/components/TrendChartCard.vue`      | Trend chart wrapper             | `UCard`, `USkeleton`; chart lib kept abstract                                                   | `*/trends`, overview                 | SSR if deterministic; hydrate chart only if required |
| `apps/web/app/components/RankedBarCard.vue`       | Top-N ranked chart              | `UCard`, `USkeleton`                                                                            | Breakdown endpoints                  | SSR if deterministic; hydrate if chart library needs |
| `apps/web/app/components/DataTableCard.vue`       | Sortable paginated table        | `UTable`, `UPagination`, `USkeleton`, `UButton`                                                 | List endpoints                       | SSR first page, client pagination/sort               |
| `apps/web/app/components/CountyMapCard.vue`       | Choropleth + legend             | `UCard`, `USkeleton`, `ClientOnly` if browser map                                               | `/counties` or county detail rollups | Lazy/client if browser-only map lib is used          |
| `apps/web/app/components/EntityTabs.vue`          | Entity tab shell                | `AppTabs` from layer or `UTabs`                                                                 | Local tab definitions                | SSR default tab, client tab switching                |
| `apps/web/app/components/SearchAutocomplete.vue`  | Inline typeahead                | `UInputMenu` or `UCommandPalette`                                                               | `/api/v1/search`                     | Client, lazy after input                             |
| `apps/web/app/components/GlobalSearch.vue`        | Header/global search            | `UInputMenu` or `UCommandPalette`                                                               | `/api/v1/search`                     | Client, lazy after input                             |
| `apps/web/app/components/EmptyState.vue`          | No-data view                    | `UCard`, `UButton`, optional `UEmpty`                                                           | Local props                          | SSR                                                  |
| `apps/web/app/components/VendorMatchBadgeRow.vue` | Enrichment badges + tooltip     | `UBadge`, `UTooltip`, `USeparator`                                                              | `/api/v1/payees/:payeeId`            | SSR                                                  |
| `apps/web/app/components/DisclaimerFooter.vue`    | Persistent source/footnote area | `USeparator`, `ULink`                                                                           | Static copy + source links           | SSR                                                  |

### 13.2 Component prop contracts

Minimum prop contracts:

- `PageHeader`
  - `title: string`
  - `subtitle?: string`
  - `breadcrumbs?: Array<{ label: string; to?: string }>`
  - `actions?: Array<{ label: string; to?: string }>`
- `DisclaimerStrip`
  - `variant: 'global' | 'county' | 'payee' | 'transactions' | 'confidentiality'`
  - `compact?: boolean`
- `FilterBar`
  - `availableFilters: FilterDefinition[]`
  - `modelValue: Record<string, string | number | boolean | null>`
  - `loading?: boolean`
- `KpiCard`
  - `label: string`
  - `value: string | number`
  - `delta?: number | null`
  - `helper?: string`
- `TrendChartCard`
  - `title: string`
  - `series: Array<Record<string, unknown>>`
  - `xKey: string`
  - `yKey: string`
  - `valueFormatter?: (value: number) => string`
- `RankedBarCard`
  - `title: string`
  - `items: Array<Record<string, unknown>>`
  - `labelKey: string`
  - `valueKey: string`
- `DataTableCard`
  - `columns: Array<{ key: string; label: string; sortable?: boolean }>`
  - `rows: Array<Record<string, unknown>>`
  - `meta?: { limit: number; offset: number; total: number }`
  - `loading?: boolean`
- `CountyMapCard`
  - `countyMetrics: Array<{ county_id: string; fips_code?: string; county_name: string; amount: number }>`
  - `fy?: number`
  - `loading?: boolean`
- `EntityTabs`
  - `tabs: Array<{ key: string; label: string }>`
  - `activeTab: string`
- `VendorMatchBadgeRow`
  - `enrichment: VendorEnrichmentPublic | null`
  - `matchConfidence?: number | null`
  - `showDisclaimer?: boolean`

### 13.3 Binding rules

- County amounts on agency pages come from `GET /agencies/:agency_id/counties`
  only.
- County pages and county maps read only from county fact endpoints.
- Transactions pages read only from `/transactions` endpoints and must never
  receive or synthesize county fields.
- Search components call `/search`; they do not hit list endpoints directly for
  autocomplete.
- Tabbed detail pages SSR the header + overview tab only; secondary tabs fetch
  on demand.

### 13.4 Loading, empty, and error states

- Every card/table/chart component accepts an explicit loading state.
- Use `USkeleton` for loading, not spinners as the only loading affordance.
- Every data block supports a specific empty state via `EmptyState.vue`.
- Endpoint failures should render a retry CTA and preserve surrounding page
  shell content.

---

## 14. SSR vs client loading

### 14.1 SSR-first surfaces

SSR these surfaces:

- `/`
- entity index pages with the first page of results
- entity detail pages: header + overview tab
- static trust pages: `/about`, `/methodology`, `/data-sources`, `/disclaimers`

Use `await useFetch(...)` or `await useAsyncData(...)` so the server payload is
forwarded into hydration cleanly.

### 14.2 Client-hydrated surfaces

Hydrate on the client for:

- filter changes
- pagination
- sorting
- tab switching
- autocomplete search
- map selection / hover details
- non-critical below-the-fold charts

### 14.3 Lazy data and lazy hydration

- Use `lazy: true`, `useLazyFetch`, or `useLazyAsyncData` for secondary tabs and
  below-the-fold data.
- Use a stable async-data key per page/tab/filter combination.
- Use `server: false` only for non-SEO surfaces such as autocomplete or
  browser-only map helpers.
- Heavy interactive islands may use `Lazy*` components or `ClientOnly`, but the
  surrounding card/layout should still SSR.

### 14.4 Hydration safety rules

- Do not render `Date.now()`, `Math.random()`, storage reads, or browser-only
  state in the first SSR pass.
- Do not rely on `window.location`, `window.origin`, or direct browser APIs in
  SSR paths; use `useRequestURL()`.
- Keep chart/table fallback markup deterministic so SSR and hydration match.

### 14.5 Query-sync pattern

- Route query params are the source of truth for filter state.
- Client filter changes update the route query first, then refresh data.
- Pagination and sorting must remain deep-linkable through the URL.

---

## 15. SEO, indexing, and metadata

### 15.1 Foundation

The app already extends the shared Nuxt layer and uses `@nuxtjs/seo`. SEO
implementation must build on that foundation instead of bypassing it.

- `apps/web/nuxt.config.ts` owns `site.url`, `site.name`, and
  `site.description`.
- Use `SITE_URL` and `APP_NAME` as the runtime source of truth for deployed
  metadata.
- Every page calls `useSeo(...)` instead of raw `useSeoMeta()` / `useHead()`.
- Every page also calls a Schema.org helper such as `useWebPageSchema(...)`.

### 15.2 Robots and indexing

- Index entity pages and trust pages that explain the product.
- Apply `useRobotsRule('noindex, nofollow')` on `/transactions`, `/search`, and
  `/disclaimers`.
- Keep non-production environments non-indexable.

### 15.3 Sitemap contract

- Provide sitemap coverage for:
  - `/`
  - `/about`
  - `/methodology`
  - `/data-sources`
  - agencies
  - payees
  - categories
  - objects
  - counties
- Exclude `/transactions`, `/search`, `/disclaimers`, and any purely filtered
  result variants.
- Dynamic entity URLs may be emitted via `server/api/__sitemap__/urls.ts` using
  `defineSitemapEventHandler(...)`.

### 15.4 Schema.org contract

- Minimum schema on every page: `WebPage`.
- Use breadcrumbs on entity detail pages when practical.
- Home page may include `WebSite` + `SearchAction` later, but that is optional
  for v1.
- Payee and county pages remain informational pages; do not misuse product,
  local business, or dataset schema types.

### 15.5 Canonical and metadata rules

- Unique titles and descriptions per entity page.
- Canonical URL defaults to the clean entity route without non-essential query
  params.
- Build canonical URLs with `useRequestURL()` or explicit route builders.
- Use the layer `useSeo` OG-image integration (`defineOgImage`) instead of
  manual OG tags.

---

## 16. Required disclaimers (exact product language)

Use verbatim unless legal requests edits:

**Global**

> This product explores Texas state spending data published by the Texas
> Comptroller and related state transparency sources. It is not a complete
> ledger for all local governments in Texas.

**County**

> County views show annual county-level state expenditures from the
> Comptroller’s county expenditure reports. They are not derived from geocoding
> individual payment transactions.

**Payee / vendor enrichment**

> Vendor enrichment is based on public procurement/vendor files and name-based
> matching where available. Some matches may be incomplete or approximate
> because public payment outputs do not include public vendor IDs.

**Confidentiality**

> Some transactions are masked or aggregated in the public source data due to
> confidentiality rules.

### 16.1 Placement matrix

- `global`: `/`, `/about`, `/methodology`, `/data-sources`
- `county`: `/counties`, `/counties/[countyId]`, agency county tab
- `payee/vendor`: `/payees/[payeeId]` when enrichment is shown
- `confidentiality`: `/transactions` and any page where
  `include_confidential=true`

---

## 17. Caching and performance

### 17.1 Suggested HTTP/CDN cache hints (adjust to infra)

| Endpoint pattern                   | TTL        |
| ---------------------------------- | ---------- |
| `/overview`                        | 1 hour     |
| Agency/payee/category/county lists | 1 hour     |
| Entity detail                      | 1 hour     |
| `/transactions`                    | 15 minutes |
| Taxonomy                           | 24 hours   |
| County-specific annual endpoints   | 24 hours   |
| Cash report–backed                 | 24 hours   |

### 17.2 Nuxt route rules (target)

Use route rules to reflect freshness and SEO needs:

```ts
routeRules: {
  '/': { swr: 3600 },
  '/about': { prerender: true },
  '/methodology': { prerender: true },
  '/data-sources': { prerender: true },
  '/disclaimers': { prerender: true, robots: 'noindex, nofollow' },
  '/agencies/**': { swr: 3600 },
  '/payees/**': { swr: 3600 },
  '/categories/**': { swr: 3600 },
  '/objects/**': { swr: 3600 },
  '/counties/**': { swr: 86400 },
  '/transactions/**': { ssr: true, robots: 'noindex, nofollow' },
  '/search/**': { ssr: true, robots: 'noindex, nofollow' },
  '/api/v1/overview': { cache: { maxAge: 3600 } },
}
```

If platform support varies, keep the TTL intent even if the exact syntax
changes.

### 17.3 Payload and rendering discipline

- Keep initial payloads shallow; use `pick` or narrower response shapes when
  possible.
- Do not SSR unbounded tables.
- Lazy-load secondary tabs and browser-only map code.
- Pair map rendering with server-rendered ranked-table data so the page remains
  useful before client hydration.

---

## 18. Errors and edge cases

- **Confidential payees:** show label; exclude from vendor match; API behavior
  for totals/lists is **normative** in [§24](#24-include_confidential-semantics)
  (methodology page must match).
- **Duplicate agency names:** keep separate `agencies` rows unless human
  merge—surface distinct IDs.
- **Category mapping gaps:** show raw object/category; do not invent codes.
- **Vendor match low coverage:** show “No enrichment match” state.
- **Sums mismatch** between payments and county or cash report: explain in
  methodology (different scope, grain, confidentiality).

---

## 19. Non-goals and forbidden claims

**Out of scope v1:** auth, saved views, alerts, local government ledger
ingestion, procurement contract explorer, FOIA workflow.

**Do not claim:** transaction-level spend by county; city-level payment
geography; perfect vendor identity; one-to-one payment↔procurement vendor joins;
“full” local transparency.

---

## 20. Build order

1. PostgreSQL DDL + migrations
   ([§4](#4-canonical-data-model-and-postgresql-ddl), including
   `ingestion_runs`, `agency_name_crosswalk`, indexes, `pg_trgm`).
2. Seed `fiscal_years` + taxonomy from `data-seed/taxonomy/`
   ([§26](#26-etl-operational-contract-migrations-and-seed)).
3. Staging tables + ETL worker shell; wire `ingestion_runs` + env vars
   ([§25](#25-runtime-topology-environments-and-secrets)).
4. County annual ETL → `county_expenditure_facts` + counties (dataset IDs
   [§22.B](#22b-expenditures-by-county)); apply
   [§6.7](#67-county--agency-alignment-county-facts).
5. Payments ETL → `state_payment_facts` + dimensions; implement
   [§23](#23-source_row_hash-specification).
6. Taxonomy loads + object–category map (manual CSV as needed).
7. Vendor enrichment CSV load + [§8](#8-vendor-matching-policy) match job.
8. Cash report load (optional for MVP UI but in schema).
9. Materialized views / rollups + refresh job ([§27](#27-performance-strategy)).
10. API: overview → agencies → counties → transactions → search → remainder
    ([§10.11](#1011-detailed-endpoint-contracts-normative)).
11. Nuxt pages in frontend priority order + static pages
    ([§29](#29-static-page-outlines)); county map via FIPS
    ([§11.10](#1110-texas-county-geometry-and-map-api-contract)).
12. SEO metadata, disclaimers, attribution
    ([§16](#16-required-disclaimers-exact-product-language),
    [§28](#28-attribution-and-automation-terms)).
13. Hardening: [§30](#30-testing-matrix) (API + golden parsers + E2E).

---

## 21. Acceptance criteria

**Data / API**

- [ ] `GET /transactions` rejects or errors on `county_id` with
      `UNSUPPORTED_COMBINATION`.
- [ ] No transaction JSON includes county or city fields.
- [ ] `GET /agencies/:id/counties` reads only from county annual facts.
- [ ] `include_confidential=false` and `=true` behaviors match
      [§24](#24-include_confidential-semantics) (including `payee_id` null and
      synthetic confidential bucket for distinct payee count).

**Product questions answerable in UI**

1. Who did Texas pay the most this year?
2. Which agencies spent the most this year?
3. What are the top spending categories this year?
4. How much did a specific agency spend over time?
5. Which payees got the most from a specific agency?
6. What comptroller objects drive spending for an agency?
7. How much state spending landed in Travis County (annual layer)?
8. Which agencies account for the most spending in a county?
9. Which expenditure types dominate a county?
10. Which payees show HUB/SB enrichment **where matched** (labeled as
    enrichment)?

**UX / trust**

- [ ] County and transaction pages show correct disclaimer strips.
- [ ] Payee enrichment clearly labeled non-authoritative.
- [ ] `/transactions` has no map/county column.

---

## 22. Resolved data inventory

### 22.A Payments to Payee / State Revenue and Expenditure Dashboard

**Confirmed**

- Comptroller’s current public entry is the **State Revenue and Expenditure
  Dashboard** linked from **Dashboards and Data Visualizations**.
- Dashboard includes **Payments to Payee**, Expenditures, Revenues, Travel
  Payments, and Economic Development.
- Comptroller states the updated dashboard **replaces** legacy “Where the Money
  Goes / Where the Money Comes From” tools and offers **downloadable
  tables/data**.
- Public dashboard host: **`bivisual.cpa.texas.gov`**.

**Lock**

| Key                   | Value                                                               |
| --------------------- | ------------------------------------------------------------------- |
| `human_entry_url`     | https://comptroller.texas.gov/transparency/revenue/                 |
| `dashboard_index_url` | https://comptroller.texas.gov/transparency/open-data/dashboards.php |
| `dashboard_url`       | https://bivisual.cpa.texas.gov/                                     |
| `ingest_method`       | Playwright + devtools-assisted discovery                            |
| `artifact_pattern`    | `payments_to_payee_fy{YYYY}.csv` (one per fiscal year per view)     |

**Still unresolved (explicit blockers)**

- Exact download endpoint / network contract.
- Exact CSV column names.
- Whether export is direct CSV, Power BI export, or JSON behind the dashboard.

### 22.B Expenditures by County

**Lock — source pattern:** `https://data.texas.gov/resource/{dataset_id}.csv`  
**Lock — staging artifact:**
`tx_county_expenditures_{fiscal_year}_{dataset_id}.csv`

**Confirmed dataset IDs (Texas Open Data)**

| Fiscal year  | Dataset ID  |
| ------------ | ----------- |
| 2010         | `m8nt-qbcj` |
| 2011         | `sfev-gmfs` |
| 2012         | `jkrx-gxjp` |
| 2018         | `f2iw-dtqt` |
| 2019         | `2x5x-m677` |
| 2020         | `aact-g69n` |
| 2021         | `tup7-smjg` |
| 2023         | `iyey-5sid` |
| 2023 summary | `fnb3-hipf` |

**Still unresolved**

- FY **2013–2017, 2022, 2024+** dataset IDs (not confirmed from current search).
- Exact per-year **column drift** — validate in ETL.

### 22.C Comptroller object codes

| Item        | Value                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------- |
| Title       | Comptroller Object Numbers and Titles                                                       |
| Dataset ID  | `gern-2bvs`                                                                                 |
| Catalog URL | https://data.texas.gov/Government-and-Taxes/Comptroller-Object-Numbers-and-Titles/gern-2bvs |
| CSV         | https://data.texas.gov/resource/gern-2bvs.csv                                               |

### 22.D Expenditure category codes

| Item        | Value                                                                                         |
| ----------- | --------------------------------------------------------------------------------------------- |
| Title       | Expenditure Category Numbers and Titles                                                       |
| Dataset ID  | `d57d-zxw6`                                                                                   |
| Catalog URL | https://data.texas.gov/Government-and-Taxes/Expenditure-Category-Numbers-and-Titles/d57d-zxw6 |
| CSV         | https://data.texas.gov/resource/d57d-zxw6.csv                                                 |

### 22.E Vendor master

- **Landing page:** https://comptroller.texas.gov/purchasing/downloads/
- **Format:** CSV downloads (active CMBL/VetHUB master, alternate CSV,
  class/VIDs, HUBs/VetHUBs active FY, all active+inactive, etc.).
- **Record layout:** companion **.txt** on same page for each file.
- **Spec note:** **Remove** outdated assumption that **`WEB_NAME.DAT`** is the
  primary artifact; treat CSV + layout TXT as normative.

### 22.F Annual Cash Report

- **Page:** https://comptroller.texas.gov/transparency/reports/cash-report/
- **FY2025 pattern (representative):** “Download all data files” ZIP; “Revenues,
  Expenditures and Cash Balances of State Funds, pages 8–114” XLSX; multiple
  Treasury Fund Detail XLSX files.
- **Scope:** cash-basis state treasury reporting (per Comptroller).
- **Artifact patterns:** `annual_cash_report_fy{YYYY}_all_data.zip`,
  `annual_cash_report_fy{YYYY}_rev_exp_cash_balances.xlsx`
- **Preference:** annual ZIP first, individual XLSX second.

### 22.G County geometry

| Role                       | Source                                                                                   |
| -------------------------- | ---------------------------------------------------------------------------------------- |
| **Recommended production** | U.S. Census **cartographic boundary** counties (GEOID / 5-digit FIPS)                    |
| **Backup / reference**     | Texas ODP **TX Counties** `vazh-2ajc`; Texas Counties Cartographic Boundary Map (portal) |
| **Join key**               | **5-digit county FIPS**                                                                  |

### 22.H Remaining hard blockers

These three items remain **file-level** discovery work:

1. **Actual Payments to Payee export schema** (columns, format, export path).
2. **Full year-by-year county dataset inventory** (missing FY years’ dataset
   IDs).
3. **Cash report workbook sheet names and header rows** per fiscal year.

Record discoveries in repo config (e.g. `datasets.json`) and extend
[§32](#32-column-mapping-skeletons) with concrete column maps when known.

---

## 23. source_row_hash specification

Normative **product rule** for deduplication of payment rows.

| Rule                     | Value                           |
| ------------------------ | ------------------------------- |
| Algorithm                | **SHA-256**                     |
| Encoding                 | **UTF-8**                       |
| Delimiter between fields | ASCII **Unit Separator** `\x1F` |
| Null / missing token     | `\N`                            |

**Field order (concatenate in this order only):**

1. `payment_date_iso`
2. `agency_name_normalized`
3. `payee_name_normalized_or_CONFIDENTIAL`
4. `amount_normalized`
5. `object_category_raw_normalized`
6. `comptroller_object_code_normalized`
7. `appropriated_fund_raw_normalized`
8. `appropriation_number_normalized`
9. `appropriation_year_normalized`

**Normalization before hashing**

- Trim; uppercase; collapse internal whitespace to single spaces; `&` → `AND`;
  remove punctuation **except** letters, digits, and spaces.
- Empty string after normalization → `\N`.
- Date → `YYYY-MM-DD`.
- Amount → **signed** fixed decimal with **two** places (e.g. `123.45`,
  `-123.45`).

**Negative amounts**

- **Allowed** in `state_payment_facts.amount`; store as-is.
- Hash uses the **signed** value; **no** `abs()` or sign stripping.

`source_row_hash` = hex-encoded SHA-256 of the delimited string above.

---

## 24. include_confidential semantics

**Default:** `include_confidential=false`.

### When `include_confidential=false`

- Confidential rows are **excluded** from **all** sums, counts, rankings, and
  lists.
- `payment_count` excludes confidential rows.
- `distinct_payee_count` excludes confidential payees.
- `top_payee` uses **non-confidential** rows only.
- **Transaction list** omits confidential rows entirely.

### When `include_confidential=true`

- Confidential rows are **included** in sums and payment counts.
- Payee label is literal **`CONFIDENTIAL`**.
- **`payee_id` is `null`** for confidential rows in list/detail API responses.
- Confidential rows are **never** vendor-matched.
- **`distinct_payee_count`:** count **all** confidential rows as **one**
  synthetic bucket labeled `CONFIDENTIAL` (not N hidden entities).
- **`top_payee` may return:**  
  `{ "payee_id": null, "payee_name": "CONFIDENTIAL", "is_confidential": true, "amount": … }`

**Methodology:** `/methodology` must state that public confidentiality can mask
true payee diversity and rankings.

---

## 25. Runtime topology, environments, and secrets

### 25.1 Runtime topology (locked)

Use a **single Nuxt 4** app with **SSR** pages and **server routes** under
`/api/v1`, deployed to **Cloudflare Workers**. **PostgreSQL** is the system of
record. The deployed app reaches PostgreSQL through a **Cloudflare Hyperdrive
binding** (default binding name: `HYPERDRIVE`) and `useAppDatabase(event)` in
`apps/web/server/utils/database.ts`. This app does **not** use D1.

**ETL** runs as a **separate Node/TypeScript worker** on a schedule, not inside
HTTP request handlers. **Playwright** and heavy download jobs run **only** in
the ETL worker. ETL and migrations may connect directly to PostgreSQL using
`DATABASE_URL`. App/API reads should be read-only at the database role level
even when tunneled through Hyperdrive. Raw download artifacts land in object
storage or a mounted `ETL_ARTIFACT_DIR` before staging load.

### 25.2 Environment variables (names locked)

| Variable                                      | Use                                                               |
| --------------------------------------------- | ----------------------------------------------------------------- |
| `NUXT_DATABASE_BACKEND=postgres`              | Force Postgres path in the shared layer                           |
| `NUXT_HYPERDRIVE_BINDING`                     | Hyperdrive binding name if not `HYPERDRIVE`                       |
| `DATABASE_URL`                                | Direct PostgreSQL connection for ETL, local tools, and migrations |
| `PLAYWRIGHT_DOWNLOAD_DIR`                     | Browser export downloads                                          |
| `ETL_ARTIFACT_DIR`                            | Local artifact root                                               |
| `ETL_RETENTION_DAYS`                          | Housekeeping hint                                                 |
| `R2_BUCKET` or `S3_BUCKET`                    | Optional object storage for raw ETL artifacts                     |
| `S3_REGION`                                   | If S3 is used                                                     |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | S3 credentials, or equivalent R2 credentials if required          |
| `SITE_URL`                                    | Canonical public site URL used by `site.url` and image config     |
| `APP_NAME`                                    | Public product name used by `site.name` and runtime UI config     |

**Secrets policy:** Doppler is the source of truth. Do not add `.env` files to
this repo.

### 25.3 Retention

- Raw CSV / XLSX / ZIP artifacts: **90 days**.
- Failed-run artifacts: **180 days**.
- Checksums in **`ingestion_runs.artifact_checksum_sha256`**: retain
  indefinitely (DB).

---

## 26. ETL operational contract, migrations, and seed

### 26.1 `ingestion_runs`

All production loads **must** insert/update rows in `ingestion_runs`
([§4 DDL](#43-ddl)) with status transitions `running` → `succeeded` | `failed` |
`partial`.

### 26.2 Migrations (locked)

- **Migrations:** versioned **raw SQL** files in repo.
- **Runner:** simple Node script or `dbmate` / `psql`-style runner — **no ORM
  required**.

### 26.3 Seed data (locked)

- **`fiscal_years`:** static SQL seed for **FY2010 through current FY + 1**
  (adjust annually).
- **Taxonomy snapshots:** check into `data-seed/taxonomy/` from `gern-2bvs` and
  `d57d-zxw6` CSV pulls.
- **Manual crosswalks (versioned CSV in repo):**
  - `agency_name_crosswalk.csv` → `agency_name_crosswalk`
  - `object_category_map_manual.csv` → `comptroller_object_category_map` (where
    used)

---

## 27. Performance strategy

### 27.1 Pre-aggregation

Maintain **materialized views** or equivalent rollup tables (refresh after ETL):

- `mv_overview_by_fy`
- `mv_agency_rollup_by_fy`
- `mv_payee_rollup_by_fy`
- `mv_county_rollup_by_fy`
- `mv_category_rollup_by_fy`
- `mv_object_rollup_by_fy`

### 27.2 Live compute

Acceptable for **low-cardinality** filtered lists, **transaction** list/detail,
and **search** autocomplete (with limits).

### 27.3 Indexes

Beyond [§4.3](#43-ddl), add **GIN trigram** indexes on normalized names if
search is in-DB ([§4.4](#44-notes-on-the-ddl)).

### 27.4 Latency targets (warm, p95)

| Surface                    | Target   |
| -------------------------- | -------- |
| List endpoints             | < 300 ms |
| Detail endpoints           | < 400 ms |
| `/transactions` first page | < 600 ms |

---

## 28. Attribution and automation terms

### 28.1 Minimum attribution (footer / source box)

> Source data: Texas Comptroller of Public Accounts Transparency data and Texas
> Open Data Portal datasets. County map geometry from U.S. Census cartographic
> boundary files where used. This site republishes and analyzes public data and
> is not an official Texas Comptroller product.

### 28.2 Automation note

> Download automation is limited to public pages, dashboard exports, and
> open-data endpoints. Final production use should remain subject to legal
> review of source terms and operational load.

---

## 29. Static page outlines

### 29.1 `/methodology` — required headings

- What this product covers
- What it does not cover
- Payments data methodology
- County expenditure methodology
- Confidential transactions
- Vendor matching methodology
- Why totals may differ across pages
- Fiscal year definition
- Update cadence

### 29.2 `/data-sources` — required headings

- Texas Comptroller State Revenue and Expenditure Dashboard
- Payments to Payee source
- Expenditures by County datasets
- Comptroller object codes
- Expenditure category codes
- Vendor master downloads
- Annual Cash Report
- County geometry

### 29.3 `/about` — required headings

- What Texas State Spending Explorer is
- Why state and county views are separate
- Data freshness
- Limitations
- Contact / feedback

---

## 30. Testing matrix

### 30.1 Parser golden files (repo fixtures)

- `payments_sample_public.csv`
- `payments_sample_confidential.csv`
- `county_expenditures_sample.csv`
- `vendor_master_sample.csv`
- `cash_report_sample.xlsx`

### 30.2 API contract tests

- `GET /transactions?county_id=…` → `UNSUPPORTED_COMBINATION`.
- `include_confidential=false` excludes confidential rows from totals and lists.
- `include_confidential=true` includes confidential amounts; `payee_id` null;
  payee name `CONFIDENTIAL` where applicable; `distinct_payee_count` treats
  confidential as one bucket.
- Agency counties endpoint reads **only** county fact source.
- No transaction JSON includes county/city fields.

### 30.3 E2E flows

- Overview → agencies list → agency detail.
- Overview → counties map/table → county detail.
- Search → payee detail.
- Transactions: filter, sort, pagination.
- Confidentiality toggle behavior matches
  [§24](#24-include_confidential-semantics).

---

## 31. Analytics and privacy

**v1 lock**

- **No** third-party analytics.
- **No** non-essential cookies → **no** cookie banner required in v1 if none are
  set.
- **Server logs** for operations only.
- Short **privacy note** on `/about`.

---

## 32. Column mapping skeletons

Full **source → staging → core** maps for **payments** and **cash report**
remain **blocked** until real export files are inspected
([§22.H](#22h-remaining-hard-blockers)). For sources already pinned:

### 32.1 Comptroller object codes (`gern-2bvs`)

| Source       | Staging                                       | Core                               |
| ------------ | --------------------------------------------- | ---------------------------------- |
| Object code  | `stg_comptroller_objects_raw.object_code_raw` | `comptroller_objects.code`         |
| Title        | `title_raw`                                   | `comptroller_objects.title`        |
| Object group | `object_group_raw`                            | `comptroller_objects.object_group` |

### 32.2 Expenditure categories (`d57d-zxw6`)

| Source        | Staging                                            | Core                           |
| ------------- | -------------------------------------------------- | ------------------------------ |
| Category code | `stg_expenditure_categories_raw.category_code_raw` | `expenditure_categories.code`  |
| Title         | `title_raw`                                        | `expenditure_categories.title` |

### 32.3 County expenditures (per-year Socrata resource)

| Source           | Staging                | Core                                                                                  |
| ---------------- | ---------------------- | ------------------------------------------------------------------------------------- |
| Fiscal year      | `fiscal_year_raw`      | `county_expenditure_facts.fiscal_year`                                                |
| County name      | `county_name_raw`      | `geographies_counties` then `county_id`                                               |
| Agency name      | `agency_name_raw`      | `agency_name_raw` + `agency_id` via [§6.7](#67-county--agency-alignment-county-facts) |
| Expenditure type | `expenditure_type_raw` | `expenditure_type_raw`                                                                |
| Amount           | `amount_raw`           | `amount`                                                                              |

### 32.4 Vendor master (CSV + layout TXT)

| Source                      | Staging           | Core                                            |
| --------------------------- | ----------------- | ----------------------------------------------- |
| Vendor name                 | `vendor_name_raw` | `vendor_enrichment.vendor_name_raw`             |
| Normalized name             | derived           | `vendor_enrichment.vendor_name_normalized`      |
| WEB_VID                     | `web_vid_raw`     | `vendor_enrichment.web_vid`                     |
| Vendor number               | `vendor_no_raw`   | `vendor_enrichment.cmbl_vendor_no`              |
| City / county / state / zip | `*_raw`           | same columns                                    |
| Email / phone               | `*_raw`           | same                                            |
| HUB / SB / SDV              | `*_raw`           | `hub_status`, `small_business_flag`, `sdv_flag` |

### 32.5 Payments & cash report

- **Blocked** until export inspection — extend this table with exact header
  names in the same format.

---

**End of SPEC.md (v1)**
