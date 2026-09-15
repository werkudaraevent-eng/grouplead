-- ============================================================
-- "Industri" on the prospect form becomes a dropdown the admin owns,
-- like "Jenis mission". Tenants seeded this morning have it as free text;
-- flip the type and hand them the starting list. prospects.industry stays
-- a text column, so nothing already stored is touched.
-- ============================================================

BEGIN;

UPDATE sales_mission.form_fields
SET field_type = 'SELECT',
    options = CASE
      WHEN options IS NULL OR jsonb_array_length(options) = 0 THEN
        '["Farmasi & kesehatan", "Perbankan & keuangan", "Asuransi", "Pemerintahan", "BUMN", "Telekomunikasi", "Teknologi", "Manufaktur", "Otomotif", "FMCG", "Pendidikan", "Properti & konstruksi", "Energi & pertambangan", "Logistik & transportasi", "Media & hiburan", "Retail", "Pariwisata & perhotelan", "Lainnya"]'::jsonb
      ELSE options
    END,
    updated_at = timezone('utc', now())
WHERE form_key = 'prospect'
  AND reporting_key = 'industry'
  AND is_core
  AND field_type = 'TEXT';

NOTIFY pgrst, 'reload schema';

COMMIT;
