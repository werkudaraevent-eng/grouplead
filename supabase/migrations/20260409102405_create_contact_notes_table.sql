-- Contact-level notes (mirrors lead_notes pattern)
CREATE TABLE public.contact_notes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    author_name TEXT,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contact_notes ENABLE ROW LEVEL SECURITY;

-- RLS: Allow authenticated users to read/insert/update/delete
CREATE POLICY "Authenticated users can read contact notes"
    ON public.contact_notes FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can insert contact notes"
    ON public.contact_notes FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated users can update own contact notes"
    ON public.contact_notes FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Authenticated users can delete own contact notes"
    ON public.contact_notes FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());;
