-- ============================================================
-- MIGRATION: Relational Client Companies & Contacts
-- Separate from tenant 'companies' table (multi-company support)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.client_companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    industry TEXT,
    website TEXT,
    phone TEXT,
    address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_client_companies_name ON public.client_companies(name);

CREATE TABLE IF NOT EXISTS public.contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_company_id UUID REFERENCES public.client_companies(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    job_title TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contacts_company ON public.contacts(client_company_id);

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS client_company_id UUID REFERENCES public.client_companies(id);
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES public.contacts(id);

CREATE INDEX IF NOT EXISTS idx_leads_client_company ON public.leads(client_company_id);
CREATE INDEX IF NOT EXISTS idx_leads_contact ON public.leads(contact_id);

ALTER TABLE public.client_companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "client_companies_select" ON public.client_companies FOR SELECT USING (true);
CREATE POLICY "client_companies_insert" ON public.client_companies FOR INSERT WITH CHECK (true);
CREATE POLICY "client_companies_update" ON public.client_companies FOR UPDATE USING (true);
CREATE POLICY "client_companies_delete" ON public.client_companies FOR DELETE USING (true);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contacts_select" ON public.contacts FOR SELECT USING (true);
CREATE POLICY "contacts_insert" ON public.contacts FOR INSERT WITH CHECK (true);
CREATE POLICY "contacts_update" ON public.contacts FOR UPDATE USING (true);
CREATE POLICY "contacts_delete" ON public.contacts FOR DELETE USING (true);
