BEGIN;

INSERT INTO dir_sales_facts (
    source_row_hash,
    fiscal_year,
    customer_name_raw,
    agency_id,
    vendor_name_raw,
    purchase_amount,
    contract_number,
    rfo_description,
    order_quantity,
    unit_price,
    invoice_number,
    po_number,
    shipped_date,
    contract_type,
    contract_subtype,
    staffing_contractor_name,
    staffing_title,
    staffing_start_date,
    source_loaded_at
)
SELECT 
    md5(COALESCE(sales_fact_number, '') || COALESCE(po_number, '') || COALESCE(invoice_number, '') || COALESCE(purchase_amount::text, '')),
    fiscal_year,
    customer_name,
    NULL,
    vendor_name,
    purchase_amount,
    contract_number,
    rfo_description,
    order_quantity,
    unit_price,
    invoice_number,
    po_number,
    (CASE WHEN shipped_date ~ '^\\d{4}-\\d{2}-\\d{2}' THEN substring(shipped_date from 1 for 10)::date ELSE NULL END),
    contract_type,
    contract_subtype,
    staffing_contractor_name,
    staffing_title,
    (CASE WHEN staffing_start_date ~ '^\\d{4}-\\d{2}-\\d{2}' THEN substring(staffing_start_date from 1 for 10)::date ELSE NULL END),
    NOW()
FROM stg_dir_sales_raw
WHERE sales_fact_number IS NOT NULL
ON CONFLICT (source_row_hash) DO NOTHING;

-- Map to agencies table via fuzzy matching
UPDATE dir_sales_facts dsf
SET agency_id = a.id
FROM agencies a
WHERE dsf.agency_id IS NULL 
  AND a.title ILIKE '%' || dsf.customer_name_raw || '%';

COMMIT;
