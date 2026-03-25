-- tools/etl/vendor-matching.sql

-- 1. Exact matches (auto-accept, confidence 1.0)
INSERT INTO payee_vendor_matches (payee_id, vendor_enrichment_id, match_method, match_confidence, review_status)
SELECT 
    p.id as payee_id, 
    v.id as vendor_enrichment_id, 
    'exact_normalized', 
    1.0, 
    'auto-accepted'
FROM payees p
JOIN vendor_enrichment v ON p.payee_name_normalized = v.vendor_name_normalized
WHERE p.is_confidential = false
ON CONFLICT (payee_id) DO NOTHING;

-- 2. Trigram matches >= 0.92 (tentative)
INSERT INTO payee_vendor_matches (payee_id, vendor_enrichment_id, match_method, match_confidence, review_status)
SELECT DISTINCT ON (p.id)
    p.id as payee_id, 
    v.id as vendor_enrichment_id, 
    'trigram_similarity', 
    similarity(p.payee_name_normalized, v.vendor_name_normalized), 
    'tentative'
FROM payees p
JOIN vendor_enrichment v ON p.payee_name_normalized % v.vendor_name_normalized
LEFT JOIN payee_vendor_matches m ON m.payee_id = p.id
WHERE p.is_confidential = false 
  AND m.id IS NULL
  AND similarity(p.payee_name_normalized, v.vendor_name_normalized) >= 0.92
ORDER BY p.id, similarity(p.payee_name_normalized, v.vendor_name_normalized) DESC
ON CONFLICT (payee_id) DO NOTHING;
