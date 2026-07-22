CREATE OR REPLACE FUNCTION public.audit_company_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        -- Check name change
        IF OLD.name IS DISTINCT FROM NEW.name THEN
            INSERT INTO public.company_activities 
                (client_company_id, user_id, action_type, description, field_name, old_value, new_value)
            VALUES 
                (NEW.id, auth.uid(), 'update', 'Updated company name from "' || OLD.name || '" to "' || NEW.name || '"', 'name', OLD.name, NEW.name);
        END IF;

        -- Check owner change
        IF OLD.owner_id IS DISTINCT FROM NEW.owner_id THEN
            INSERT INTO public.company_activities 
                (client_company_id, user_id, action_type, description, field_name, old_value, new_value)
            VALUES 
                (NEW.id, auth.uid(), 'update', 'Changed record owner', 'owner_id', OLD.owner_id::text, NEW.owner_id::text);
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS company_audit_trigger ON public.client_companies;
CREATE TRIGGER company_audit_trigger
    AFTER UPDATE ON public.client_companies
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_company_changes();


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
        INSERT INTO public.company_activities 
            (client_company_id, user_id, action_type, description)
        VALUES 
            (OLD.client_company_id, auth.uid(), 'delete', 'Deleted a note');
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS company_notes_audit_trigger ON public.company_notes;
CREATE TRIGGER company_notes_audit_trigger
    AFTER INSERT OR DELETE ON public.company_notes
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_company_notes();;
