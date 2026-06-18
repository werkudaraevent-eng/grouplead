-- =============================================================================
-- Tenancy refactor — Phase 1: Global pipelines + per-subsidiary lead scoping
-- =============================================================================
-- Target model (locked 2026-06-18):
--   * Lead belongs to exactly one subsidiary (leads.company_id) — unchanged.
--   * Pipeline becomes a GLOBAL shared definition (no owner company).
--   * Holding (Werkudara Group) is a UNION view only, never a data owner.
--   * Kill the 3-tier visibility matrix (owner_only/all_subs/selected) and the
--     pipeline_company_access table entirely. "Inherited" concept retired.
--
-- This migration is DESTRUCTIVE (drops a column + a table). User confirmed data
-- is safe to rebuild and requested a backup first. We snapshot the affected
-- data into timestamped backup tables IN-DATABASE (no direct psql connection is
-- available in this project — see repo memory), so it can be restored or
-- exported later if needed.
-- =============================================================================

BEGIN;

-- ── 1. Backups (idempotent: drop-and-recreate snapshot tables) ──────────────
DROP TABLE IF EXISTS _backup_20260618_pipelines;
CREATE TABLE _backup_20260618_pipelines AS
  SELECT * FROM public.pipelines;

DROP TABLE IF EXISTS _backup_20260618_pipeline_company_access;
CREATE TABLE _backup_20260618_pipeline_company_access AS
  SELECT * FROM public.pipeline_company_access;

COMMENT ON TABLE _backup_20260618_pipelines IS
  'Snapshot of pipelines (incl. company_id + visibility) before global-pipeline refactor 2026-06-18. Safe to drop once verified.';
COMMENT ON TABLE _backup_20260618_pipeline_company_access IS
  'Snapshot of pipeline_company_access before it was dropped in the global-pipeline refactor 2026-06-18. Safe to drop once verified.';

-- ── 2. Make pipelines global ────────────────────────────────────────────────
-- Detach every pipeline from any owning company. NULL company_id == global.
-- The FK stays so the column can still reference companies if ever re-scoped,
-- but the column becomes nullable and unset for all rows.
ALTER TABLE public.pipelines ALTER COLUMN company_id DROP NOT NULL;
UPDATE public.pipelines SET company_id = NULL;

-- ── 3. Drop the visibility matrix ───────────────────────────────────────────
ALTER TABLE public.pipelines DROP COLUMN IF EXISTS visibility;
DROP TABLE IF EXISTS public.pipeline_company_access;

-- ── 4. Rewrite pipeline management RLS ──────────────────────────────────────
-- Old policy granted manage rights to company_members admins on the pipeline's
-- owner company. With global pipelines there is no owner company, so only
-- platform-level admins (super_admin / admin) may create/edit/delete pipeline
-- definitions. SELECT stays open to all authenticated users (everyone shares
-- the same global pipeline list; lead rows remain RLS-scoped separately).
DROP POLICY IF EXISTS "Allow admin manage pipelines" ON public.pipelines;
CREATE POLICY "Allow admin manage pipelines"
  ON public.pipelines FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('super_admin', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('super_admin', 'admin')
    )
  );

COMMIT;
