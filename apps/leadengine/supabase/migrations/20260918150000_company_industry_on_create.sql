-- ============================================================
-- A company registered from a visit carries its industry.
--
-- Sales Activity now knows a prospect's and an activity's industry (the
-- same list as this CRM's Sector options). When a visit report registers
-- a company the CRM has never seen, the industry should arrive with it
-- rather than be typed a third time under "Needs details". The
-- find-or-create function gains a trailing, defaulted parameter: new rows
-- get it; an existing row that has none is filled in; a row that already
-- has one is never overwritten (the CRM's record wins). SECURITY INVOKER
-- as before, so the caller's own grants still decide.
-- ============================================================

BEGIN;

DROP FUNCTION IF EXISTS public.fn_find_or_create_client_company(text, uuid, uuid, text);

CREATE OR REPLACE FUNCTION public.fn_find_or_create_client_company(
  p_name       text,
  p_company_id uuid DEFAULT NULL,
  p_owner_id   uuid DEFAULT NULL,
  p_city       text DEFAULT NULL,
  p_industry   text DEFAULT NULL
)
RETURNS TABLE (id uuid, name text, created boolean, needs_enrichment boolean, industry text)
LANGUAGE plpgsql
AS $$
DECLARE
  v_norm     text := public.fn_normalize_company_name(p_name);
  v_industry text := NULLIF(btrim(p_industry), '');
BEGIN
  IF v_norm = '' THEN
    RAISE EXCEPTION 'Company name is empty';
  END IF;

  -- Found: fill an empty industry, never replace one.
  IF v_industry IS NOT NULL THEN
    UPDATE public.client_companies c
    SET industry = v_industry
    WHERE c.deleted_at IS NULL AND c.name_normalized = v_norm
      AND (c.industry IS NULL OR btrim(c.industry) = '');
  END IF;

  RETURN QUERY
    SELECT c.id, c.name, false, c.needs_enrichment, c.industry
    FROM public.client_companies c
    WHERE c.deleted_at IS NULL AND c.name_normalized = v_norm
    LIMIT 1;
  IF FOUND THEN RETURN; END IF;

  BEGIN
    RETURN QUERY
      INSERT INTO public.client_companies (name, company_id, owner_id, city, industry, needs_enrichment)
      VALUES (btrim(p_name), p_company_id, p_owner_id, NULLIF(btrim(p_city), ''), v_industry, true)
      RETURNING client_companies.id, client_companies.name, true, client_companies.needs_enrichment, client_companies.industry;
  EXCEPTION WHEN unique_violation THEN
    -- Someone inserted the same company between our SELECT and INSERT.
    -- Theirs wins; hand it back as if we had found it.
    RETURN QUERY
      SELECT c.id, c.name, false, c.needs_enrichment, c.industry
      FROM public.client_companies c
      WHERE c.deleted_at IS NULL AND c.name_normalized = v_norm
      LIMIT 1;
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_find_or_create_client_company(text, uuid, uuid, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
