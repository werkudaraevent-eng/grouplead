-- ============================================================
-- Whether a screen link may show visit outcomes.
--
-- A reported visit has an outcome ("Bertemu pengambil keputusan", "Klien
-- tidak ada"). On the wall that is the most useful line of the day for the
-- office, and also the most telling one for a visitor reading over a
-- shoulder: together with a client name it is the pipeline. So it follows the
-- same rule as client names: bound to the token by the admin who made the
-- link, never carried in the URL, off by default.
-- ============================================================

ALTER TABLE sales_mission.board_tokens
  ADD COLUMN IF NOT EXISTS show_outcomes boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN sales_mission.board_tokens.show_outcomes IS
  'When true the screen shows the outcome of reported visits on their rows. Set at creation, like show_client_names; a screen in an open office should keep it false.';

NOTIFY pgrst, 'reload schema';
