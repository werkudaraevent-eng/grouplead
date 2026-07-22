-- ============================================================
-- Storage Bucket Policies for avatars, company logo, lead_attachments
-- Fixes: "new row violates row-level security policy" on upload
-- ============================================================

-- 1. Ensure buckets exist (idempotent)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public)
VALUES ('company logo', 'company logo', true)
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public)
VALUES ('lead_attachments', 'lead_attachments', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- ============================================================
-- AVATARS bucket policies
-- ============================================================

-- Anyone authenticated can upload their own avatar
CREATE POLICY "avatars_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars');

-- Anyone authenticated can update (upsert) their own avatar
CREATE POLICY "avatars_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars');

-- Public read access for avatars
CREATE POLICY "avatars_select_public" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'avatars');

-- Allow delete own avatar
CREATE POLICY "avatars_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars');

-- ============================================================
-- COMPANY LOGO bucket policies
-- ============================================================

CREATE POLICY "company_logo_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'company logo');

CREATE POLICY "company_logo_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'company logo');

CREATE POLICY "company_logo_select_public" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'company logo');

CREATE POLICY "company_logo_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'company logo');

-- ============================================================
-- LEAD ATTACHMENTS bucket policies
-- ============================================================

CREATE POLICY "lead_attachments_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'lead_attachments');

CREATE POLICY "lead_attachments_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'lead_attachments');

CREATE POLICY "lead_attachments_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'lead_attachments');

CREATE POLICY "lead_attachments_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'lead_attachments');
