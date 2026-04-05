-- Initialize tables for Mixed Beverage Sales ingestion
CREATE TABLE IF NOT EXISTS stg_beverage_sales_raw (
    taxpayer_number TEXT,
    taxpayer_name TEXT,
    taxpayer_address TEXT,
    taxpayer_city TEXT,
    taxpayer_state TEXT,
    taxpayer_zip TEXT,
    taxpayer_county TEXT,
    location_number TEXT,
    location_name TEXT,
    location_address TEXT,
    location_city TEXT,
    location_state TEXT,
    location_zip TEXT,
    location_county TEXT,
    inside_outside_city_limits TEXT,
    tabc_permit_number TEXT,
    responsibility_begin_date TEXT,
    responsibility_end_date TEXT,
    obligation_end_date TEXT,
    total_sales_receipts TEXT,
    total_taxable_receipts TEXT
);

CREATE TABLE IF NOT EXISTS beverage_sales_facts (
    id SERIAL PRIMARY KEY,
    source_row_hash TEXT NOT NULL UNIQUE,
    payee_id UUID REFERENCES payees(id),
    location_name_raw TEXT,
    location_city TEXT,
    taxpayer_name_raw TEXT,
    tabc_permit_number TEXT,
    total_sales_receipts NUMERIC(15, 2),
    total_taxable_receipts NUMERIC(15, 2),
    obligation_end_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bsf_payee_id ON beverage_sales_facts (payee_id);
