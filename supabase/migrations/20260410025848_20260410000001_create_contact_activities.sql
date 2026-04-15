CREATE TABLE IF NOT EXISTS public.contact_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL,
    description TEXT NOT NULL,
    field_name TEXT,
    old_value TEXT,
    new_value TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.contact_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all select" ON public.contact_activities FOR SELECT USING (true);
CREATE POLICY "Allow all insert" ON public.contact_activities FOR INSERT WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.audit_contact_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF OLD.full_name IS DISTINCT FROM NEW.full_name THEN
            INSERT INTO public.contact_activities 
                (contact_id, user_id, action_type, description, field_name, old_value, new_value)
            VALUES 
                (NEW.id, auth.uid(), 'update', 'Updated contact name from "' || OLD.full_name || '" to "' || NEW.full_name || '"', 'full_name', OLD.full_name, NEW.full_name);
        END IF;

        IF OLD.owner_id IS DISTINCT FROM NEW.owner_id THEN
            INSERT INTO public.contact_activities 
                (contact_id, user_id, action_type, description, field_name, old_value, new_value)
            VALUES 
                (NEW.id, auth.uid(), 'update', 'Changed record owner', 'owner_id', OLD.owner_id::text, NEW.owner_id::text);
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS contact_audit_trigger ON public.contacts;
CREATE TRIGGER contact_audit_trigger
    AFTER UPDATE ON public.contacts
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_contact_changes();

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
        INSERT INTO public.contact_activities 
            (contact_id, user_id, action_type, description)
        VALUES 
            (OLD.contact_id, auth.uid(), 'delete', 'Deleted a note');
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS contact_notes_audit_trigger ON public.contact_notes;
CREATE TRIGGER contact_notes_audit_trigger
    AFTER INSERT OR DELETE ON public.contact_notes
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_contact_notes();;
