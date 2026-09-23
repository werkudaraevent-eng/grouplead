-- Pengumuman: a switch no longer re-announces.
--
-- announced_at defaulted to now(), and the switch's upsert left it out, so
-- the first time an admin switched a release on or off the row was inserted
-- stamped with that moment. The seen mark in user_hints is keyed on
-- announced_at, so that stamp made the release new again: switching one off
-- and back on showed the Yang baru dialog to everyone who had already closed
-- it, which the settings page promises it will not do. Only Umumkan ulang is
-- meant to do that.
--
-- From now on announced_at is empty until Umumkan ulang sets it, and the app
-- reads an empty one as the release date (lib/announcements/announcements.ts).
--
-- Existing rows are left as they are on purpose. A row stamped by a switch
-- cannot be told apart from one stamped by Umumkan ulang, and clearing a
-- stamp would change the seen key once more, showing the dialog again to
-- everyone who closed it under the current stamp.
BEGIN;

ALTER TABLE sales_mission.release_announcements
  ALTER COLUMN announced_at DROP DEFAULT,
  ALTER COLUMN announced_at DROP NOT NULL;

COMMENT ON COLUMN sales_mission.release_announcements.announced_at IS
  'The last Umumkan ulang; null means never re-announced, and the release date is the stamp.';

COMMIT;

NOTIFY pgrst, 'reload schema';
