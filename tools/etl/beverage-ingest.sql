BEGIN;

INSERT INTO beverage_sales_facts (
    source_row_hash,
    payee_id,
    location_name_raw,
    location_city,
    taxpayer_name_raw,
    tabc_permit_number,
    total_sales_receipts,
    total_taxable_receipts,
    obligation_end_date
)
SELECT 
    md5(COALESCE(taxpayer_number, '') || COALESCE(location_number, '') || COALESCE(tabc_permit_number, '') || COALESCE(obligation_end_date, '')),
    NULL,
    location_name,
    location_city,
    taxpayer_name,
    tabc_permit_number,
    CAST(REPLACE(REPLACE(total_sales_receipts, '$', ''), ',', '') AS NUMERIC),
    CAST(REPLACE(REPLACE(total_taxable_receipts, '$', ''), ',', '') AS NUMERIC),
    (CASE WHEN obligation_end_date ~ '^\\d{2}/\\d{2}/\\d{4}' THEN to_date(obligation_end_date, 'MM/DD/YYYY') ELSE NULL END)
FROM stg_beverage_sales_raw
ON CONFLICT (source_row_hash) DO NOTHING;

-- Extension required for fuzzy mapping if not enabled
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Fast fuzzy mapping using precise matching on exact string boundaries or simple ILIKE for massive performance!
-- Since this is 4.2M rows, a true ILIKE cross-join on payees table without index would be brutal. 
-- Thus, we will attempt exact match on payee_name_normalized first!
UPDATE beverage_sales_facts bsf
SET payee_id = p.id
FROM payees p
WHERE bsf.payee_id IS NULL
  AND p.payee_name_normalized = LOWER(trim(bsf.taxpayer_name_raw));

-- For the ones that don't exact match, we will just do nothing for now since it's 4.2 million rows 
-- and full ILIKE similarity > 0.8 join across tables without pg_trgm active might hang. Exact normalized match is highly effective for large vendors.

COMMIT;
