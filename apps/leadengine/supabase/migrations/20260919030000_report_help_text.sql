-- Two helper lines on the visit report form said more than they needed to:
-- "Ketemu siapa" justified itself ("Ini yang memperkaya database kontak"),
-- and "Ada peluang" repeated in its helper what its checkbox now says
-- ("Kirim sebagai lead ke LeadEngine setelah laporan terkirim").
--
-- The seed in lib/missions/form-fields.ts is trimmed for units seeded from
-- now on; this brings units seeded earlier along. Idempotent, and only rows
-- still carrying the seed's exact wording change: an admin's own wording in
-- Pengaturan → Form laporan is theirs and stays.

UPDATE sales_mission.form_fields
SET help_text = 'Minimal satu orang, kecuali klien tidak ada.'
WHERE form_key = 'visit_report'
  AND reporting_key = 'contacts_met'
  AND help_text = 'Minimal satu orang, kecuali klien tidak ada. Ini yang memperkaya database kontak.';

UPDATE sales_mission.form_fields
SET help_text = NULL
WHERE form_key = 'visit_report'
  AND reporting_key = 'opportunity_exists'
  AND help_text = 'Bisa dikirim ke LeadEngine setelah laporan terkirim.';
