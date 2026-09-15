-- ============================================================
-- Photos on forms: a PHOTO field type, and a private bucket for the files.
--
-- Objects live under <company_id>/<scope>/<uuid>.jpg, and every policy
-- reads the company from the first folder, so a tenant only ever touches
-- its own files. The app hands out signed upload and read URLs; nothing is
-- public.
-- ============================================================

BEGIN;

ALTER TABLE sales_mission.form_fields DROP CONSTRAINT IF EXISTS form_fields_type_check;
ALTER TABLE sales_mission.form_fields ADD CONSTRAINT form_fields_type_check CHECK (field_type IN (
  'TEXT', 'LONG_TEXT', 'NUMBER', 'CURRENCY', 'DATE', 'TIME', 'SELECT', 'MULTI_SELECT', 'BOOLEAN', 'CONTACTS', 'PHOTO'
));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('sales_mission_photos', 'sales_mission_photos', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- The company folder decides. The shape check keeps the uuid cast from
-- throwing on some other bucket's path.
CREATE OR REPLACE FUNCTION sales_mission.photo_path_allowed(p_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = sales_mission, public
AS $$
  SELECT CASE
    WHEN (storage.foldername(p_name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN sales_mission.user_has_company_access(((storage.foldername(p_name))[1])::uuid)
    ELSE false
  END
$$;

GRANT EXECUTE ON FUNCTION sales_mission.photo_path_allowed(text) TO authenticated;

DROP POLICY IF EXISTS sales_mission_photos_select ON storage.objects;
DROP POLICY IF EXISTS sales_mission_photos_insert ON storage.objects;
DROP POLICY IF EXISTS sales_mission_photos_update ON storage.objects;
DROP POLICY IF EXISTS sales_mission_photos_delete ON storage.objects;
CREATE POLICY sales_mission_photos_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'sales_mission_photos' AND sales_mission.photo_path_allowed(name));
CREATE POLICY sales_mission_photos_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'sales_mission_photos' AND sales_mission.photo_path_allowed(name));
CREATE POLICY sales_mission_photos_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'sales_mission_photos' AND sales_mission.photo_path_allowed(name));
CREATE POLICY sales_mission_photos_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'sales_mission_photos' AND sales_mission.photo_path_allowed(name));

NOTIFY pgrst, 'reload schema';

COMMIT;
