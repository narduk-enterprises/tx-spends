-- tools/etl/governance-ingest.sql

-- 1. Ingest Vendor Debarments
INSERT INTO vendor_debarments (id, vendor_id_raw, vendor_name_raw, address_raw, debarment_date, duration_months, source_loaded_at)
SELECT
    gen_random_uuid(),
    vendor_id_raw,
    vendor_name_raw,
    address_raw,
    debarment_date::date,
    duration_months,
    now()
FROM stg_vendor_debarment_raw
WHERE vendor_id_raw IS NOT NULL
ON CONFLICT DO NOTHING;

-- 2. Ingest Vendor Performance Reports (VPTS)
INSERT INTO vendor_performance_reports (id, vendor_id_raw, grade, reporting_agency_raw, report_date, source_loaded_at)
SELECT
    gen_random_uuid(),
    vendor_id_raw,
    grade,
    reporting_agency_raw,
    report_date::date,
    now()
FROM stg_vendor_performance_raw
WHERE vendor_id_raw IS NOT NULL
ON CONFLICT DO NOTHING;
