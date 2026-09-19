-- DISC communication style on report contacts.
--
-- The team's sales training teaches DISC as a way to read a client and adjust
-- the approach. A rep records their estimate after a meeting on the contact
-- they met: a primary letter, an optional secondary one, and a line in their
-- own words. Who assessed it and when is kept on the row, because a reading
-- is one person's impression, not a fact about the contact. Optional, and
-- switched on per unit (default off) so a team that did not train on it
-- never sees the chips.

BEGIN;

ALTER TABLE sales_mission.report_contacts
  ADD COLUMN IF NOT EXISTS disc_primary text
    CHECK (disc_primary IS NULL OR disc_primary IN ('D', 'I', 'S', 'C')),
  ADD COLUMN IF NOT EXISTS disc_secondary text
    CHECK (disc_secondary IS NULL OR disc_secondary IN ('D', 'I', 'S', 'C')),
  ADD COLUMN IF NOT EXISTS disc_note text
    CHECK (disc_note IS NULL OR char_length(disc_note) <= 300),
  ADD COLUMN IF NOT EXISTS disc_assessed_by uuid,
  ADD COLUMN IF NOT EXISTS disc_assessed_by_name text,
  ADD COLUMN IF NOT EXISTS disc_assessed_at timestamptz;

-- A secondary needs a primary and must differ from it.
ALTER TABLE sales_mission.report_contacts
  DROP CONSTRAINT IF EXISTS report_contacts_disc_pair_check;
ALTER TABLE sales_mission.report_contacts
  ADD CONSTRAINT report_contacts_disc_pair_check CHECK (
    disc_secondary IS NULL OR (disc_primary IS NOT NULL AND disc_secondary <> disc_primary)
  );

COMMENT ON COLUMN sales_mission.report_contacts.disc_primary IS
  'DISC letter the rep read as dominant (D/I/S/C). Rep''s estimate after the meeting, optional.';
COMMENT ON COLUMN sales_mission.report_contacts.disc_secondary IS
  'Secondary DISC letter, when the rep saw one; never equal to disc_primary.';
COMMENT ON COLUMN sales_mission.report_contacts.disc_note IS
  'How to approach this person, in the rep''s words. Max 300 characters.';
COMMENT ON COLUMN sales_mission.report_contacts.disc_assessed_by_name IS
  'Display name of the rep who made the reading, frozen at save time so it survives a renamed account.';

ALTER TABLE sales_mission.mission_settings
  ADD COLUMN IF NOT EXISTS contact_disc_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN sales_mission.mission_settings.contact_disc_enabled IS
  'Whether the visit report offers DISC chips on each contact met. Off until the unit trained on it.';

COMMIT;

NOTIFY pgrst, 'reload schema';
