-- Access tokens for the TV board.
--
-- A screen in the office cannot log in, so it carries a token in its URL
-- instead. That makes the token a credential sitting in a browser's address bar
-- and history, which shapes every decision here:
--
--  * Only the SHA-256 hash is stored. A leak of this table does not hand anyone
--    a working board URL.
--  * Every token is revocable and can carry an expiry, so a screen that leaves
--    the building can be cut off without a deploy.
--  * The board it opens is read-only and masks client identity. Even a leaked
--    token exposes activity, not the pipeline.

BEGIN;

CREATE TABLE IF NOT EXISTS sales_mission.board_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,

  -- Human label so an admin can tell which screen this belongs to.
  label text NOT NULL,
  token_hash text NOT NULL UNIQUE,

  expires_at timestamptz,
  revoked_at timestamptz,
  last_used_at timestamptz,

  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),

  CONSTRAINT board_tokens_label_not_blank CHECK (length(btrim(label)) > 0)
);

CREATE INDEX IF NOT EXISTS board_tokens_company_idx
  ON sales_mission.board_tokens(company_id, created_at);

ALTER TABLE sales_mission.board_tokens ENABLE ROW LEVEL SECURITY;

-- Admins manage tokens through a normal session. The board route itself reads
-- this table with the service key, because a TV has no session to evaluate RLS
-- against — see the note in lib/board/board-access.ts.
CREATE POLICY board_tokens_select ON sales_mission.board_tokens
  FOR SELECT USING (sales_mission.user_has_company_access(company_id));
CREATE POLICY board_tokens_insert ON sales_mission.board_tokens
  FOR INSERT WITH CHECK (sales_mission.user_has_company_access(company_id));
CREATE POLICY board_tokens_update ON sales_mission.board_tokens
  FOR UPDATE USING (sales_mission.user_has_company_access(company_id))
  WITH CHECK (sales_mission.user_has_company_access(company_id));

-- No DELETE policy: revoking sets revoked_at, so the record of a token having
-- existed — and when it was last used — survives.

COMMIT;
