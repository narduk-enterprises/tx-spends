-- tools/etl/economic-ingest.sql
-- 1. Ensure required extensions exist
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Ingest Facts with source_row_hash deduplication (SHA-256)
INSERT INTO economic_development_facts (
    source_row_hash,
    recipient_name_raw,
    fund_raw,
    expenditure_category_raw,
    fiscal_year,
    amount,
    source_loaded_at
)
SELECT 
    -- source_row_hash: SHA-256
    encode(digest(
        COALESCE(s.recipient_name, '') || '|' ||
        COALESCE(s.fund, '') || '|' ||
        COALESCE(s.expenditure_category, '') || '|' ||
        COALESCE(s.fiscal_year::text, '') || '|' ||
        COALESCE(s.amount::text, ''), 'sha256'
    ), 'hex') as source_row_hash,
    s.recipient_name,
    s.fund,
    s.expenditure_category,
    s.fiscal_year,
    s.amount,
    now()
FROM stg_economic_development_raw s
ON CONFLICT (source_row_hash) DO NOTHING;
