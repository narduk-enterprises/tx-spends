TRUNCATE TABLE
  payment_overview_rollups,
  payment_agency_rollups,
  payment_payee_rollups,
  payment_category_rollups,
  payment_object_rollups;

INSERT INTO payment_overview_rollups (
  scope_fiscal_year,
  total_spend_all,
  total_spend_public,
  payment_count_all,
  payment_count_public,
  agency_count_all,
  agency_count_public,
  payee_count_all,
  payee_count_public,
  created_at,
  updated_at
)
SELECT
  COALESCE(fiscal_year, 0) AS scope_fiscal_year,
  COALESCE(SUM(amount), 0)::numeric(18, 2) AS total_spend_all,
  COALESCE(SUM(amount) FILTER (WHERE is_confidential = false), 0)::numeric(18, 2) AS total_spend_public,
  COUNT(*)::integer AS payment_count_all,
  COUNT(*) FILTER (WHERE is_confidential = false)::integer AS payment_count_public,
  COUNT(DISTINCT agency_id)::integer AS agency_count_all,
  COUNT(DISTINCT agency_id) FILTER (WHERE is_confidential = false)::integer AS agency_count_public,
  COUNT(DISTINCT payee_id) FILTER (WHERE payee_id IS NOT NULL)::integer AS payee_count_all,
  COUNT(DISTINCT payee_id) FILTER (
    WHERE is_confidential = false
      AND payee_id IS NOT NULL
  )::integer AS payee_count_public,
  now(),
  now()
FROM state_payment_facts
GROUP BY GROUPING SETS ((fiscal_year), ());

INSERT INTO payment_agency_rollups (
  scope_fiscal_year,
  agency_id,
  total_spend_all,
  total_spend_public,
  payment_count_all,
  payment_count_public,
  distinct_payee_count_all,
  distinct_payee_count_public,
  created_at,
  updated_at
)
SELECT
  COALESCE(fiscal_year, 0) AS scope_fiscal_year,
  agency_id,
  COALESCE(SUM(amount), 0)::numeric(18, 2) AS total_spend_all,
  COALESCE(SUM(amount) FILTER (WHERE is_confidential = false), 0)::numeric(18, 2) AS total_spend_public,
  COUNT(*)::integer AS payment_count_all,
  COUNT(*) FILTER (WHERE is_confidential = false)::integer AS payment_count_public,
  COUNT(DISTINCT payee_id) FILTER (WHERE payee_id IS NOT NULL)::integer AS distinct_payee_count_all,
  COUNT(DISTINCT payee_id) FILTER (
    WHERE is_confidential = false
      AND payee_id IS NOT NULL
  )::integer AS distinct_payee_count_public,
  now(),
  now()
FROM state_payment_facts
GROUP BY GROUPING SETS ((fiscal_year, agency_id), (agency_id));

INSERT INTO payment_payee_rollups (
  scope_fiscal_year,
  payee_id,
  total_amount_all,
  total_amount_public,
  payment_count_all,
  payment_count_public,
  agency_count_all,
  agency_count_public,
  created_at,
  updated_at
)
SELECT
  COALESCE(fiscal_year, 0) AS scope_fiscal_year,
  payee_id,
  COALESCE(SUM(amount), 0)::numeric(18, 2) AS total_amount_all,
  COALESCE(SUM(amount) FILTER (WHERE is_confidential = false), 0)::numeric(18, 2) AS total_amount_public,
  COUNT(*)::integer AS payment_count_all,
  COUNT(*) FILTER (WHERE is_confidential = false)::integer AS payment_count_public,
  COUNT(DISTINCT agency_id)::integer AS agency_count_all,
  COUNT(DISTINCT agency_id) FILTER (WHERE is_confidential = false)::integer AS agency_count_public,
  now(),
  now()
FROM state_payment_facts
WHERE payee_id IS NOT NULL
GROUP BY GROUPING SETS ((fiscal_year, payee_id), (payee_id));

WITH normalized_categories AS (
  SELECT
    fiscal_year,
    agency_id,
    payee_id,
    amount,
    is_confidential,
    lower(
      regexp_replace(
        regexp_replace(COALESCE(object_category_raw, 'Uncategorized'), '[^A-Za-z0-9]+', '-', 'g'),
        '(^-|-$)',
        '',
        'g'
      )
    ) AS category_code,
    initcap(lower(COALESCE(object_category_raw, 'Uncategorized'))) AS category_title
  FROM state_payment_facts
)
INSERT INTO payment_category_rollups (
  scope_fiscal_year,
  category_code,
  category_title,
  total_amount_all,
  total_amount_public,
  payment_count_all,
  payment_count_public,
  agency_count_all,
  agency_count_public,
  payee_count_all,
  payee_count_public,
  created_at,
  updated_at
)
SELECT
  COALESCE(fiscal_year, 0) AS scope_fiscal_year,
  category_code,
  MAX(category_title) AS category_title,
  COALESCE(SUM(amount), 0)::numeric(18, 2) AS total_amount_all,
  COALESCE(SUM(amount) FILTER (WHERE is_confidential = false), 0)::numeric(18, 2) AS total_amount_public,
  COUNT(*)::integer AS payment_count_all,
  COUNT(*) FILTER (WHERE is_confidential = false)::integer AS payment_count_public,
  COUNT(DISTINCT agency_id)::integer AS agency_count_all,
  COUNT(DISTINCT agency_id) FILTER (WHERE is_confidential = false)::integer AS agency_count_public,
  COUNT(DISTINCT payee_id) FILTER (WHERE payee_id IS NOT NULL)::integer AS payee_count_all,
  COUNT(DISTINCT payee_id) FILTER (
    WHERE is_confidential = false
      AND payee_id IS NOT NULL
  )::integer AS payee_count_public,
  now(),
  now()
FROM normalized_categories
GROUP BY GROUPING SETS ((fiscal_year, category_code), (category_code));

INSERT INTO payment_object_rollups (
  scope_fiscal_year,
  object_code,
  object_title,
  object_group,
  total_amount_all,
  total_amount_public,
  payment_count_all,
  payment_count_public,
  created_at,
  updated_at
)
SELECT
  COALESCE(spf.fiscal_year, 0) AS scope_fiscal_year,
  spf.comptroller_object_code AS object_code,
  MAX(COALESCE(co.title, spf.comptroller_object_code)) AS object_title,
  MAX(co.object_group) AS object_group,
  COALESCE(SUM(spf.amount), 0)::numeric(18, 2) AS total_amount_all,
  COALESCE(SUM(spf.amount) FILTER (WHERE spf.is_confidential = false), 0)::numeric(18, 2) AS total_amount_public,
  COUNT(*)::integer AS payment_count_all,
  COUNT(*) FILTER (WHERE spf.is_confidential = false)::integer AS payment_count_public,
  now(),
  now()
FROM state_payment_facts spf
LEFT JOIN comptroller_objects co
  ON co.code = spf.comptroller_object_code
WHERE spf.comptroller_object_code IS NOT NULL
GROUP BY GROUPING SETS ((spf.fiscal_year, spf.comptroller_object_code), (spf.comptroller_object_code));

ANALYZE payment_overview_rollups;
ANALYZE payment_agency_rollups;
ANALYZE payment_payee_rollups;
ANALYZE payment_category_rollups;
ANALYZE payment_object_rollups;
