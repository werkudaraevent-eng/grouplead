-- ============================================================
-- "Pengisi boleh menambah pilihan sendiri": a per-field switch on every
-- choice field, and a way for the admin to see what people typed off the
-- list so they can promote it. The visit report's two vocabularies keep
-- the behaviour they always had (on).
-- ============================================================

BEGIN;

ALTER TABLE sales_mission.form_fields
  ADD COLUMN IF NOT EXISTS allow_other boolean NOT NULL DEFAULT false;

UPDATE sales_mission.form_fields
SET allow_other = true
WHERE form_key = 'visit_report' AND is_core AND reporting_key IN ('client_needs', 'product_interest');

-- Values answered for a field that are not on its list, with how often.
-- The report's two core vocabularies live as text[] on the report; every
-- other choice answer is jsonb in a *_field_values table. SECURITY INVOKER:
-- row security on those tables decides what the caller may count.
CREATE OR REPLACE FUNCTION sales_mission.fn_off_list_answers(p_field_id uuid)
RETURNS TABLE (value text, uses bigint)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = sales_mission, public
AS $$
DECLARE
  f record;
BEGIN
  SELECT id, company_id, form_key, reporting_key, is_core, options INTO f
  FROM sales_mission.form_fields WHERE id = p_field_id;
  IF NOT FOUND THEN RETURN; END IF;

  IF f.form_key = 'visit_report' AND f.is_core AND f.reporting_key IN ('client_needs', 'product_interest') THEN
    RETURN QUERY
      SELECT v.item, count(*)::bigint
      FROM sales_mission.visit_reports r
      CROSS JOIN LATERAL unnest(CASE WHEN f.reporting_key = 'client_needs' THEN r.client_needs ELSE r.product_interest END) AS v(item)
      WHERE r.company_id = f.company_id
        AND btrim(v.item) <> ''
        AND NOT (f.options ? v.item)
      GROUP BY v.item ORDER BY count(*) DESC, v.item LIMIT 50;
    RETURN;
  END IF;

  RETURN QUERY
    WITH answers AS (
      SELECT x.value FROM sales_mission.mission_field_values x WHERE x.field_id = p_field_id
      UNION ALL
      SELECT x.value FROM sales_mission.report_field_values x WHERE x.field_id = p_field_id
      UNION ALL
      SELECT x.value FROM sales_mission.prospect_field_values x WHERE x.field_id = p_field_id
    ),
    flat AS (
      SELECT CASE WHEN jsonb_typeof(a.value) = 'array' THEN e.item ELSE a.value #>> '{}' END AS item
      FROM answers a
      LEFT JOIN LATERAL jsonb_array_elements_text(CASE WHEN jsonb_typeof(a.value) = 'array' THEN a.value ELSE '[]'::jsonb END) AS e(item) ON true
    )
    SELECT flat.item, count(*)::bigint
    FROM flat
    WHERE flat.item IS NOT NULL AND btrim(flat.item) <> '' AND NOT (f.options ? flat.item)
    GROUP BY flat.item ORDER BY count(*) DESC, flat.item LIMIT 50;
END;
$$;

GRANT EXECUTE ON FUNCTION sales_mission.fn_off_list_answers(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
