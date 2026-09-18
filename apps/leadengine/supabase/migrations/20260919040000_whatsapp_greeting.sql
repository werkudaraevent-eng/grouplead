-- ============================================================
-- The unit's WhatsApp opening line.
--
-- "Hubungi → WhatsApp" on a prospect opens the chat with a first message
-- filled in. The admin may word it for the unit (Pengaturan → Aktivitas →
-- Prospek) with {sapaan}, {kontak}, {sales} and {perusahaan} as
-- placeholders; NULL means the app's default line.
-- ============================================================

BEGIN;

ALTER TABLE sales_mission.mission_settings
  ADD COLUMN IF NOT EXISTS whatsapp_greeting text;

COMMENT ON COLUMN sales_mission.mission_settings.whatsapp_greeting IS
  'Opening line for a WhatsApp chat started from a prospect; placeholders {sapaan} {kontak} {sales} {perusahaan}. NULL = the app default.';

NOTIFY pgrst, 'reload schema';

COMMIT;
