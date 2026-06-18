-- ============================================================
--  Add needs_enrichment flag to client_companies & contacts
--
--  Purpose: when a lead import auto-creates a company/contact
--  on the fly, the record only has a name (thin record). This
--  flag lets admins find + complete those records later.
--
--  Lifecycle:
--    • Lead import auto-create → set TRUE.
--    • Any later edit/save of the record (Add/Edit modal,
--      inline field edit) → set back to FALSE (auto-clear).
--  Default FALSE so manually-created and fully-imported
--  records are never flagged.
-- ============================================================

ALTER TABLE public.client_companies
  ADD COLUMN IF NOT EXISTS needs_enrichment BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS needs_enrichment BOOLEAN NOT NULL DEFAULT false;

-- Partial indexes — only the flagged rows are indexed, so the
-- "needs enrichment" filter stays fast without bloating writes.
CREATE INDEX IF NOT EXISTS idx_client_companies_needs_enrichment
  ON public.client_companies (needs_enrichment)
  WHERE needs_enrichment = true;

CREATE INDEX IF NOT EXISTS idx_contacts_needs_enrichment
  ON public.contacts (needs_enrichment)
  WHERE needs_enrichment = true;

COMMENT ON COLUMN public.client_companies.needs_enrichment IS
  'TRUE when auto-created by lead import with only a name; cleared on first manual edit.';
COMMENT ON COLUMN public.contacts.needs_enrichment IS
  'TRUE when auto-created by lead import with only a name; cleared on first manual edit.';

-- ── Auto-clear on edit (covers ALL update paths) ──────────────
-- Any UPDATE that changes a real field (other than the flag itself)
-- means an admin/user touched the record → it's no longer a thin
-- auto-created stub, so clear the flag. Done in a BEFORE UPDATE
-- trigger so modal edits, inline field edits, and the company
-- import upsert all benefit without code duplication.
CREATE OR REPLACE FUNCTION public.fn_clear_needs_enrichment()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only act on rows currently flagged. If the row is flagged and the
  -- caller didn't explicitly set the flag in this update, and *some*
  -- column actually changed, clear it.
  IF OLD.needs_enrichment = true
     AND NEW.needs_enrichment = true       -- caller didn't deliberately re-set it
     AND NEW IS DISTINCT FROM OLD THEN
    NEW.needs_enrichment := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clear_needs_enrichment_companies ON public.client_companies;
CREATE TRIGGER trg_clear_needs_enrichment_companies
  BEFORE UPDATE ON public.client_companies
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_clear_needs_enrichment();

DROP TRIGGER IF EXISTS trg_clear_needs_enrichment_contacts ON public.contacts;
CREATE TRIGGER trg_clear_needs_enrichment_contacts
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_clear_needs_enrichment();

