-- ============================================================
-- Recordings on forms: an AUDIO field type, and a private bucket for the files.
--
-- The phone records the meeting (Memo Suara); the report keeps the file.
-- Objects live under <company_id>/<scope>/<uuid>.m4a, the same shape as
-- photos, so the same folder check decides access: a unit only ever
-- touches its own recordings. Signed upload and read URLs; nothing public.
-- The per-file cap matches Supabase's default upload limit (50 MB, about
-- an hour and three quarters of a compressed Voice Memo); raise both if a
-- unit needs longer.
-- ============================================================

BEGIN;

ALTER TABLE sales_mission.form_fields DROP CONSTRAINT IF EXISTS form_fields_type_check;
ALTER TABLE sales_mission.form_fields ADD CONSTRAINT form_fields_type_check CHECK (field_type IN (
  'TEXT', 'LONG_TEXT', 'NUMBER', 'CURRENCY', 'DATE', 'TIME', 'SELECT', 'MULTI_SELECT', 'BOOLEAN', 'CONTACTS', 'PHOTO', 'AUDIO'
));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'sales_mission_audio', 'sales_mission_audio', false, 52428800,
  ARRAY[
    'audio/mp4', 'audio/x-m4a', 'audio/m4a', 'audio/aac', 'audio/mpeg', 'audio/mp3',
    'audio/webm', 'audio/ogg', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/x-caf',
    -- iOS hands a Voice Memo to a web page with no type at all.
    'application/octet-stream'
  ]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS sales_mission_audio_select ON storage.objects;
DROP POLICY IF EXISTS sales_mission_audio_insert ON storage.objects;
DROP POLICY IF EXISTS sales_mission_audio_update ON storage.objects;
DROP POLICY IF EXISTS sales_mission_audio_delete ON storage.objects;
CREATE POLICY sales_mission_audio_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'sales_mission_audio' AND sales_mission.photo_path_allowed(name));
CREATE POLICY sales_mission_audio_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'sales_mission_audio' AND sales_mission.photo_path_allowed(name));
CREATE POLICY sales_mission_audio_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'sales_mission_audio' AND sales_mission.photo_path_allowed(name));
CREATE POLICY sales_mission_audio_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'sales_mission_audio' AND sales_mission.photo_path_allowed(name));

NOTIFY pgrst, 'reload schema';

COMMIT;
