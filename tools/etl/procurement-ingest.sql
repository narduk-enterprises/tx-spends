-- tools/etl/procurement-ingest.sql

-- 1. Extract and Upsert Agencies from Solicitations
INSERT INTO agencies (agency_name, agency_name_normalized)
SELECT DISTINCT 
    agency_name_raw, 
    trim(regexp_replace(upper(replace(agency_name_raw, '&', 'AND')), '\s+', ' ', 'g'))
FROM stg_esbd_solicitations_raw
WHERE agency_name_raw IS NOT NULL
ON CONFLICT (agency_name_normalized) DO NOTHING;

-- 2. Extract and Upsert Agencies from LBB Contracts
INSERT INTO agencies (agency_name, agency_name_normalized)
SELECT DISTINCT 
    agency_name_raw, 
    trim(regexp_replace(upper(replace(agency_name_raw, '&', 'AND')), '\s+', ' ', 'g'))
FROM stg_lbb_contract_awards_raw
WHERE agency_name_raw IS NOT NULL
ON CONFLICT (agency_name_normalized) DO NOTHING;

-- 3. Ingest ESBD Solicitations
INSERT INTO esbd_solicitations (solicitation_id, agency_id, title, nigp_codes, posted_date, status, document_urls, source_loaded_at)
SELECT
    s.solicitation_id,
    a.id as agency_id,
    s.title,
    string_to_array(s.nigp_codes, ','),
    s.posted_date::date,
    s.status,
    string_to_array(s.document_urls, ','),
    now()
FROM stg_esbd_solicitations_raw s
LEFT JOIN agencies a 
    ON a.agency_name_normalized = trim(regexp_replace(upper(replace(s.agency_name_raw, '&', 'AND')), '\s+', ' ', 'g'))
WHERE s.solicitation_id IS NOT NULL
ON CONFLICT (solicitation_id) DO UPDATE 
SET status = EXCLUDED.status, document_urls = EXCLUDED.document_urls;

-- 4. Ingest LBB Contract Awards
INSERT INTO lbb_contract_awards (contract_id, agency_id, vendor_name_raw, award_date, total_value, subject, document_urls, source_loaded_at)
SELECT
    s.contract_id,
    a.id as agency_id,
    s.vendor_name_raw,
    s.award_date::date,
    s.total_value,
    s.subject,
    string_to_array(s.document_urls, ','),
    now()
FROM stg_lbb_contract_awards_raw s
LEFT JOIN agencies a 
    ON a.agency_name_normalized = trim(regexp_replace(upper(replace(s.agency_name_raw, '&', 'AND')), '\s+', ' ', 'g'))
WHERE s.contract_id IS NOT NULL
ON CONFLICT (contract_id) DO UPDATE
SET total_value = EXCLUDED.total_value, document_urls = EXCLUDED.document_urls;
