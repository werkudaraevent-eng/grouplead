-- ============================================================
-- Ringkasan as a cube: one measure counted over one period, bucketed by
-- one dimension and optionally split by a second. Every card on the
-- summary, built-in or composed by the reader, is one call of this.
--
-- SECURITY INVOKER: row security decides what is counted, exactly as it
-- decides what the list shows. Day boundaries are Asia/Jakarta. Each
-- measure is one branch of a UNION ALL guarded by its own
-- `p_measure = …`, so a call scans only the tables it needs.
-- ============================================================

BEGIN;

-- One row of facts → the key of the bucket it belongs to, for one dimension.
CREATE OR REPLACE FUNCTION sales_mission.fn_cube_bucket(
  p_dim text, p_day date, p_sales uuid, p_industry text, p_mission_type text,
  p_client text, p_interest_kind text, p_outcome_kind text,
  p_lead_category text, p_prospect_status_kind text
)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT CASE p_dim
    WHEN 'day'             THEN to_char(p_day, 'YYYY-MM-DD')
    -- date_trunc('week') is ISO: the week starts on Monday.
    WHEN 'week'            THEN to_char(date_trunc('week', p_day::timestamp)::date, 'YYYY-MM-DD')
    WHEN 'month'           THEN to_char(p_day, 'YYYY-MM')
    WHEN 'sales'           THEN COALESCE(p_sales::text, '')
    WHEN 'industry'        THEN COALESCE(NULLIF(btrim(p_industry), ''), '')
    WHEN 'mission_type'    THEN COALESCE(NULLIF(btrim(p_mission_type), ''), '')
    WHEN 'client'          THEN COALESCE(NULLIF(btrim(p_client), ''), '')
    WHEN 'interest'        THEN COALESCE(p_interest_kind, '')
    WHEN 'outcome'         THEN COALESCE(p_outcome_kind, '')
    WHEN 'lead_category'   THEN COALESCE(NULLIF(btrim(p_lead_category), ''), '')
    WHEN 'prospect_status' THEN COALESCE(p_prospect_status_kind, '')
    ELSE ''   -- 'none' and anything unknown: one bucket
  END
$$;

CREATE OR REPLACE FUNCTION sales_mission.fn_report_cube(
  p_company_id uuid,
  p_from date,
  p_to date,
  p_measure text,
  p_group text DEFAULT 'none',
  p_series text DEFAULT 'none',
  p_sales uuid[] DEFAULT NULL
)
RETURNS TABLE (bucket text, series text, value numeric)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = sales_mission, public
AS $$
  WITH bounds AS (
    -- The period as instants, so the indexed timestamptz columns are
    -- compared directly: WIB midnight of p_from up to WIB midnight after p_to.
    SELECT (p_from::timestamp)     AT TIME ZONE 'Asia/Jakarta' AS lo,
           ((p_to + 1)::timestamp) AT TIME ZONE 'Asia/Jakarta' AS hi
  ),
  facts AS (
    -- visits / opportunities / estimated_value: one row per sent report
    -- (drafts are work in progress). The visit day is the list's, so the
    -- two never disagree.
    SELECT
      (COALESCE(r.actual_start, r.submitted_at, m.scheduled_start) AT TIME ZONE 'Asia/Jakarta')::date AS day,
      a.user_id                        AS sales,
      m.industry                       AS industry,
      m.mission_type                   AS mission_type,
      m.client_company_name_snapshot   AS client,
      ci.kind                          AS interest_kind,
      co.kind                          AS outcome_kind,
      NULL::text                       AS lead_category,
      NULL::text                       AS prospect_status_kind,
      (CASE WHEN p_measure = 'estimated_value' THEN COALESCE(r.estimated_value, 0) ELSE 1 END)::numeric AS value
    FROM sales_mission.visit_reports r
    JOIN sales_mission.missions m ON m.id = r.mission_id AND m.deleted_at IS NULL
    LEFT JOIN sales_mission.assignments a ON a.mission_id = m.id AND a.assignment_role = 'PRIMARY'
    LEFT JOIN sales_mission.report_choices ci
      ON ci.company_id = r.company_id AND ci.field_key = 'interest_level' AND ci.code = r.interest_level
    LEFT JOIN sales_mission.report_choices co
      ON co.company_id = r.company_id AND co.field_key = 'visit_outcome' AND co.code = r.visit_outcome
    WHERE p_measure IN ('visits', 'opportunities', 'estimated_value')
      AND r.company_id = p_company_id
      AND r.status <> 'DRAFT'
      AND (p_measure = 'visits' OR r.opportunity_exists)

    UNION ALL
    -- appointments: a scheduled, not cancelled, not refused, not binned visit.
    SELECT
      (m.scheduled_start AT TIME ZONE 'Asia/Jakarta')::date,
      a.user_id, m.industry, m.mission_type, m.client_company_name_snapshot,
      NULL, NULL, NULL, NULL, 1::numeric
    FROM sales_mission.missions m
    CROSS JOIN bounds b
    LEFT JOIN sales_mission.assignments a ON a.mission_id = m.id AND a.assignment_role = 'PRIMARY'
    WHERE p_measure = 'appointments'
      AND m.company_id = p_company_id
      AND m.deleted_at IS NULL
      AND m.status NOT IN ('CANCELLED', 'REJECTED')
      AND m.scheduled_start >= b.lo AND m.scheduled_start < b.hi

    UNION ALL
    -- planning: prospects that came in during the period, per holder.
    SELECT
      (p.created_at AT TIME ZONE 'Asia/Jakarta')::date,
      p.owner_id, p.industry, NULL, p.client_company_name,
      NULL, NULL, NULL, s.kind, 1::numeric
    FROM sales_mission.prospects p
    CROSS JOIN bounds b
    JOIN sales_mission.prospect_statuses s ON s.id = p.status_id
    WHERE p_measure = 'planning'
      AND p.company_id = p_company_id
      AND p.deleted_at IS NULL
      AND p.created_at >= b.lo AND p.created_at < b.hi

    UNION ALL
    -- leads_pushed: joined to the mission so the mission's row security applies.
    SELECT
      (l.pushed_at AT TIME ZONE 'Asia/Jakarta')::date,
      l.pushed_by, m.industry, m.mission_type, m.client_company_name_snapshot,
      NULL, NULL, l.category, NULL, 1::numeric
    FROM sales_mission.lead_pushes l
    CROSS JOIN bounds b
    JOIN sales_mission.missions m ON m.id = l.mission_id AND m.deleted_at IS NULL
    WHERE p_measure = 'leads_pushed'
      AND l.company_id = p_company_id
      AND l.pushed_at >= b.lo AND l.pushed_at < b.hi
  ),
  scoped AS (
    SELECT f.*
    FROM facts f
    WHERE f.day >= p_from AND f.day <= p_to
      AND (p_sales IS NULL
           OR f.sales = ANY (p_sales)
           OR (f.sales IS NULL AND '00000000-0000-0000-0000-000000000000'::uuid = ANY (p_sales)))
  )
  SELECT
    sales_mission.fn_cube_bucket(p_group,  s.day, s.sales, s.industry, s.mission_type, s.client, s.interest_kind, s.outcome_kind, s.lead_category, s.prospect_status_kind) AS bucket,
    sales_mission.fn_cube_bucket(p_series, s.day, s.sales, s.industry, s.mission_type, s.client, s.interest_kind, s.outcome_kind, s.lead_category, s.prospect_status_kind) AS series,
    sum(s.value)::numeric AS value
  FROM scoped s
  GROUP BY 1, 2
  ORDER BY 1, 2
  LIMIT 5000;
$$;

REVOKE ALL ON FUNCTION sales_mission.fn_cube_bucket(text, date, uuid, text, text, text, text, text, text, text) FROM public;
REVOKE ALL ON FUNCTION sales_mission.fn_report_cube(uuid, date, date, text, text, text, uuid[]) FROM public;
GRANT EXECUTE ON FUNCTION sales_mission.fn_cube_bucket(text, date, uuid, text, text, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION sales_mission.fn_report_cube(uuid, date, date, text, text, text, uuid[]) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
