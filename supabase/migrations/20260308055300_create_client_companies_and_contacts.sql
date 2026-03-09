-- ============================================================
-- MIGRATION: Relational Client Companies & Contacts
-- Separate from tenant 'companies' table (multi-company support)
-- ============================================================

-- 1. Client Companies (CRM entity — the company a lead belongs to)
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

-- 2. Contacts (linked to a client company)
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

-- 3. Add FK columns to leads (nullable — won't break existing data)
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS client_company_id UUID REFERENCES public.client_companies(id);
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES public.contacts(id);

CREATE INDEX IF NOT EXISTS idx_leads_client_company ON public.leads(client_company_id);
CREATE INDEX IF NOT EXISTS idx_leads_contact ON public.leads(contact_id);

-- 4. RLS on client_companies
ALTER TABLE public.client_companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_companies_select" ON public.client_companies FOR SELECT USING (true);
CREATE POLICY "client_companies_insert" ON public.client_companies FOR INSERT WITH CHECK (true);
CREATE POLICY "client_companies_update" ON public.client_companies FOR UPDATE USING (true);
CREATE POLICY "client_companies_delete" ON public.client_companies FOR DELETE USING (true);

-- 5. RLS on contacts
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contacts_select" ON public.contacts FOR SELECT USING (true);
CREATE POLICY "contacts_insert" ON public.contacts FOR INSERT WITH CHECK (true);
CREATE POLICY "contacts_update" ON public.contacts FOR UPDATE USING (true);
CREATE POLICY "contacts_delete" ON public.contacts FOR DELETE USING (true);

-- 6. Backfill: Create client_companies from existing lead company_name values
INSERT INTO public.client_companies (name)
SELECT DISTINCT company_name FROM public.leads WHERE company_name IS NOT NULL AND company_name != ''
ON CONFLICT DO NOTHING;

-- 7. Backfill: Link existing leads to their client_companies
UPDATE public.leads l
SET client_company_id = cc.id
FROM public.client_companies cc
WHERE l.company_name = cc.name AND l.client_company_id IS NULL;

-- 8. Backfill: Create contacts from existing lead contact data
INSERT INTO public.contacts (client_company_id, full_name, email, phone, job_title)
SELECT DISTINCT ON (l.contact_full_name, cc.id)
    cc.id,
    l.contact_full_name,
    l.contact_email,
    l.contact_mobile,
    l.job_title
FROM public.leads l
JOIN public.client_companies cc ON cc.name = l.company_name
WHERE l.contact_full_name IS NOT NULL AND l.contact_full_name != ''
ON CONFLICT DO NOTHING;

-- 9. Backfill: Link existing leads to their contacts
UPDATE public.leads l
SET contact_id = c.id
FROM public.contacts c
WHERE c.full_name = l.contact_full_name
  AND c.client_company_id = l.client_company_id
  AND l.contact_id IS NULL;;
