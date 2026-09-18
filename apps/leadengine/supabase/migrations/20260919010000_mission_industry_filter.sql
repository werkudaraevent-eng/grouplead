-- The mission list can be filtered by industry, including "not filled in".
--
-- Industry on a mission is optional and many were saved without it, which
-- leaves holes in the reports. The list gets an industry facet so those can be
-- found and fixed: p_industry holds the chosen industries, and the value
-- '__none__' matches a mission whose industry is empty. The facets function
-- also returns the industries the tenant has used.
--
-- Adding a parameter creates a new overload, and PostgREST cannot choose
-- between two functions called with named arguments, so the old signature is
-- dropped first.

BEGIN;

DROP FUNCTION IF EXISTS sales_mission.fn_list_missions(
  uuid, text, text[], text[], uuid[], uuid[], text[], text[], date, date, text, uuid, timestamptz, text, integer, integer
);

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
  p_size integer DEFAULT 25,
  p_industry text[] DEFAULT NULL
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
      m.client_company_name_snapshot, m.location, m.objective, m.mission_type, m.contact_name, m.industry,
      r.status AS report_status,
      COALESCE((SELECT array_agg(a.user_id) FROM sales_mission.assignments a WHERE a.mission_id = m.id), ARRAY[]::uuid[]) AS assignees,
      (SELECT count(*) FROM sales_mission.assignments a WHERE a.mission_id = m.id AND a.response = 'PENDING') AS pending,
      (SELECT a.response FROM sales_mission.assignments a WHERE a.mission_id = m.id AND a.user_id = p_viewer LIMIT 1) AS viewer_response,
      (SELECT p.full_name FROM sales_mission.assignments a JOIN public.profiles p ON p.id = a.user_id
         WHERE a.mission_id = m.id AND a.assignment_role = 'PRIMARY' LIMIT 1) AS primary_name
    FROM sales_mission.missions m
    LEFT JOIN sales_mission.visit_reports r ON r.mission_id = m.id
    WHERE m.company_id = p_company_id
      AND m.deleted_at IS NULL
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
    SELECT s.*,
      CASE s.visit_state
        WHEN 'upcoming' THEN 0 WHEN 'needs_report' THEN 1 WHEN 'draft' THEN 2
        WHEN 'reported' THEN 3 WHEN 'unscheduled' THEN 4 ELSE 5
      END AS state_rank
    FROM states s
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
      AND (p_industry IS NULL
           OR ('__none__' = ANY (p_industry) AND btrim(COALESCE(s.industry, '')) = '')
           OR lower(btrim(COALESCE(s.industry, ''))) IN (SELECT lower(x) FROM unnest(p_industry) x WHERE x <> '__none__'))
      AND (p_report IS NULL OR s.visit_state = ANY (p_report))
      AND (p_from IS NULL OR s.local_day >= p_from)
      AND (p_to IS NULL OR s.local_day <= p_to)
      AND (
        p_lens = 'all'
        OR (p_lens = 'mine' AND s.viewer_response = 'PENDING' AND s.status NOT IN ('COMPLETED', 'CANCELLED', 'IN_PROGRESS'))
        OR (p_lens = 'team' AND s.pending > 0 AND s.status NOT IN ('COMPLETED', 'CANCELLED', 'IN_PROGRESS'))
      )
  ),
  sorted AS (
    SELECT f.*,
      CASE WHEN p_sort IN ('asc', 'desc') THEN 'schedule:' || p_sort ELSE COALESCE(p_sort, 'upcoming') END AS sort_key
    FROM filtered f
  )
  SELECT f.id, count(*) OVER () AS total
  FROM sorted f
  ORDER BY
    CASE WHEN f.sort_key = 'upcoming' THEN CASE WHEN f.scheduled_start >= p_now THEN 0 WHEN f.scheduled_start IS NULL THEN 2 ELSE 1 END END,
    CASE WHEN f.sort_key = 'upcoming' AND f.scheduled_start >= p_now THEN f.scheduled_start END ASC,
    CASE WHEN f.sort_key = 'upcoming' AND f.scheduled_start < p_now THEN f.scheduled_start END DESC,
    CASE WHEN f.sort_key = 'schedule:asc' THEN f.scheduled_start END ASC NULLS LAST,
    CASE WHEN f.sort_key = 'schedule:desc' THEN f.scheduled_start END DESC NULLS LAST,
    CASE WHEN f.sort_key = 'client:asc' THEN lower(f.client_company_name_snapshot) END ASC NULLS LAST,
    CASE WHEN f.sort_key = 'client:desc' THEN lower(f.client_company_name_snapshot) END DESC NULLS LAST,
    CASE WHEN f.sort_key = 'location:asc' THEN lower(f.location) END ASC NULLS LAST,
    CASE WHEN f.sort_key = 'location:desc' THEN lower(f.location) END DESC NULLS LAST,
    CASE WHEN f.sort_key = 'sales:asc' THEN lower(f.primary_name) END ASC NULLS LAST,
    CASE WHEN f.sort_key = 'sales:desc' THEN lower(f.primary_name) END DESC NULLS LAST,
    CASE WHEN f.sort_key = 'status:asc' THEN f.state_rank END ASC,
    CASE WHEN f.sort_key = 'status:desc' THEN f.state_rank END DESC,
    f.scheduled_start ASC NULLS LAST,
    f.created_at DESC
  LIMIT CASE WHEN p_size <= 0 THEN NULL ELSE p_size END
  OFFSET GREATEST(p_page, 0) * GREATEST(p_size, 0);
$$;

CREATE OR REPLACE FUNCTION sales_mission.fn_mission_facets(p_company_id uuid)
RETURNS TABLE (kind text, value text)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = sales_mission, public
AS $$
  SELECT 'type', mission_type FROM sales_mission.missions
  WHERE company_id = p_company_id AND deleted_at IS NULL AND btrim(mission_type) <> ''
  GROUP BY mission_type
  UNION ALL
  SELECT 'location', location FROM sales_mission.missions
  WHERE company_id = p_company_id AND deleted_at IS NULL AND location IS NOT NULL AND btrim(location) <> ''
  GROUP BY location
  UNION ALL
  SELECT 'industry', btrim(industry) FROM sales_mission.missions
  WHERE company_id = p_company_id AND deleted_at IS NULL AND industry IS NOT NULL AND btrim(industry) <> ''
  GROUP BY btrim(industry)
  ORDER BY 1, 2;
$$;

GRANT EXECUTE ON FUNCTION sales_mission.fn_list_missions(
  uuid, text, text[], text[], uuid[], uuid[], text[], text[], date, date, text, uuid, timestamptz, text, integer, integer, text[]
) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
