-- ============================================================
-- Whether a screen link may show client names.
--
-- Masking used to be decided by which page rendered the board: the TV route
-- always masked, the workspace route never did. Now that a screen link can
-- carry display options in its URL, the one option that matters for privacy
-- must not be in the URL, where anyone holding the link could flip it. It is
-- bound to the token at creation, by the admin who made it, and cannot be
-- changed afterwards without making a new link.
-- ============================================================

ALTER TABLE sales_mission.board_tokens
  ADD COLUMN IF NOT EXISTS show_client_names boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN sales_mission.board_tokens.show_client_names IS
  'When false the screen masks client names (PT A•••). Set at creation; a screen in an open office should keep it false.';
