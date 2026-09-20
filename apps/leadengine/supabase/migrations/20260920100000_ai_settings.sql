-- AI connection settings, shared by LeadEngine and Sales Activity.
--
-- One proxy serves both apps, so its endpoint, models and key live in one
-- place and are set from either app's settings page. The endpoint and the
-- model names are plain columns; the API key is a Vault secret, referenced by
-- id and only ever read by the two SECURITY DEFINER functions below, which
-- are callable by the service role alone. A browser session can read the
-- row (it holds nothing secret: the key is shown as its last four characters)
-- and can update it only with the settings grant in one of its companies.
--
-- Until this row is filled, both apps fall back to the AI_* environment
-- variables, so nothing breaks on deploy.

BEGIN;

CREATE EXTENSION IF NOT EXISTS supabase_vault;

CREATE TABLE IF NOT EXISTS public.ai_settings (
  id integer PRIMARY KEY DEFAULT 1,
  -- Base URL of an OpenAI-compatible endpoint, including its version path (…/v1).
  endpoint text NOT NULL DEFAULT '',
  model_fast text,
  model_reasoning text,
  -- vault.secrets.id of the API key; null until a key is stored.
  key_secret_id uuid,
  -- Last four characters of the key, so the form can say which key is stored.
  key_hint text,
  -- What GET /models returned at the last successful test, for the model pickers.
  models jsonb NOT NULL DEFAULT '[]'::jsonb,
  tested_at timestamptz,
  test_ok boolean,
  test_error text,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_settings_singleton CHECK (id = 1)
);

INSERT INTO public.ai_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_settings_select ON public.ai_settings;
CREATE POLICY ai_settings_select ON public.ai_settings
  FOR SELECT TO authenticated USING (true);

-- Writable with the settings grant (LeadEngine) or the Sales Activity settings
-- grant in any company the person belongs to. Super admins pass inside the
-- helper.
DROP POLICY IF EXISTS ai_settings_write ON public.ai_settings;
CREATE POLICY ai_settings_write ON public.ai_settings
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM unnest(public.fn_user_company_ids()) AS c(company_id)
      WHERE public.fn_user_has_matrix_permission(c.company_id, 'settings', 'update')
         OR public.fn_user_has_matrix_permission(c.company_id, 'sales_mission_settings', 'update')
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND lower(replace(coalesce(p.role, ''), ' ', '_')) = 'super_admin'
    )
  )
  WITH CHECK (true);

-- Store (or replace) the key. Service role only: the app checks the person's
-- grant first, then calls this with its service client.
CREATE OR REPLACE FUNCTION public.fn_ai_store_key(p_key text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT key_secret_id INTO v_id FROM public.ai_settings WHERE id = 1;
  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM vault.secrets WHERE name = 'ai_proxy_key' LIMIT 1;
  END IF;
  IF v_id IS NULL THEN
    v_id := vault.create_secret(p_key, 'ai_proxy_key', 'API key for the AI proxy, set from the app settings');
  ELSE
    PERFORM vault.update_secret(v_id, p_key);
  END IF;
  UPDATE public.ai_settings
     SET key_secret_id = v_id,
         key_hint = right(p_key, 4)
   WHERE id = 1;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_ai_store_key(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_ai_store_key(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ai_store_key(text) TO service_role;

-- Read the key. Service role only, for the same reason.
CREATE OR REPLACE FUNCTION public.fn_ai_read_key()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, vault
AS $$
  SELECT s.decrypted_secret
  FROM public.ai_settings a
  JOIN vault.decrypted_secrets s ON s.id = a.key_secret_id
  WHERE a.id = 1
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.fn_ai_read_key() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_ai_read_key() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ai_read_key() TO service_role;

COMMENT ON TABLE public.ai_settings IS 'AI proxy connection shared by LeadEngine and Sales Activity. The key is in Vault; see fn_ai_store_key / fn_ai_read_key.';

COMMIT;

NOTIFY pgrst, 'reload schema';
