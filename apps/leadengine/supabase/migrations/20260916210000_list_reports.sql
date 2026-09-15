-- ============================================================
-- Daftar laporan: the visit-report list, paged and filtered in the database.
--
-- Same shape as fn_list_missions: SECURITY INVOKER so row security decides
-- what the caller may see; a NULL parameter means "no filter"; the total is
-- a window count repeated on every row. A report on a binned mission is
-- hidden with the mission and returns when the mission is restored.
-- ============================================================

BEGIN;

CREATE INDEX IF NOT EXISTS visit_reports_company_submitted_idx
  ON sales_mission.visit_reports (company_id, submitted_at DESC NULLS LAST, updated_at DESC);

CREATE OR REPLACE FUNCTION sales_mission.fn_list_reports(
  p_company_id uuid,
  p_q text DEFAULT NULL,
  p_status text[] DEFAULT NULL,
  p_outcome text[] DEFAULT NULL,
  p_interest text[] DEFAULT NULL,
  p_next_action text[] DEFAULT NULL,
  p_sales uuid[] DEFAULT NULL,
  p_opportunity boolean DEFAULT NULL,
  p_pushed boolean DEFAULT NULL,
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
  p_sort text DEFAULT 'submitted:desc',
  p_page integer DEFAULT 0,
  p_size integer DEFAULT 25
)
RETURNS TABLE (id uuid, total bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = sales_mission, public
AS $$
  WITH base AS (
    SELECT
      r.id, r.status, r.visit_outcome, r.interest_level, r.next_action_type,
      r.opportunity_exists, r.estimated_value, r.follow_up_date,
      r.actual_start, r.submitted_at, r.updated_at,
      m.client_company_name_snapshot, m.location,
      a.user_id AS primary_id,
      p.full_name AS primary_name,
      co.display_order AS outcome_order,
      ci.display_order AS interest_order,
      EXISTS (SELECT 1 FROM sales_mission.lead_pushes l WHERE l.mission_id = m.id) AS pushed,
      -- The day the visit belongs to, in mission time: the reported start
      -- when there is one, else the day it was sent (what the KPI counts),
      -- else, for a draft, the appointment.
      (COALESCE(r.actual_start, r.submitted_at, m.scheduled_start) AT TIME ZONE 'Asia/Jakarta')::date AS visit_day
    FROM sales_mission.visit_reports r
    JOIN sales_mission.missions m ON m.id = r.mission_id AND m.deleted_at IS NULL
    LEFT JOIN sales_mission.assignments a ON a.mission_id = m.id AND a.assignment_role = 'PRIMARY'
    LEFT JOIN public.profiles p ON p.id = a.user_id
    LEFT JOIN sales_mission.report_choices co
      ON co.company_id = r.company_id AND co.field_key = 'visit_outcome' AND co.code = r.visit_outcome
    LEFT JOIN sales_mission.report_choices ci
      ON ci.company_id = r.company_id AND ci.field_key = 'interest_level' AND ci.code = r.interest_level
    WHERE r.company_id = p_company_id
  ),
  filtered AS (
    SELECT b.* FROM base b
    WHERE (p_q IS NULL OR btrim(p_q) = ''
           OR b.client_company_name_snapshot ILIKE '%' || p_q || '%'
           OR b.location ILIKE '%' || p_q || '%'
           OR b.primary_name ILIKE '%' || p_q || '%')
      AND (p_status IS NULL OR b.status = ANY (p_status))
      AND (p_outcome IS NULL OR b.visit_outcome = ANY (p_outcome))
      AND (p_interest IS NULL OR b.interest_level = ANY (p_interest))
      AND (p_next_action IS NULL OR b.next_action_type = ANY (p_next_action))
      AND (p_sales IS NULL
           OR b.primary_id = ANY (p_sales)
           OR (b.primary_id IS NULL AND '00000000-0000-0000-0000-000000000000'::uuid = ANY (p_sales)))
      AND (p_opportunity IS NULL OR b.opportunity_exists = p_opportunity)
      AND (p_pushed IS NULL OR b.pushed = p_pushed)
      AND (p_from IS NULL OR b.visit_day >= p_from)
      AND (p_to IS NULL OR b.visit_day <= p_to)
  ),
  sorted AS (
    SELECT f.*, COALESCE(NULLIF(btrim(p_sort), ''), 'submitted:desc') AS sort_key FROM filtered f
  )
  SELECT f.id, count(*) OVER () AS total
  FROM sorted f
  ORDER BY
    CASE WHEN f.sort_key = 'submitted:asc'  THEN f.submitted_at END ASC NULLS LAST,
    CASE WHEN f.sort_key = 'submitted:asc'  THEN f.updated_at END ASC,
    CASE WHEN f.sort_key = 'submitted:desc' THEN f.submitted_at END DESC NULLS LAST,
    CASE WHEN f.sort_key = 'submitted:desc' THEN f.updated_at END DESC,
    CASE WHEN f.sort_key = 'client:asc'     THEN lower(f.client_company_name_snapshot) END ASC NULLS LAST,
    CASE WHEN f.sort_key = 'client:desc'    THEN lower(f.client_company_name_snapshot) END DESC NULLS LAST,
    CASE WHEN f.sort_key = 'sales:asc'      THEN lower(f.primary_name) END ASC NULLS LAST,
    CASE WHEN f.sort_key = 'sales:desc'     THEN lower(f.primary_name) END DESC NULLS LAST,
    CASE WHEN f.sort_key = 'outcome:asc'    THEN f.outcome_order END ASC NULLS LAST,
    CASE WHEN f.sort_key = 'outcome:asc'    THEN f.visit_outcome END ASC NULLS LAST,
    CASE WHEN f.sort_key = 'outcome:desc'   THEN f.outcome_order END DESC NULLS LAST,
    CASE WHEN f.sort_key = 'outcome:desc'   THEN f.visit_outcome END DESC NULLS LAST,
    CASE WHEN f.sort_key = 'interest:asc'   THEN f.interest_order END ASC NULLS LAST,
    CASE WHEN f.sort_key = 'interest:asc'   THEN f.interest_level END ASC NULLS LAST,
    CASE WHEN f.sort_key = 'interest:desc'  THEN f.interest_order END DESC NULLS LAST,
    CASE WHEN f.sort_key = 'interest:desc'  THEN f.interest_level END DESC NULLS LAST,
    CASE WHEN f.sort_key = 'value:asc'      THEN f.estimated_value END ASC NULLS LAST,
    CASE WHEN f.sort_key = 'value:desc'     THEN f.estimated_value END DESC NULLS LAST,
    CASE WHEN f.sort_key = 'follow_up:asc'  THEN f.follow_up_date END ASC NULLS LAST,
    CASE WHEN f.sort_key = 'follow_up:desc' THEN f.follow_up_date END DESC NULLS LAST,
    CASE WHEN f.sort_key = 'actual:asc'     THEN f.actual_start END ASC NULLS LAST,
    CASE WHEN f.sort_key = 'actual:desc'    THEN f.actual_start END DESC NULLS LAST,
    f.submitted_at DESC NULLS LAST,
    f.updated_at DESC,
    f.id
  LIMIT CASE WHEN p_size <= 0 THEN NULL ELSE p_size END
  OFFSET GREATEST(p_page, 0) * GREATEST(p_size, 0);
$$;

GRANT EXECUTE ON FUNCTION sales_mission.fn_list_reports(
  uuid, text, text[], text[], text[], text[], uuid[], boolean, boolean, date, date, text, integer, integer
) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
