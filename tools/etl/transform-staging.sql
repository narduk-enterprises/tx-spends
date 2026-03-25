-- tools/etl/transform-staging.sql

-- 1. Fiscal Years
INSERT INTO fiscal_years (fiscal_year, start_date, end_date, label)
SELECT 
    fy, 
    make_date(fy - 1, 9, 1), 
    make_date(fy, 8, 31), 
    'FY ' || fy
FROM generate_series(2007, 2030) AS fy
ON CONFLICT (fiscal_year) DO NOTHING;

-- 2. Agencies (from expenditures_by_county)
INSERT INTO agencies (agency_code, agency_name, agency_name_normalized)
SELECT DISTINCT 
    agency_number, 
    agency_name, 
    trim(regexp_replace(upper(replace(agency_name, '&', 'AND')), '\s+', ' ', 'g')) AS agency_name_normalized
FROM stg_expenditures_by_county_raw
WHERE agency_name IS NOT NULL
ON CONFLICT (agency_name_normalized) DO NOTHING;

-- 3. Counties
INSERT INTO geographies_counties (county_name, county_name_normalized)
SELECT DISTINCT 
    county, 
    trim(regexp_replace(upper(replace(county, ' COUNTY', '')), '\s+', ' ', 'g')) AS county_name_normalized
FROM stg_expenditures_by_county_raw
WHERE county IS NOT NULL
ON CONFLICT (state_code, county_name_normalized) DO NOTHING;

-- 4. Comptroller Objects
INSERT INTO comptroller_objects (code, title, object_group)
SELECT DISTINCT 
    object_code, 
    title, 
    object_group
FROM stg_comptroller_objects_raw
WHERE object_code IS NOT NULL
ON CONFLICT (code) DO NOTHING;

-- 5. Expenditure Categories
INSERT INTO expenditure_categories (code, title)
SELECT DISTINCT 
    category_code, 
    category_title
FROM stg_expenditure_categories_raw
WHERE category_code IS NOT NULL
ON CONFLICT (code) DO NOTHING;

-- 6. Vendor Master (Enrichment)
INSERT INTO vendor_enrichment (
    vendor_name_raw, 
    vendor_name_normalized,
    cmbl_vendor_no,
    web_vid,
    hub_status,
    small_business_flag,
    city,
    county,
    state,
    zip,
    description
)
SELECT DISTINCT ON (COALESCE(web_vid, ''), COALESCE(web_vendor_no, ''))
    web_vendor_name,
    trim(regexp_replace(upper(replace(web_vendor_name, '&', 'AND')), '\s+', ' ', 'g')),
    web_vendor_no,
    web_vid,
    web_hub_status::text,
    CASE WHEN web_small_bus_flag = 1 THEN true ELSE false END,
    web_city,
    web_county,
    web_state,
    web_zip,
    web_desc
FROM stg_vendor_master_raw
WHERE web_vendor_name IS NOT NULL
ON CONFLICT DO NOTHING;

-- 7. County Expenditure Facts
INSERT INTO county_expenditure_facts (
    fiscal_year, 
    county_id, 
    agency_id, 
    agency_name_raw, 
    expenditure_type_raw, 
    amount, 
    source_loaded_at
)
SELECT 
    s.fiscal_year,
    c.id AS county_id,
    a.id AS agency_id,
    s.agency_name,
    s.major_spending_category,
    SUM(s.amount) as amount, -- group by the unique constraints to avoid conflict
    now()
FROM stg_expenditures_by_county_raw s
JOIN geographies_counties c 
    ON c.county_name_normalized = trim(regexp_replace(upper(replace(s.county, ' COUNTY', '')), '\s+', ' ', 'g'))
LEFT JOIN agencies a 
    ON a.agency_name_normalized = trim(regexp_replace(upper(replace(s.agency_name, '&', 'AND')), '\s+', ' ', 'g'))
WHERE s.amount IS NOT NULL
GROUP BY
    s.fiscal_year, c.id, a.id, s.agency_name, s.major_spending_category
ON CONFLICT DO NOTHING;

-- 8. Annual Cash Report Facts
INSERT INTO annual_cash_report_facts (
    fiscal_year, 
    fund_number, 
    fund_name, 
    expenditure_amount, 
    source_table_name, 
    source_loaded_at
)
SELECT 
    fiscal_year,
    fund_number,
    MAX(fund_name), -- using max for string aggregation if multiple names exist
    SUM(amount),
    sheet_name,
    now()
FROM stg_annual_cash_report_raw
WHERE fiscal_year IS NOT NULL AND fund_number IS NOT NULL AND sheet_name IS NOT NULL
GROUP BY fiscal_year, fund_number, sheet_name
ON CONFLICT DO NOTHING;
