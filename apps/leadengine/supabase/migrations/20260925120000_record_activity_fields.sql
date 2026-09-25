-- ============================================================
-- A contact's and a company's activity: typed fields, and row security
-- scoped like the record it belongs to.
--
-- 1. Columns. The record pages' composer logs a call (its outcome), a
--    meeting (in person with a location, or online with a link), an email
--    (its subject) and a follow-up (a title, a due date, who it is assigned
--    to, and who marked it done and when). Every column is nullable: the
--    audit triggers, file uploads and Sales Activity's visits keep writing
--    the rows they always wrote, and the app validates each kind (zod, in
--    `lib/record-activity.ts`) rather than the database. `action_type`
--    stays the kind: the app writes 'call', 'meeting', 'email' and
--    'follow_up' and still reads the older 'Call', 'Meeting', 'Email',
--    'Task' and 'Note'. `occurred_at` is when it happened, which the person
--    chooses; existing rows take `created_at`.
--
-- 2. Row security. The four tables let any signed-in person read and write
--    every row (USING true / WITH CHECK true), whatever business unit the
--    contact or company belongs to. Now a row is visible, and may be added,
--    exactly when its contact or client company is visible to the person:
--    the policy asks `contacts` / `client_companies` through their own row
--    security (`contacts_select_v2`, `client_companies_select_v2`: the unit
--    in fn_user_company_ids(), holding access, a record with no unit, or a
--    trashed one for an admin), so the two stay the same rule. A row is
--    changed or deleted by its author or an admin (fn_user_is_admin()),
--    and only the kinds a person logs; the rows the database and the app
--    write for themselves (a field changed, a note's copy, a file, a Sales
--    Activity visit) are history and nobody edits them. The person a
--    follow-up is assigned to may tick it done or reopen it, and nothing
--    else (the trigger below).
--
--    The audit triggers (audit_contact_changes, audit_contact_notes,
--    audit_company_changes, audit_company_notes) and
--    fn_merge_client_companies are SECURITY DEFINER, owned by the role that
--    owns these tables, so row security does not apply to their inserts and
--    updates; they keep working unchanged.
-- ============================================================

BEGIN;

-- ── 1. Columns ──────────────────────────────────────────────────────────────

ALTER TABLE public.contact_activities
  ADD COLUMN IF NOT EXISTS occurred_at  timestamptz,
  ADD COLUMN IF NOT EXISTS outcome      text,
  ADD COLUMN IF NOT EXISTS meeting_mode text,
  ADD COLUMN IF NOT EXISTS location     text,
  ADD COLUMN IF NOT EXISTS meeting_url  text,
  ADD COLUMN IF NOT EXISTS subject      text,
  ADD COLUMN IF NOT EXISTS due_at       timestamptz,
  ADD COLUMN IF NOT EXISTS assignee_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at   timestamptz;

ALTER TABLE public.company_activities
  ADD COLUMN IF NOT EXISTS occurred_at  timestamptz,
  ADD COLUMN IF NOT EXISTS outcome      text,
  ADD COLUMN IF NOT EXISTS meeting_mode text,
  ADD COLUMN IF NOT EXISTS location     text,
  ADD COLUMN IF NOT EXISTS meeting_url  text,
  ADD COLUMN IF NOT EXISTS subject      text,
  ADD COLUMN IF NOT EXISTS due_at       timestamptz,
  ADD COLUMN IF NOT EXISTS assignee_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at   timestamptz;

ALTER TABLE public.contact_activities DROP CONSTRAINT IF EXISTS contact_activities_meeting_mode_check;
ALTER TABLE public.contact_activities ADD CONSTRAINT contact_activities_meeting_mode_check
  CHECK (meeting_mode IS NULL OR meeting_mode IN ('in_person', 'online'));
ALTER TABLE public.company_activities DROP CONSTRAINT IF EXISTS company_activities_meeting_mode_check;
ALTER TABLE public.company_activities ADD CONSTRAINT company_activities_meeting_mode_check
  CHECK (meeting_mode IS NULL OR meeting_mode IN ('in_person', 'online'));

COMMENT ON COLUMN public.contact_activities.occurred_at IS 'When it happened, as the person logged it; NULL on rows the database or the app wrote (read created_at).';
COMMENT ON COLUMN public.contact_activities.outcome IS 'A call''s outcome: connected, no_answer, busy, call_back (validated in the app).';
COMMENT ON COLUMN public.contact_activities.subject IS 'An email''s subject, or a follow-up''s title.';
COMMENT ON COLUMN public.contact_activities.due_at IS 'A follow-up''s due day (noon, local); open while completed_at is NULL.';
COMMENT ON COLUMN public.company_activities.occurred_at IS 'When it happened, as the person logged it; NULL on rows the database or the app wrote (read created_at).';
COMMENT ON COLUMN public.company_activities.outcome IS 'A call''s outcome: connected, no_answer, busy, call_back (validated in the app).';
COMMENT ON COLUMN public.company_activities.subject IS 'An email''s subject, or a follow-up''s title.';
COMMENT ON COLUMN public.company_activities.due_at IS 'A follow-up''s due day (noon, local); open while completed_at is NULL.';

-- Every existing row happened when it was written.
UPDATE public.contact_activities SET occurred_at = created_at WHERE occurred_at IS NULL;
UPDATE public.company_activities SET occurred_at = created_at WHERE occurred_at IS NULL;

-- A record's page reads its rows by record, and every policy below looks
-- the record up by its id.
CREATE INDEX IF NOT EXISTS contact_activities_contact_id_idx ON public.contact_activities (contact_id, created_at DESC);
CREATE INDEX IF NOT EXISTS company_activities_client_company_id_idx ON public.company_activities (client_company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS contact_notes_contact_id_idx ON public.contact_notes (contact_id);
CREATE INDEX IF NOT EXISTS company_notes_client_company_id_idx ON public.company_notes (client_company_id);

-- ── 2. Who changed it, and what an assignee may change ──────────────────────
-- Runs as the caller. Guards only a person's own request (the
-- `authenticated` role): the SECURITY DEFINER triggers and the merge, which
-- run as the table owner, pass through untouched.

CREATE OR REPLACE FUNCTION public.fn_record_activity_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.updated_at := now();
  END IF;

  IF current_user <> 'authenticated' THEN
    RETURN NEW;
  END IF;

  -- Who marked a follow-up done is whoever marks it, never a value sent.
  IF TG_OP = 'INSERT' OR NEW.completed_at IS DISTINCT FROM OLD.completed_at THEN
    NEW.completed_by := CASE WHEN NEW.completed_at IS NULL THEN NULL ELSE auth.uid() END;
  ELSE
    NEW.completed_by := OLD.completed_by;
  END IF;

  -- The person a follow-up is assigned to, when they neither wrote it nor
  -- are an admin, may tick it done or reopen it, and change nothing else.
  IF TG_OP = 'UPDATE'
     AND OLD.user_id IS DISTINCT FROM auth.uid()
     AND NOT public.fn_user_is_admin()
     AND (to_jsonb(NEW) - ARRAY['completed_at', 'completed_by', 'updated_at'])
         IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['completed_at', 'completed_by', 'updated_at'])
  THEN
    RAISE EXCEPTION 'Only the author or an admin can change this activity'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contact_activities_write ON public.contact_activities;
CREATE TRIGGER contact_activities_write
  BEFORE INSERT OR UPDATE ON public.contact_activities
  FOR EACH ROW EXECUTE FUNCTION public.fn_record_activity_write();

DROP TRIGGER IF EXISTS company_activities_write ON public.company_activities;
CREATE TRIGGER company_activities_write
  BEFORE INSERT OR UPDATE ON public.company_activities
  FOR EACH ROW EXECUTE FUNCTION public.fn_record_activity_write();

-- The kinds a person logs, which a person may change or delete: never a
-- row the database or the app wrote (a field changed, a note's copy, a
-- file, a Sales Activity visit, which carries its mission in field_name).
CREATE OR REPLACE FUNCTION public.fn_record_activity_is_logged(p_action_type text, p_field_name text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_field_name IS NULL
     AND lower(coalesce(p_action_type, '')) IN ('call', 'email', 'meeting', 'task', 'follow_up')
$$;

-- ── 3. Row security ─────────────────────────────────────────────────────────
-- Every policy on the four tables goes, whatever it is called: the names
-- in the repository ("Allow all select", "Allow all insert", "Enable read
-- access for authenticated users", "Enable insert access for authenticated
-- users", "Enable delete access for the author", "Authenticated users can
-- read / insert / update own / delete own contact notes" and the company
-- notes' four) and any added by hand, so no USING (true) survives beside
-- the new ones (permissive policies are OR'd together).

DO $$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('contact_activities', 'company_activities', 'contact_notes', 'company_notes')
  LOOP
    RAISE NOTICE 'Dropping policy "%" on public.%', p.policyname, p.tablename;
    EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
END;
$$;

ALTER TABLE public.contact_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_notes ENABLE ROW LEVEL SECURITY;

-- The EXISTS reads the parent under the caller's own row security, so "can
-- see the contact" means here exactly what it means on the contact.

-- contact_activities
CREATE POLICY contact_activities_select ON public.contact_activities
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.contacts c WHERE c.id = contact_activities.contact_id));

CREATE POLICY contact_activities_insert ON public.contact_activities
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.contacts c WHERE c.id = contact_activities.contact_id)
  );

CREATE POLICY contact_activities_update ON public.contact_activities
  FOR UPDATE TO authenticated
  USING (
    public.fn_record_activity_is_logged(action_type, field_name)
    AND (
      user_id = auth.uid()
      OR public.fn_user_is_admin()
      OR (assignee_id = auth.uid() AND lower(action_type) = 'follow_up')
    )
    AND EXISTS (SELECT 1 FROM public.contacts c WHERE c.id = contact_activities.contact_id)
  )
  WITH CHECK (
    public.fn_record_activity_is_logged(action_type, field_name)
    AND (
      user_id = auth.uid()
      OR public.fn_user_is_admin()
      OR (assignee_id = auth.uid() AND lower(action_type) = 'follow_up')
    )
    AND EXISTS (SELECT 1 FROM public.contacts c WHERE c.id = contact_activities.contact_id)
  );

CREATE POLICY contact_activities_delete ON public.contact_activities
  FOR DELETE TO authenticated
  USING (
    public.fn_record_activity_is_logged(action_type, field_name)
    AND (user_id = auth.uid() OR public.fn_user_is_admin())
    AND EXISTS (SELECT 1 FROM public.contacts c WHERE c.id = contact_activities.contact_id)
  );

-- company_activities (client_companies: the CRM's customer organisations,
-- never the tenant's own `companies`)
CREATE POLICY company_activities_select ON public.company_activities
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.client_companies cc WHERE cc.id = company_activities.client_company_id));

CREATE POLICY company_activities_insert ON public.company_activities
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.client_companies cc WHERE cc.id = company_activities.client_company_id)
  );

CREATE POLICY company_activities_update ON public.company_activities
  FOR UPDATE TO authenticated
  USING (
    public.fn_record_activity_is_logged(action_type, field_name)
    AND (
      user_id = auth.uid()
      OR public.fn_user_is_admin()
      OR (assignee_id = auth.uid() AND lower(action_type) = 'follow_up')
    )
    AND EXISTS (SELECT 1 FROM public.client_companies cc WHERE cc.id = company_activities.client_company_id)
  )
  WITH CHECK (
    public.fn_record_activity_is_logged(action_type, field_name)
    AND (
      user_id = auth.uid()
      OR public.fn_user_is_admin()
      OR (assignee_id = auth.uid() AND lower(action_type) = 'follow_up')
    )
    AND EXISTS (SELECT 1 FROM public.client_companies cc WHERE cc.id = company_activities.client_company_id)
  );

CREATE POLICY company_activities_delete ON public.company_activities
  FOR DELETE TO authenticated
  USING (
    public.fn_record_activity_is_logged(action_type, field_name)
    AND (user_id = auth.uid() OR public.fn_user_is_admin())
    AND EXISTS (SELECT 1 FROM public.client_companies cc WHERE cc.id = company_activities.client_company_id)
  );

-- contact_notes
CREATE POLICY contact_notes_select ON public.contact_notes
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.contacts c WHERE c.id = contact_notes.contact_id));

CREATE POLICY contact_notes_insert ON public.contact_notes
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.contacts c WHERE c.id = contact_notes.contact_id)
  );

CREATE POLICY contact_notes_update ON public.contact_notes
  FOR UPDATE TO authenticated
  USING (
    (user_id = auth.uid() OR public.fn_user_is_admin())
    AND EXISTS (SELECT 1 FROM public.contacts c WHERE c.id = contact_notes.contact_id)
  )
  WITH CHECK (
    (user_id = auth.uid() OR public.fn_user_is_admin())
    AND EXISTS (SELECT 1 FROM public.contacts c WHERE c.id = contact_notes.contact_id)
  );

CREATE POLICY contact_notes_delete ON public.contact_notes
  FOR DELETE TO authenticated
  USING (
    (user_id = auth.uid() OR public.fn_user_is_admin())
    AND EXISTS (SELECT 1 FROM public.contacts c WHERE c.id = contact_notes.contact_id)
  );

-- company_notes
CREATE POLICY company_notes_select ON public.company_notes
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.client_companies cc WHERE cc.id = company_notes.client_company_id));

CREATE POLICY company_notes_insert ON public.company_notes
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.client_companies cc WHERE cc.id = company_notes.client_company_id)
  );

CREATE POLICY company_notes_update ON public.company_notes
  FOR UPDATE TO authenticated
  USING (
    (user_id = auth.uid() OR public.fn_user_is_admin())
    AND EXISTS (SELECT 1 FROM public.client_companies cc WHERE cc.id = company_notes.client_company_id)
  )
  WITH CHECK (
    (user_id = auth.uid() OR public.fn_user_is_admin())
    AND EXISTS (SELECT 1 FROM public.client_companies cc WHERE cc.id = company_notes.client_company_id)
  );

CREATE POLICY company_notes_delete ON public.company_notes
  FOR DELETE TO authenticated
  USING (
    (user_id = auth.uid() OR public.fn_user_is_admin())
    AND EXISTS (SELECT 1 FROM public.client_companies cc WHERE cc.id = company_notes.client_company_id)
  );

COMMIT;

NOTIFY pgrst, 'reload schema';
