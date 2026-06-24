-- ============================================================
-- Recycle Bin (soft delete) for leads, client_companies, contacts.
--
-- Adds deleted_at / deleted_by to each table. "Delete" in the app becomes a
-- soft delete (sets deleted_at). Admins/super-admins can view the Recycle Bin,
-- restore items, or permanently delete them. A configurable retention period
-- (app_settings.trash_retention_days) drives auto-purge.
--
-- Read paths filter `deleted_at IS NULL` so trashed rows disappear from normal
-- views and dashboards. The trash view queries `deleted_at IS NOT NULL`.
-- ============================================================

BEGIN;

-- ── Columns ─────────────────────────────────────────────────────────────────
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.client_companies
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Partial indexes keep "active" reads fast (the common path).
CREATE INDEX IF NOT EXISTS idx_leads_active ON public.leads(id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_client_companies_active ON public.client_companies(id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_active ON public.contacts(id) WHERE deleted_at IS NULL;

-- ── Retention setting ────────────────────────────────────────────────────────
-- Number of days a trashed item is kept before it can be auto-purged.
-- 0 means "keep forever" (manual purge only).
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS trash_retention_days integer NOT NULL DEFAULT 30;

COMMIT;
