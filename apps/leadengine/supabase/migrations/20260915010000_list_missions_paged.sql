-- ============================================================
-- The mission list, filtered and paged in the database.
--
-- The list used to load every mission the tenant had and filter in memory.
-- PostgREST caps a select at 1000 rows, so after a year the oldest visits
-- would have quietly vanished from the list, and every page load grew with
-- the tenant. This function applies the same filters the page offers and
-- returns one page of ids with the total, in the requested order.
--
-- SECURITY INVOKER: RLS still decides what the caller may see; the company
-- filter is explicit as well, as everywhere else in the app.
--
-- "visit_state" mirrors lib/missions/visit-state.ts exactly. If one changes,
-- the other must.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION sales_mission.fn_list_missions(
  p_company_id uuid,
  p_q text DEFAULT NULL,
  p_status text[] DEFAULT NULL,
  p_type text[] DEFAULT NULL,
  p_sales uuid[] DEFAULT NULL,
  p_creator uuid[] DEFAULT NULL,
  p_location text[] DEFAULT NULL,
  p_report text[] DEFAULT NULL,
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
  p_lens text DEFAULT 'all',
  p_viewer uuid DEFAULT NULL,
  p_now timestamptz DEFAULT now(),
  p_sort text DEFAULT 'upcoming',
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
      m.id, m.scheduled_start, m.scheduled_end, m.status, m.created_at, m.created_by,
      m.client_company_name_snapshot, m.location, m.objective, m.mission_type, m.contact_name,
      r.status AS report_status,
      COALESCE((SELECT array_agg(a.user_id) FROM sales_mission.assignments a WHERE a.mission_id = m.id), ARRAY[]::uuid[]) AS assignees,
      (SELECT count(*) FROM sales_mission.assignments a WHERE a.mission_id = m.id AND a.response = 'PENDING') AS pending,
      (SELECT a.response FROM sales_mission.assignments a WHERE a.mission_id = m.id AND a.user_id = p_viewer LIMIT 1) AS viewer_response
    FROM sales_mission.missions m
    LEFT JOIN sales_mission.visit_reports r ON r.mission_id = m.id
    WHERE m.company_id = p_company_id
  ),
  states AS (
    SELECT b.*,
      CASE
        WHEN b.status IN ('CANCELLED', 'REJECTED') THEN 'cancelled'
        WHEN b.status = 'COMPLETED' OR b.report_status = 'SUBMITTED' THEN 'reported'
        WHEN b.report_status IN ('DRAFT', 'NEEDS_CLARIFICATION') THEN 'draft'
        WHEN b.scheduled_start IS NULL THEN 'unscheduled'
        WHEN COALESCE(b.scheduled_end, b.scheduled_start + interval '1 hour') <= p_now THEN 'needs_report'
        ELSE 'upcoming'
      END AS visit_state,
      (b.scheduled_start AT TIME ZONE 'Asia/Jakarta')::date AS local_day
    FROM base b
  ),
  filtered AS (
    SELECT s.* FROM states s
    WHERE (p_q IS NULL OR btrim(p_q) = ''
           OR s.client_company_name_snapshot ILIKE '%' || p_q || '%'
           OR s.location ILIKE '%' || p_q || '%'
           OR s.objective ILIKE '%' || p_q || '%'
           OR s.mission_type ILIKE '%' || p_q || '%'
           OR s.contact_name ILIKE '%' || p_q || '%'
           OR EXISTS (
             SELECT 1 FROM sales_mission.assignments a
             JOIN public.profiles p ON p.id = a.user_id
             WHERE a.mission_id = s.id AND p.full_name ILIKE '%' || p_q || '%'
           ))
      AND (p_status IS NULL OR s.status = ANY (p_status))
      AND (p_type IS NULL OR lower(s.mission_type) IN (SELECT lower(x) FROM unnest(p_type) x))
      AND (p_sales IS NULL OR s.assignees && p_sales)
      AND (p_creator IS NULL OR s.created_by = ANY (p_creator))
      AND (p_location IS NULL OR lower(COALESCE(s.location, '')) IN (SELECT lower(x) FROM unnest(p_location) x))
      AND (p_report IS NULL OR s.visit_state = ANY (p_report))
      AND (p_from IS NULL OR s.local_day >= p_from)
      AND (p_to IS NULL OR s.local_day <= p_to)
      AND (
        p_lens = 'all'
        OR (p_lens = 'mine' AND s.viewer_response = 'PENDING' AND s.status NOT IN ('COMPLETED', 'CANCELLED', 'IN_PROGRESS'))
        OR (p_lens = 'team' AND s.pending > 0 AND s.status NOT IN ('COMPLETED', 'CANCELLED', 'IN_PROGRESS'))
      )
  )
  SELECT f.id, count(*) OVER () AS total
  FROM filtered f
  ORDER BY
    -- "upcoming": what is ahead first, nearest at the top; then the past,
    -- most recent first. That is the order a planner reads a list in.
    CASE WHEN p_sort = 'upcoming' THEN CASE WHEN f.scheduled_start >= p_now THEN 0 WHEN f.scheduled_start IS NULL THEN 2 ELSE 1 END END,
    CASE WHEN p_sort = 'upcoming' AND f.scheduled_start >= p_now THEN f.scheduled_start END ASC,
    CASE WHEN p_sort = 'upcoming' AND f.scheduled_start < p_now THEN f.scheduled_start END DESC,
    CASE WHEN p_sort = 'asc' THEN f.scheduled_start END ASC NULLS LAST,
    CASE WHEN p_sort = 'desc' THEN f.scheduled_start END DESC NULLS LAST,
    f.created_at DESC
  LIMIT CASE WHEN p_size <= 0 THEN NULL ELSE p_size END
  OFFSET GREATEST(p_page, 0) * GREATEST(p_size, 0);
$$;

GRANT EXECUTE ON FUNCTION sales_mission.fn_list_missions(uuid, text, text[], text[], uuid[], uuid[], text[], text[], date, date, text, uuid, timestamptz, text, integer, integer) TO authenticated;

-- The values the facets can offer, without reading every row into the app.
CREATE OR REPLACE FUNCTION sales_mission.fn_mission_facets(p_company_id uuid)
RETURNS TABLE (kind text, value text)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = sales_mission, public
AS $$
  SELECT 'type', mission_type FROM sales_mission.missions
  WHERE company_id = p_company_id AND btrim(mission_type) <> ''
  GROUP BY mission_type
  UNION ALL
  SELECT 'location', location FROM sales_mission.missions
  WHERE company_id = p_company_id AND location IS NOT NULL AND btrim(location) <> ''
  GROUP BY location
  ORDER BY 1, 2;
$$;

GRANT EXECUTE ON FUNCTION sales_mission.fn_mission_facets(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
