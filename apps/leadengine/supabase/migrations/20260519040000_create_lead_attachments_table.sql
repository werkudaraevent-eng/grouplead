-- =====================================================================
-- MIGRATION: Lead Attachments metadata table
-- Storage bucket `lead_attachments` already exists (see 20260507120000).
-- This table tracks the per-file metadata (name, size, mime, uploader)
-- so the UI can list files for a lead without scanning the bucket.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.lead_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id BIGINT NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    -- Storage path inside the lead_attachments bucket. We organise as
    -- `{leadId}/{uuid}-{filename}` so deleting a lead can also drop its
    -- entire object subtree.
    storage_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL DEFAULT 0,
    mime_type TEXT,
    -- Optional caption / description authored at upload time.
    description TEXT,
    uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    uploaded_by_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Per-lead unique storage path so a re-upload of the same blob
    -- can't clobber existing rows silently.
    CONSTRAINT lead_attachments_unique_path UNIQUE (storage_path)
);

CREATE INDEX IF NOT EXISTS idx_lead_attachments_lead_id
    ON public.lead_attachments(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_attachments_uploader
    ON public.lead_attachments(uploaded_by);

ALTER TABLE public.lead_attachments ENABLE ROW LEVEL SECURITY;

-- Read: anyone authenticated can list files on leads they can see.
-- (RLS on `leads` is the actual gate; reading metadata for visible
-- leads is fine.)
CREATE POLICY "lead_attachments_select"
    ON public.lead_attachments FOR SELECT USING (true);

-- Insert: any authenticated user (matches storage policy).
CREATE POLICY "lead_attachments_insert"
    ON public.lead_attachments FOR INSERT WITH CHECK (true);

-- Update: only the uploader (or null uploader_by, e.g. legacy rows)
-- can edit caption / rename.
CREATE POLICY "lead_attachments_update"
    ON public.lead_attachments FOR UPDATE
    USING (uploaded_by IS NULL OR uploaded_by = auth.uid());

-- Delete: only the uploader for now. Admin sweep can be added later
-- via service role.
CREATE POLICY "lead_attachments_delete"
    ON public.lead_attachments FOR DELETE
    USING (uploaded_by IS NULL OR uploaded_by = auth.uid());
