-- Company-level notes (mirrors lead_notes pattern)
CREATE TABLE public.company_notes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_company_id UUID NOT NULL REFERENCES public.client_companies(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    author_name TEXT,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.company_notes ENABLE ROW LEVEL SECURITY;

-- RLS: Allow authenticated users to read/insert/update/delete
CREATE POLICY "Authenticated users can read company notes"
    ON public.company_notes FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can insert company notes"
    ON public.company_notes FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated users can update own company notes"
    ON public.company_notes FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Authenticated users can delete own company notes"
    ON public.company_notes FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());;
