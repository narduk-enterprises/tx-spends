-- tools/etl/travel-ingest.sql
-- 1. Ensure required extensions exist
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Extract and Upsert new Agencies from travel staging
INSERT INTO agencies (agency_name, agency_name_normalized)
SELECT DISTINCT 
    agency_name, 
    trim(regexp_replace(upper(replace(agency_name, '&', 'AND')), '\s+', ' ', 'g'))
FROM stg_travel_payment_raw
WHERE agency_name IS NOT NULL
ON CONFLICT (agency_name_normalized) DO NOTHING;

-- 3. Extract and Upsert new Payees from travel staging
INSERT INTO payees (payee_name_raw, payee_name_normalized, is_confidential)
SELECT DISTINCT 
    payee_name, 
    trim(regexp_replace(
        upper(
            regexp_replace(
                replace(payee_name, '&', 'AND'),
                '(?i)\b(INC|LLC|LTD|CO|CORP|CORPORATION|LP|LLP)\b[\.?]?',
                '',
                'g'
            )
        ), 
        '[^A-Z0-9 ]', '', 'g'
    )),
    CASE WHEN upper(payee_name) = 'CONFIDENTIAL' THEN true ELSE false END
FROM stg_travel_payment_raw
WHERE payee_name IS NOT NULL
ON CONFLICT (payee_name_normalized, is_confidential) DO NOTHING;

-- 4. Ingest Facts with source_row_hash deduplication (SHA-256)
INSERT INTO travel_payment_facts (
    source_row_hash,
    payment_date,
    fiscal_year,
    agency_id,
    payee_id,
    payee_name_raw,
    amount,
    travel_expense_type_raw,
    source_loaded_at
)
SELECT 
    -- source_row_hash: SHA-256
    encode(digest(
        COALESCE(s.payment_date, '') || '|' ||
        COALESCE(s.agency_name, '') || '|' ||
        COALESCE(s.payee_name, '') || '|' ||
        COALESCE(s.amount::text, '') || '|' ||
        COALESCE(s.travel_expense_type, ''), 'sha256'
    ), 'hex') as source_row_hash,
    s.payment_date::date,
    s.fiscal_year,
    a.id as agency_id,
    p.id as payee_id,
    s.payee_name,
    s.amount,
    s.travel_expense_type,
    now()
FROM stg_travel_payment_raw s
LEFT JOIN agencies a 
    ON a.agency_name_normalized = trim(regexp_replace(upper(replace(s.agency_name, '&', 'AND')), '\s+', ' ', 'g'))
LEFT JOIN payees p 
    ON p.payee_name_normalized = trim(regexp_replace(upper(regexp_replace(replace(s.payee_name, '&', 'AND'), '(?i)\b(INC|LLC|LTD|CO|CORP|CORPORATION|LP|LLP)\b[\.?]?', '', 'g')), '[^A-Z0-9 ]', '', 'g')) 
       AND p.is_confidential = (CASE WHEN upper(s.payee_name) = 'CONFIDENTIAL' THEN true ELSE false END)
WHERE a.id IS NOT NULL AND s.payment_date IS NOT NULL
ON CONFLICT (source_row_hash) DO NOTHING;
