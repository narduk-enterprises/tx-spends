-- tools/etl/commodity-ingest.sql

-- 1. Ingest NIGP Commodity Codes
INSERT INTO nigp_commodity_codes (code, title)
SELECT DISTINCT
    class_item_code,
    commodity_title
FROM stg_nigp_commodity_codes_raw
WHERE class_item_code IS NOT NULL
ON CONFLICT (code) DO UPDATE
SET title = EXCLUDED.title;

-- 2. Map Vendors to Commodities
INSERT INTO vendor_commodity_class_map (id, vendor_enrichment_id, cmbl_vendor_no, commodity_code, source_snapshot_date)
SELECT
    gen_random_uuid(),
    ve.id,
    s.cmbl_vendor_no,
    s.class_item_code,
    s.source_snapshot_date::date
FROM stg_vendor_commodity_class_raw s
INNER JOIN vendor_enrichment ve ON ve.cmbl_vendor_no = s.cmbl_vendor_no
INNER JOIN nigp_commodity_codes ncc ON ncc.code = s.class_item_code
WHERE s.cmbl_vendor_no IS NOT NULL AND s.class_item_code IS NOT NULL
ON CONFLICT DO NOTHING;
