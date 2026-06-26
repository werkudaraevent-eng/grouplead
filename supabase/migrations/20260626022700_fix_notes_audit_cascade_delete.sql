-- Fix: deleting a client_company / contact from the Recycle Bin failed with
--   "insert or update on table company_activities violates foreign key
--    constraint company_activities_client_company_id_fkey"
--
-- Root cause: company_notes / contact_notes cascade-delete when their parent
-- is removed. The AFTER DELETE audit trigger then tries to INSERT an activity
-- row referencing the parent that is being deleted in the same statement, so
-- the FK insert fails and the whole delete is rolled back.
--
-- Fix: only log the "Deleted a note" activity when the parent still exists
-- (i.e. a genuine single-note deletion). Skip it during a cascade.

CREATE OR REPLACE FUNCTION public.audit_company_notes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.company_activities
            (client_company_id, user_id, action_type, description)
        VALUES
            (NEW.client_company_id, NEW.user_id, 'note', 'Added a note: "' || left(NEW.content, 100) || CASE WHEN length(NEW.content) > 100 THEN '...' ELSE '' END || '"');
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        -- Skip when the parent company is gone (cascade delete), otherwise the
        -- FK insert into company_activities fails.
        IF EXISTS (SELECT 1 FROM public.client_companies WHERE id = OLD.client_company_id) THEN
            INSERT INTO public.company_activities
                (client_company_id, user_id, action_type, description)
            VALUES
                (OLD.client_company_id, auth.uid(), 'delete', 'Deleted a note');
        END IF;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.audit_contact_notes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.contact_activities
            (contact_id, user_id, action_type, description)
        VALUES
            (NEW.contact_id, NEW.user_id, 'note', 'Added a note: "' || left(NEW.content, 100) || CASE WHEN length(NEW.content) > 100 THEN '...' ELSE '' END || '"');
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        -- Skip when the parent contact is gone (cascade delete), otherwise the
        -- FK insert into contact_activities fails.
        IF EXISTS (SELECT 1 FROM public.contacts WHERE id = OLD.contact_id) THEN
            INSERT INTO public.contact_activities
                (contact_id, user_id, action_type, description)
            VALUES
                (OLD.contact_id, auth.uid(), 'delete', 'Deleted a note');
        END IF;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
