-- =====================================================================
-- MIGRATION: Contact Attachments (storage bucket + metadata table)
-- Mirrors company_attachments (see 20260619060000) so the contact
-- detail page can attach business cards, ID scans and supporting
-- documents. Files are organised as `{contactId}/{uuid}-{filename}`.
-- =====================================================================

-- 1. Storage bucket (idempotent, public read)
INSERT INTO storage.buckets (id, name, public)
VALUES ('contact_attachments', 'contact_attachments', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Storage object policies (authenticated CRUD on this bucket only)
CREATE POLICY "contact_attachments_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'contact_attachments');

CREATE POLICY "contact_attachments_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'contact_attachments');

CREATE POLICY "contact_attachments_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'contact_attachments');

CREATE POLICY "contact_attachments_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'contact_attachments');

-- 3. Metadata table
CREATE TABLE IF NOT EXISTS public.contact_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    -- Storage path inside the contact_attachments bucket. Organised as
    -- `{contactId}/{uuid}-{filename}` so deleting a contact can drop its
    -- entire object subtree.
    storage_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL DEFAULT 0,
    mime_type TEXT,
    description TEXT,
    uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    uploaded_by_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT contact_attachments_unique_path UNIQUE (storage_path)
);

CREATE INDEX IF NOT EXISTS idx_contact_attachments_contact_id
    ON public.contact_attachments(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_attachments_uploader
    ON public.contact_attachments(uploaded_by);

ALTER TABLE public.contact_attachments ENABLE ROW LEVEL SECURITY;

-- Read: any authenticated user (RLS on contacts is the real gate).
CREATE POLICY "contact_attachments_select"
    ON public.contact_attachments FOR SELECT USING (true);

-- Insert: any authenticated user (matches storage policy).
CREATE POLICY "contact_attachments_insert"
    ON public.contact_attachments FOR INSERT WITH CHECK (true);

-- Update / Delete: only the uploader (or legacy null uploader rows).
CREATE POLICY "contact_attachments_update"
    ON public.contact_attachments FOR UPDATE
    USING (uploaded_by IS NULL OR uploaded_by = auth.uid());

CREATE POLICY "contact_attachments_delete"
    ON public.contact_attachments FOR DELETE
    USING (uploaded_by IS NULL OR uploaded_by = auth.uid());
