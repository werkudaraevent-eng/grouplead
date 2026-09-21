-- ============================================================
-- A screen link may carry a QR code to a calendar link.
--
-- The wall shows a QR so a passer-by can open the team's schedule on their
-- own phone. It points at a public calendar link (read-only, revocable on
-- its own), never at the screen link, which is the board's credential. The
-- calendar link is made together with the screen link, with the same
-- client-name masking, and its plaintext is kept on the screen row: this is
-- the one token whose secrecy is moot by design, because the screen prints
-- it on a wall as a QR. Revoking the calendar row (its hash) removes the QR;
-- revoking the screen row revokes its calendar row too.
-- ============================================================

ALTER TABLE sales_mission.board_tokens
  ADD COLUMN IF NOT EXISTS qr_calendar_token_id uuid REFERENCES sales_mission.board_tokens(id),
  ADD COLUMN IF NOT EXISTS qr_calendar_token text;

COMMENT ON COLUMN sales_mission.board_tokens.qr_calendar_token_id IS
  'Screen links only: the calendar link (kind = calendar) shown as a QR on the wall. Null when the screen has no QR.';
COMMENT ON COLUMN sales_mission.board_tokens.qr_calendar_token IS
  'Plaintext of that calendar token, so the screen can draw the QR. Published on the wall by design; validity is still decided by the calendar row it points to.';

NOTIFY pgrst, 'reload schema';
