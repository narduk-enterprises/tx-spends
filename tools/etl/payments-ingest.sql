-- tools/etl/payments-ingest.sql
-- 1. Ensure required extensions exist
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Extract and Upsert new Agencies from payments staging
INSERT INTO agencies (agency_name, agency_name_normalized)
SELECT DISTINCT 
    agency_name, 
    trim(regexp_replace(upper(replace(agency_name, '&', 'AND')), '\s+', ' ', 'g'))
FROM stg_payments_to_payee_raw
WHERE agency_name IS NOT NULL
ON CONFLICT (agency_name_normalized) DO NOTHING;

-- 3. Extract and Upsert new Payees from payments staging
-- The normalization strips common corporate suffixes and punctuations to maximize matching
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
    CASE WHEN is_confidential = 1 THEN true ELSE false END
FROM stg_payments_to_payee_raw
WHERE payee_name IS NOT NULL
ON CONFLICT (payee_name_normalized, is_confidential) DO NOTHING;

-- 4. Seed missing comptroller object dimension rows directly from the payment feed
INSERT INTO comptroller_objects (code, title, object_group)
SELECT DISTINCT
    left(s.comptroller_object, 4) AS code,
    nullif(trim(regexp_replace(s.comptroller_object, '^[0-9]{4}\s*-\s*', '')), '') AS title,
    NULL AS object_group
FROM stg_payments_to_payee_raw s
WHERE s.comptroller_object IS NOT NULL
  AND left(s.comptroller_object, 4) ~ '^[0-9]{4}$'
ON CONFLICT (code) DO UPDATE
SET
    title = COALESCE(comptroller_objects.title, EXCLUDED.title),
    updated_at = now();

-- 5. Ingest Facts with source_row_hash deduplication (SHA-256)
INSERT INTO state_payment_facts (
    source_row_hash,
    payment_date,
    fiscal_year,
    agency_id,
    payee_id,
    payee_name_raw,
    amount,
    object_category_raw,
    comptroller_object_code,
    appropriated_fund_raw,
    appropriation_number,
    appropriation_year,
    is_confidential,
    source_loaded_at
)
SELECT 
    -- source_row_hash: SHA-256
    encode(digest(
        COALESCE(s.payment_date, '') || '|' ||
        COALESCE(s.agency_name, '') || '|' ||
        COALESCE(s.payee_name, '') || '|' ||
        COALESCE(s.amount::text, '') || '|' ||
        COALESCE(s.object_category, '') || '|' ||
        COALESCE(left(s.comptroller_object, 4), '') || '|' ||
        COALESCE(s.fund, ''), 'sha256'
    ), 'hex') as source_row_hash,
    s.payment_date::date,
    s.fiscal_year,
    a.id as agency_id,
    p.id as payee_id,
    s.payee_name,
    s.amount,
    s.object_category,
    left(s.comptroller_object, 4) as comptroller_object_code,
    s.fund,
    s.appropriation_number,
    s.appropriation_year,
    CASE WHEN s.is_confidential = 1 THEN true ELSE false END,
    now()
FROM stg_payments_to_payee_raw s
LEFT JOIN agencies a 
    ON a.agency_name_normalized = trim(regexp_replace(upper(replace(s.agency_name, '&', 'AND')), '\s+', ' ', 'g'))
LEFT JOIN payees p 
    ON p.payee_name_normalized = trim(regexp_replace(upper(regexp_replace(replace(s.payee_name, '&', 'AND'), '(?i)\b(INC|LLC|LTD|CO|CORP|CORPORATION|LP|LLP)\b[\.?]?', '', 'g')), '[^A-Z0-9 ]', '', 'g')) 
       AND p.is_confidential = (CASE WHEN s.is_confidential = 1 THEN true ELSE false END)
ON CONFLICT (source_row_hash) DO NOTHING;
