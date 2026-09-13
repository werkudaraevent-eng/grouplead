-- ============================================================
-- One company, one record.
--
-- Three problems, all visible in production before this ran:
--
--   1. "Asuransi BRI Life" existed twice, differing by one whitespace
--      character. "Sriboga Marugame Indonesia" existed with and without a
--      trailing "PT". Six code paths inserted into client_companies with
--      three different ideas of "already exists": exact case-sensitive (the
--      old UNIQUE index), case-insensitive (ilike), or an in-memory map.
--      None of them saw "PT X" and "X Tbk" as the same company.
--
--   2. Every one of those paths checked first and inserted second, in two
--      round trips. Two visit reports submitted in the same second for the
--      same new company both passed the check and both inserted.
--
--   3. Once a duplicate existed there was no way to fold it back. Leads,
--      contacts, notes and visits stayed split across two rows forever.
--
-- What this does:
--
--   - fn_normalize_company_name: lowercase, drop punctuation, drop legal-form
--     tokens (PT, Tbk, Persero, Inc...) from the edges. Stored on the row as a
--     generated column, so the database computes it and no caller can forget.
--   - fn_merge_client_companies: moves everything that points at the loser to
--     the winner, fills the winner's blanks from the loser, and retires the
--     loser to the Recycle Bin with a note. One implementation, used by the
--     backfill below and by the Merge button on the Companies screen.
--   - A backfill that merges the collisions that already exist, keeping the
--     row with the most attached data (oldest on a tie).
--   - A partial UNIQUE index on the normalised name over active rows. This is
--     the only thing that actually stops a race: two inserts in the same
--     second, one wins, the other gets a unique_violation and is redirected.
--   - fn_find_or_create_client_company: the single find-or-create every path
--     should call. Catches the unique_violation and returns the winner.
--
-- Uniqueness is global, not per business unit. Every one of the 690 rows has
-- company_id NULL and is visible to every unit; scoping the index by tenant
-- would let a NULL-tenant "PT X" and a unit-stamped "PT X" sit side by side in
-- the same list, which is the exact thing being fixed.
--
-- The old case-sensitive UNIQUE on raw name is dropped: it spanned trashed
-- rows (blocking a legitimate re-create after a delete) and is strictly
-- weaker than the index that replaces it.
-- ============================================================

BEGIN;

-- ── 1. Normaliser ────────────────────────────────────────────
-- IMMUTABLE so it can back a generated column. The token list mirrors
-- normalizeCompanyName in lib/duplicate-detection.ts; a parity check against
-- every production name ran when this shipped.
CREATE OR REPLACE FUNCTION public.fn_normalize_company_name(p_name text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
STRICT
AS $$
DECLARE
  tokens text[];
  legal  CONSTANT text[] := ARRAY[
    'pt','cv','ud','pd','po','fa','tbk','persero',
    'inc','ltd','llc','corp','co','company','limited','gmbh','plc'
  ];
BEGIN
  tokens := regexp_split_to_array(
    btrim(regexp_replace(lower(p_name), '[^a-z0-9]+', ' ', 'g')),
    ' '
  );
  tokens := array_remove(tokens, '');

  -- Strip legal forms from the edges only, and never the last token: "PT"
  -- on its own is still a name of something.
  WHILE array_length(tokens, 1) > 1 AND tokens[1] = ANY (legal) LOOP
    tokens := tokens[2:];
  END LOOP;
  WHILE array_length(tokens, 1) > 1 AND tokens[array_length(tokens, 1)] = ANY (legal) LOOP
    tokens := tokens[1:array_length(tokens, 1) - 1];
  END LOOP;

  RETURN COALESCE(array_to_string(tokens, ' '), '');
END;
$$;

COMMENT ON FUNCTION public.fn_normalize_company_name(text) IS
  'Matching key for client company names: lowercase, punctuation removed, legal-form tokens (PT, Tbk, Inc...) stripped from the edges. Keep in step with normalizeCompanyName in lib/duplicate-detection.ts.';

ALTER TABLE public.client_companies
  ADD COLUMN IF NOT EXISTS name_normalized text
    GENERATED ALWAYS AS (public.fn_normalize_company_name(name)) STORED;

-- Where a merged duplicate went. Lets the Recycle Bin say "merged into X"
-- instead of just "deleted", and lets restore refuse sensibly.
ALTER TABLE public.client_companies
  ADD COLUMN IF NOT EXISTS merged_into uuid REFERENCES public.client_companies(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.client_companies.merged_into IS
  'Set when this row was retired by fn_merge_client_companies. Everything it owned now belongs to that row.';

-- ── 2. Merge ─────────────────────────────────────────────────
-- SECURITY DEFINER because the rows being moved (leads, contacts, notes,
-- Sales Mission missions) each have their own RLS, and a merge that half
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

-- ── 3. Fold the duplicates that already exist ────────────────
-- Winner: the row with the most leads and contacts attached; oldest on a tie.
-- Nothing is lost either way, because the loser's data moves rather than
-- being deleted, but the winner's id is the one every existing link keeps.
DO $$
DECLARE
  grp   record;
  win   uuid;
  other uuid;
BEGIN
  FOR grp IN
    SELECT name_normalized
    FROM public.client_companies
    WHERE deleted_at IS NULL AND name_normalized <> ''
    GROUP BY name_normalized
    HAVING count(*) > 1
  LOOP
    SELECT c.id INTO win
    FROM public.client_companies c
    LEFT JOIN LATERAL (
      SELECT count(*) AS n FROM public.leads    WHERE client_company_id = c.id
    ) lc ON true
    LEFT JOIN LATERAL (
      SELECT count(*) AS n FROM public.contacts WHERE client_company_id = c.id
    ) cc ON true
    WHERE c.deleted_at IS NULL AND c.name_normalized = grp.name_normalized
    ORDER BY (lc.n + cc.n) DESC, c.created_at ASC
    LIMIT 1;

    FOR other IN
      SELECT id FROM public.client_companies
      WHERE deleted_at IS NULL AND name_normalized = grp.name_normalized AND id <> win
    LOOP
      PERFORM public.fn_merge_client_companies(win, other);
    END LOOP;
  END LOOP;
END $$;

-- ── 4. The constraint that ends the race ─────────────────────
-- Fails loudly if step 3 left a collision behind, which is the right outcome.
DROP INDEX IF EXISTS public.idx_client_companies_name;

CREATE UNIQUE INDEX IF NOT EXISTS client_companies_name_normalized_uidx
  ON public.client_companies (name_normalized)
  WHERE deleted_at IS NULL;

-- ── 5. The one find-or-create every writer should use ────────
-- SECURITY INVOKER on purpose: the insert runs as the caller under RLS, so
-- the `companies` matrix grant still decides who may add a company.
CREATE OR REPLACE FUNCTION public.fn_find_or_create_client_company(
  p_name       text,
  p_company_id uuid DEFAULT NULL,
  p_owner_id   uuid DEFAULT NULL,
  p_city       text DEFAULT NULL
)
RETURNS TABLE (id uuid, name text, created boolean, needs_enrichment boolean)
LANGUAGE plpgsql
AS $$
DECLARE
  v_norm text := public.fn_normalize_company_name(p_name);
BEGIN
  IF v_norm = '' THEN
    RAISE EXCEPTION 'Company name is empty';
  END IF;

  RETURN QUERY
    SELECT c.id, c.name, false, c.needs_enrichment
    FROM public.client_companies c
    WHERE c.deleted_at IS NULL AND c.name_normalized = v_norm
    LIMIT 1;
  IF FOUND THEN RETURN; END IF;

  BEGIN
    RETURN QUERY
      INSERT INTO public.client_companies (name, company_id, owner_id, city, needs_enrichment)
      VALUES (btrim(p_name), p_company_id, p_owner_id, NULLIF(btrim(p_city), ''), true)
      RETURNING client_companies.id, client_companies.name, true, client_companies.needs_enrichment;
  EXCEPTION WHEN unique_violation THEN
    -- Someone inserted the same company between our SELECT and INSERT.
    -- Theirs wins; hand it back as if we had found it.
    RETURN QUERY
      SELECT c.id, c.name, false, c.needs_enrichment
      FROM public.client_companies c
      WHERE c.deleted_at IS NULL AND c.name_normalized = v_norm
      LIMIT 1;
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_find_or_create_client_company(text, uuid, uuid, text) TO authenticated;

-- The generated column and the two functions have to be visible to the API
-- immediately, or the first caller after deploy gets "column does not exist".
NOTIFY pgrst, 'reload schema';

COMMIT;
