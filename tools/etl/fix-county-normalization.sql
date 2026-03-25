BEGIN;

UPDATE geographies_counties
SET
  county_name = 'IN TEXAS',
  county_name_normalized = 'IN TEXAS'
WHERE county_name_normalized = 'INTEX';

WITH canonical AS (
  SELECT id
  FROM geographies_counties
  WHERE county_name_normalized = 'LA SALLE'
  LIMIT 1
),
duplicate AS (
  SELECT id
  FROM geographies_counties
  WHERE county_name_normalized = 'LASALLE'
  LIMIT 1
)
UPDATE county_expenditure_facts
SET county_id = canonical.id
FROM canonical, duplicate
WHERE county_expenditure_facts.county_id = duplicate.id;

DELETE FROM geographies_counties
WHERE county_name_normalized = 'LASALLE';

WITH canonical AS (
  SELECT id
  FROM geographies_counties
  WHERE county_name_normalized = 'RAINS'
  LIMIT 1
),
duplicate AS (
  SELECT id
  FROM geographies_counties
  WHERE county_name_normalized = 'RAINES'
  LIMIT 1
)
UPDATE county_expenditure_facts
SET county_id = canonical.id
FROM canonical, duplicate
WHERE county_expenditure_facts.county_id = duplicate.id;

DELETE FROM geographies_counties
WHERE county_name_normalized = 'RAINES';

COMMIT;
