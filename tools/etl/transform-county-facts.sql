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
    SUM(s.amount) as amount,
    now()
FROM stg_expenditures_by_county_raw s
JOIN geographies_counties c 
    ON c.county_name_normalized = CASE
        WHEN replace(trim(regexp_replace(upper(replace(s.county, ' COUNTY', '')), '\s+', ' ', 'g')), ' ', '') = 'INTEX' THEN 'IN TEXAS'
        WHEN replace(trim(regexp_replace(upper(replace(s.county, ' COUNTY', '')), '\s+', ' ', 'g')), ' ', '') = 'LASALLE' THEN 'LA SALLE'
        WHEN replace(trim(regexp_replace(upper(replace(s.county, ' COUNTY', '')), '\s+', ' ', 'g')), ' ', '') = 'RAINES' THEN 'RAINS'
        ELSE trim(regexp_replace(upper(replace(s.county, ' COUNTY', '')), '\s+', ' ', 'g'))
    END
LEFT JOIN agencies a 
    ON a.agency_name_normalized = trim(regexp_replace(upper(replace(s.agency_name, '&', 'AND')), '\s+', ' ', 'g'))
WHERE s.amount IS NOT NULL
GROUP BY
    s.fiscal_year, c.id, a.id, s.agency_name, s.major_spending_category
ON CONFLICT DO NOTHING;

DROP TABLE stg_expenditures_by_county_raw CASCADE;
