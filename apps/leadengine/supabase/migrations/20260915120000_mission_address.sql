-- One address block on the mission form.
--
-- City, building and a home-made "Alamat lengkap" custom field sat in three
-- different sections. A street address becomes a core column, the three
-- core fields are ordered the way every global address form orders them
-- (street, building or unit, city), and a tenant's own "alamat" custom
-- field is folded in: its values move to the new column and the field is
-- archived so the form does not ask twice.

BEGIN;

ALTER TABLE sales_mission.missions ADD COLUMN IF NOT EXISTS address text;

-- The core street-address field for every tenant that already has a mission
-- form. New tenants get it from the seed on first use.
INSERT INTO sales_mission.form_fields (company_id, form_key, reporting_key, label, field_type, is_required, is_core, options, display_order)
SELECT DISTINCT f.company_id, 'mission', 'address', 'Alamat jalan', 'TEXT', false, true, '[]'::jsonb, 30
FROM sales_mission.form_fields f
WHERE f.form_key = 'mission'
ON CONFLICT (company_id, form_key, reporting_key) DO NOTHING;

-- Street, then building, then city; purpose moves ahead of the block so the
-- "Kunjungan" card stays one card.
UPDATE sales_mission.form_fields SET display_order = 25 WHERE form_key = 'mission' AND reporting_key = 'objective' AND is_core;
UPDATE sales_mission.form_fields SET display_order = 32 WHERE form_key = 'mission' AND reporting_key = 'building' AND is_core;
UPDATE sales_mission.form_fields SET display_order = 34 WHERE form_key = 'mission' AND reporting_key = 'location' AND is_core;
UPDATE sales_mission.form_fields SET label = 'Kota' WHERE form_key = 'mission' AND reporting_key = 'location' AND is_core AND label = 'Lokasi';
UPDATE sales_mission.form_fields SET label = 'Gedung / lantai / unit' WHERE form_key = 'mission' AND reporting_key = 'building' AND is_core AND label = 'Gedung / lantai';

-- Fold in a tenant's own address field: a non-core text field whose label
-- says "alamat". Values move to the column where the column is still empty;
-- the field is archived, not deleted, so its answers stay readable.
WITH own AS (
  SELECT id, company_id
  FROM sales_mission.form_fields
  WHERE form_key = 'mission' AND NOT is_core AND is_active
    AND field_type IN ('TEXT', 'LONG_TEXT')
    AND label ILIKE '%alamat%'
),
moved AS (
  UPDATE sales_mission.missions m
  SET address = btrim(v.value #>> '{}')
  FROM sales_mission.mission_field_values v
  JOIN own ON own.id = v.field_id
  WHERE v.mission_id = m.id
    AND (m.address IS NULL OR btrim(m.address) = '')
    AND jsonb_typeof(v.value) = 'string'
    AND btrim(v.value #>> '{}') <> ''
  RETURNING m.id
)
UPDATE sales_mission.form_fields f
SET is_active = false
FROM own
WHERE f.id = own.id;

COMMIT;

NOTIFY pgrst, 'reload schema';
