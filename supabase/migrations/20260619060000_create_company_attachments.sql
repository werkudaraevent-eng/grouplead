-- =====================================================================
-- MIGRATION: Company Attachments (storage bucket + metadata table)
-- Mirrors the lead_attachments design (see 20260519040000) so the
-- company detail page can attach contracts, proposals and supporting
-- documents. Files are organised as `{companyId}/{uuid}-{filename}`.
-- =====================================================================

-- 1. Storage bucket (idempotent, public read like lead_attachments)
INSERT INTO storage.buckets (id, name, public)
VALUES ('company_attachments', 'company_attachments', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Storage object policies (authenticated CRUD on this bucket only)
CREATE POLICY "company_attachments_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'company_attachments');

CREATE POLICY "company_attachments_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'company_attachments');

CREATE POLICY "company_attachments_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'company_attachments');

CREATE POLICY "company_attachments_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'company_attachments');

-- 3. Metadata table
CREATE TABLE IF NOT EXISTS public.company_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_company_id UUID NOT NULL REFERENCES public.client_companies(id) ON DELETE CASCADE,
    -- Storage path inside the company_attachments bucket. Organised as
    -- `{companyId}/{uuid}-{filename}` so deleting a company can drop its
    -- entire object subtree.
    storage_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL DEFAULT 0,
    mime_type TEXT,
    description TEXT,
    uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    uploaded_by_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT company_attachments_unique_path UNIQUE (storage_path)
);

CREATE INDEX IF NOT EXISTS idx_company_attachments_company_id
    ON public.company_attachments(client_company_id);
CREATE INDEX IF NOT EXISTS idx_company_attachments_uploader
    ON public.company_attachments(uploaded_by);

ALTER TABLE public.company_attachments ENABLE ROW LEVEL SECURITY;

-- Read: any authenticated user (RLS on client_companies is the real gate).
CREATE POLICY "company_attachments_select"
    ON public.company_attachments FOR SELECT USING (true);

-- Insert: any authenticated user (matches storage policy).
CREATE POLICY "company_attachments_insert"
    ON public.company_attachments FOR INSERT WITH CHECK (true);

-- Update / Delete: only the uploader (or legacy null uploader rows).
CREATE POLICY "company_attachments_update"
    ON public.company_attachments FOR UPDATE
    USING (uploaded_by IS NULL OR uploaded_by = auth.uid());

CREATE POLICY "company_attachments_delete"
    ON public.company_attachments FOR DELETE
    USING (uploaded_by IS NULL OR uploaded_by = auth.uid());
