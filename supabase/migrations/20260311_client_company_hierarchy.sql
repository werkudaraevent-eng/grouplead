-- ============================================================
-- MIGRATION: Self-referencing Client Company Hierarchy
-- Adds parent_id for Holding → Division relationships
-- ============================================================

-- Add self-referencing parent_id column
ALTER TABLE public.client_companies
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.client_companies(id) ON DELETE SET NULL;

-- Index for efficient hierarchy lookups
CREATE INDEX IF NOT EXISTS idx_client_companies_parent ON public.client_companies(parent_id);
