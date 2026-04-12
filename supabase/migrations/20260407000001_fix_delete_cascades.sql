-- Fix restrictive foreign keys that were blocking bulk deletes

ALTER TABLE public.leads
DROP CONSTRAINT IF EXISTS leads_contact_id_fkey,
ADD CONSTRAINT leads_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;

ALTER TABLE public.leads
DROP CONSTRAINT IF EXISTS leads_client_company_id_fkey,
ADD CONSTRAINT leads_client_company_id_fkey FOREIGN KEY (client_company_id) REFERENCES public.client_companies(id) ON DELETE SET NULL;
