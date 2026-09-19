-- The recording field's helper now says which Memo Suara quality to use:
-- a first test at Lossless produced 10 MB a minute, which no meeting fits
-- into 50 MB. Units seeded before this wording get the new line; an
-- admin's own wording stays.

UPDATE sales_mission.form_fields
SET help_text = 'Rekam dengan Memo Suara (kualitas Terkompresi, bukan Lossless), lalu unggah di sini. Beri tahu klien bahwa pertemuan direkam.'
WHERE form_key = 'visit_report'
  AND reporting_key = 'visit_audio'
  AND help_text = 'Rekam dengan Memo Suara, lalu unggah di sini. Beri tahu klien bahwa pertemuan direkam.';
