-- ============================================================
-- A company merge takes its Sales Activity prospects along.
--
-- fn_merge_client_companies (20260913150000) moves everything that points
-- at the loser to the winner, including Sales Activity's activities
-- (sales_mission.missions). Prospects came three days later
-- (20260916100000) with their own client_company_id, and the merge was
-- never taught about them: a merged company's prospects kept pointing at
-- the retired row in the Recycle Bin, so the prospect page could no longer
-- reach the company's record, and scheduling a visit from the prospect
-- carried a dead link into the new activity.
--
-- 1. The function is recreated with the same signature, the same
--    SECURITY DEFINER and search_path, and the same grants. The only
--    change is one more UPDATE, for sales_mission.prospects, beside the one
--    for missions. Nothing else in it moves.
--
-- 2. Links already left behind are repaired: an activity or a prospect
--    whose client_company_id names a merged company (merged_into set) is
--    pointed at the company it was merged into, which is what the merge
--    would have done. Activities are included because the company pickers
--    offered Recycle Bin rows until now, so one could be linked to a merged
--    company after the merge ran. A merge of a merge is followed to its
--    end, one step per pass (a merged row is in the Bin and cannot be
--    merged again, so a chain cannot loop; the bound is a guard only).
--    Names and contact details stay as they were: those are what the
--    activity or prospect recorded, and only the link is moved.
--
-- The audit trigger on both tables logs each repaired link as a change of
-- "tautan CRM" with no actor, the way it logs every system write.
-- ============================================================

BEGIN;

-- ── 1. Merge ─────────────────────────────────────────────────
-- SECURITY DEFINER because the rows being moved (leads, contacts, notes,
-- Sales Mission missions and prospects) each have their own RLS, and a merge that half
-- succeeds is worse than one that is refused. The permission check is the
-- same matrix grant the Delete button needs; the server action checks it too.
CREATE OR REPLACE FUNCTION public.fn_merge_client_companies(p_winner uuid, p_loser uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  w public.client_companies%ROWTYPE;
  l public.client_companies%ROWTYPE;
BEGIN
  IF p_winner = p_loser THEN
    RAISE EXCEPTION 'A company cannot be merged into itself';
  END IF;

  SELECT * INTO w FROM public.client_companies WHERE id = p_winner AND deleted_at IS NULL FOR UPDATE;
  SELECT * INTO l FROM public.client_companies WHERE id = p_loser  AND deleted_at IS NULL FOR UPDATE;
  IF w.id IS NULL OR l.id IS NULL THEN
    RAISE EXCEPTION 'Both companies must exist and not be in the Recycle Bin';
  END IF;

  -- auth.uid() is NULL inside a migration; the helper then answers on the
  -- tenant alone, which is what the backfill needs.
  IF auth.uid() IS NOT NULL
     AND NOT public.fn_user_has_matrix_permission(COALESCE(w.company_id, l.company_id), 'companies', 'delete') THEN
    RAISE EXCEPTION 'Not allowed to merge companies';
  END IF;

  UPDATE public.leads               SET client_company_id = p_winner WHERE client_company_id = p_loser;
  UPDATE public.contacts            SET client_company_id = p_winner WHERE client_company_id = p_loser;
  UPDATE public.company_notes       SET client_company_id = p_winner WHERE client_company_id = p_loser;
  UPDATE public.company_attachments SET client_company_id = p_winner WHERE client_company_id = p_loser;
  UPDATE public.company_activities  SET client_company_id = p_winner WHERE client_company_id = p_loser;
  UPDATE public.client_companies    SET parent_id = p_winner WHERE parent_id = p_loser;
  UPDATE sales_mission.missions     SET client_company_id = p_winner WHERE client_company_id = p_loser;
  UPDATE sales_mission.prospects    SET client_company_id = p_winner WHERE client_company_id = p_loser;

  -- The winner keeps what it has; the loser only fills gaps.
  UPDATE public.client_companies SET
    industry       = COALESCE(w.industry,       l.industry),
    line_industry  = COALESCE(w.line_industry,  l.line_industry),
    website        = COALESCE(w.website,        l.website),
    phone          = COALESCE(w.phone,          l.phone),
    address        = COALESCE(w.address,        l.address),
    street_address = COALESCE(w.street_address, l.street_address),
    city           = COALESCE(w.city,           l.city),
    area           = COALESCE(w.area,           l.area),
    postal_code    = COALESCE(w.postal_code,    l.postal_code),
    owner_id       = COALESCE(w.owner_id,       l.owner_id),
    parent_id      = COALESCE(w.parent_id,      l.parent_id),
    company_id     = COALESCE(w.company_id,     l.company_id),
    custom_data    = COALESCE(l.custom_data, '{}'::jsonb) || COALESCE(w.custom_data, '{}'::jsonb),
    -- Two thin records merged are still thin; one real record absorbs a stub.
    needs_enrichment = (w.needs_enrichment AND l.needs_enrichment)
  WHERE id = p_winner;

  UPDATE public.client_companies SET
    deleted_at  = timezone('utc', now()),
    deleted_by  = auth.uid(),
    merged_into = p_winner
  WHERE id = p_loser;

  INSERT INTO public.company_activities (client_company_id, user_id, action_type, description)
  VALUES (p_winner, auth.uid(), 'update',
          format('Merged duplicate "%s" into this company', l.name));
END;
$$;

REVOKE ALL ON FUNCTION public.fn_merge_client_companies(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.fn_merge_client_companies(uuid, uuid) TO authenticated;

-- ── 2. Links a merge already left behind ─────────────────────
DO $$
DECLARE
  pass  integer := 0;
  moved integer;
  n     integer;
BEGIN
  LOOP
    pass := pass + 1;
    moved := 0;

    UPDATE sales_mission.prospects p
    SET client_company_id = c.merged_into
    FROM public.client_companies c
    WHERE p.client_company_id = c.id
      AND c.merged_into IS NOT NULL;
    GET DIAGNOSTICS n = ROW_COUNT;
    moved := moved + n;

    UPDATE sales_mission.missions m
    SET client_company_id = c.merged_into
    FROM public.client_companies c
    WHERE m.client_company_id = c.id
      AND c.merged_into IS NOT NULL;
    GET DIAGNOSTICS n = ROW_COUNT;
    moved := moved + n;

    EXIT WHEN moved = 0 OR pass >= 10;
  END LOOP;
END $$;

COMMIT;

-- Same signature, so PostgREST's cache is not stale; reloaded anyway so the
-- function the API calls is certainly this one.
NOTIFY pgrst, 'reload schema';
